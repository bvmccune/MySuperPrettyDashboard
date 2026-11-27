/**
 * Read/write bridge to the user's REAL Supernote To-do list.
 * SDK has no public plugin task API. The unofficial cloud transport is used
 * only after explicit account connection. Native To-do remains source of truth.
 * Independently implemented from documented protocol observations:
 * https://github.com/Sparkinman/task-hub-supernote-plugin
 * Never store a password, verification code, or duplicate local tasks.
 */
import {NativeModules} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';

const BASE = 'https://viewer.supernote.com/api';
const {DashboardNative} = NativeModules;
const INTERNET = 'plugin.permission.INTERNET';

export interface NativeTodo {
  id: string; title: string; due: string | null; detail: string; listId: string;
  link?: {name:string; path?:string; page?:number; fileId?:string; pageId?:string};
}
export interface NativeTaskResult {tasks: NativeTodo[]; truncated: boolean}

function localDate(time: unknown): string | null {
  const n = Number(time);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n);
  const utcMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
  const y = utcMidnight ? d.getUTCFullYear() : d.getFullYear();
  const m = (utcMidnight ? d.getUTCMonth() : d.getMonth()) + 1;
  const day = utcMidnight ? d.getUTCDate() : d.getDate();
  return y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}
async function permission(): Promise<void> {
  const check = await PluginManager.hasPermission(INTERNET);
  if (check === 1 || check === 2) return;
  const result = await PluginManager.requestPermission(INTERNET,
    'SmartyNote needs internet access to read and update your existing Supernote To-do tasks from Supernote Cloud.');
  if (result !== 1 && result !== 2) throw new Error('Internet permission is required to sync Supernote To-do.');
}
async function cloudCall(path: string, data: Record<string, unknown>, token?: string, method='POST'): Promise<Record<string, any>> {
  await permission();
  const response = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? {'x-access-token': token} : {}),
    },
    body: JSON.stringify(data),
  });
  if (response.status === 401 || response.status === 403) throw new Error('Supernote session expired. Reconnect in Settings.');
  const answer: any = await response.json();
  if (!response.ok || !answer || answer.success === false) {
    const message = String(answer?.errorMsg ?? answer?.message ?? ('Supernote Cloud returned HTTP ' + response.status + '.'));
    throw new Error(message);
  }
  return answer;
}
async function hash(algorithm: 'MD5' | 'SHA-256', input: string): Promise<string> {
  return DashboardNative.hashHex(algorithm, input);
}
export type LoginProgress =
  | {kind: 'complete'}
  | {kind: 'verify'; key: string; timestamp: unknown};

export async function startSupernoteLogin(email: string, password: string): Promise<LoginProgress> {
  const account = email.trim();
  if (!account || !password) throw new Error('Enter your Supernote account email and password.');
  const challenge = await cloudCall('/official/user/query/random/code', {countryCode: '1', account});
  const randomCode = String(challenge.randomCode ?? '');
  if (!randomCode) throw new Error('Supernote did not return a sign-in challenge.');
  const digest = await hash('SHA-256', (await hash('MD5', password)) + randomCode);
  await permission();
  const response = await fetch(BASE + '/official/user/account/login/new', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      countryCode:1, account, password:digest, browser:'Chrome107',equipment:'1',
      loginMethod:'1',timestamp:challenge.timestamp,language:'en',
    }),
  });
  const login: any = await response.json();
  if (typeof login?.token === 'string' && login.token) {
    await DashboardNative.secureSaveTodoToken(login.token);
    return {kind:'complete'};
  }
  if (login?.errorCode !== 'E1760') throw new Error(String(login?.errorMsg ?? 'Supernote account sign-in was not accepted.'));
  const pre = await cloudCall('/user/validcode/pre-auth', {account});
  const preToken = String(pre.token ?? '');
  const last = Number(preToken.slice(-1));
  const segments = preToken.split('-');
  if (!preToken || !Number.isInteger(last) || !segments[last]) throw new Error('Unsupported Supernote verification token format.');
  const sent = await cloudCall('/user/mail/validcode/send', {
    email: account, timestamp:challenge.timestamp, token:preToken,
    sign: await hash('SHA-256', account + segments[last]),
  });
  if (!sent.validCodeKey) throw new Error('Supernote did not send a verification code.');
  return {kind:'verify',key:String(sent.validCodeKey),timestamp:challenge.timestamp};
}
export async function verifySupernoteLogin(
  email: string, code: string, validCodeKey: string, timestamp: unknown,
): Promise<void> {
  if (!code.trim()) throw new Error('Enter the verification code emailed by Supernote.');
  const result = await cloudCall('/official/user/sms/login',{
    email:email.trim(),validCode:code.trim().toUpperCase(),validCodeKey,timestamp,
    browser:'Chrome107',equipment:'4',
  });
  const token = String(result.token ?? '');
  if (!token) throw new Error('Supernote did not return a session. Request a new verification code.');
  await DashboardNative.secureSaveTodoToken(token);
}
export async function hasSupernoteLogin(): Promise<boolean> {
  const token: string = await DashboardNative.secureLoadTodoToken();
  return Boolean(token);
}
export async function disconnectSupernote(): Promise<void> {
  await DashboardNative.secureClearTodoToken();
}
export async function readNativeSupernoteTasks(): Promise<NativeTaskResult> {
  const token: string = await DashboardNative.secureLoadTodoToken();
  if (!token) throw new Error('Connect your Supernote Cloud account in Settings to show your native To-do list.');
  const data = await cloudCall('/file/schedule/task/all',{maxResults:1000},token);
  if (!Array.isArray(data.scheduleTask)) throw new Error('Supernote changed the task response format. Native To-do could not be read.');
  const tasks: NativeTodo[] = [];
  for (const row of data.scheduleTask) {
    if (!row || !row.taskId || String(row.isDeleted).toUpperCase() === 'Y') continue;
    if (String(row.status) === 'completed') continue;
    const name = String(row.title ?? '').trim();
    if (!name) continue;
    tasks.push({
      id:String(row.taskId),title:name,due:localDate(row.dueTime),
      detail:String(row.detail ?? ''),listId:String(row.taskListId ?? ''),link:taskNoteLink(row),
    });
  }
  const page = String(data.nextPageToken ?? '').trim();
  const truncated = page !== '' && page !== 'null' && page !== 'undefined';
  return {tasks,truncated};
}

/** Cloud links are Base64 UTF-8 JSON; older responses may contain plain JSON.
 * Source: https://allenporter.github.io/supernote/supernote/models/schedule.html */
function decodeLinkJson(value:string):unknown {
  try{return JSON.parse(value);}catch{}
  const raw=value.trim().replace(/-/g,'+').replace(/_/g,'/');
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)||raw.length>65536)return undefined;
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let acc=0,bits=0,encoded='';
  for(const ch of raw.replace(/=+$/,'')){
    acc=(acc<<6)|alphabet.indexOf(ch);bits+=6;
    if(bits>=8){bits-=8;encoded+='%'+((acc>>>bits)&255).toString(16).padStart(2,'0');}
  }
  try{return JSON.parse(decodeURIComponent(encoded));}catch{return undefined;}
}
export function noteLink(links:unknown,depth=0):NativeTodo['link'] {
  if(depth>5||!links)return undefined;
  if(typeof links==='string')return noteLink(decodeLinkJson(links),depth+1);
  if(Array.isArray(links)){
    for(const entry of links){const link=noteLink(entry,depth+1);if(link)return link;}
    return undefined;
  }
  if(typeof links!=='object')return undefined;
  const r=links as Record<string,unknown>;
  const raw=String(r.filePath??r.path??'').trim();
  if(raw&&(!/\.note$/i.test(raw)||raw.split('/').includes('..')))return undefined;
  const path=raw?'/storage/emulated/0/'+raw.replace(/^\/storage\/emulated\/0\//,'').replace(/^\/+/, ''):'';
  const name=String(r.fileName??r.name??path.split('/').pop()??'').trim();
  const fileId=String(r.fileId??'').trim(),pageId=String(r.pageId??'').trim();
  if(!name&&!path&&!fileId&&!pageId)return undefined;
  const page=Number(r.pageNo??r.page);
  return {name,path:path||undefined,page:Number.isInteger(page)&&page>0?page:undefined,fileId:fileId||undefined,pageId:pageId||undefined};
}
function taskNoteLink(row:Record<string,any>):NativeTodo['link']{
  return noteLink(row.links)??noteLink(row.noteLinks)??noteLink(row.noteLink)??noteLink(row.link);
}
/** User-triggered local diagnostic. Field names and counts, never task values. */
export async function inspectTaskLinkSchema():Promise<string>{
  const token:string=await DashboardNative.secureLoadTodoToken();
  if(!token)throw Error('Reconnect Supernote Cloud in Settings.');
  const data=await cloudCall('/file/schedule/task/all',{maxResults:1000},token);
  if(!Array.isArray(data.scheduleTask))throw Error('Invalid task response.');
  const rows=data.scheduleTask.filter((r:any)=>r&&r.taskId&&String(r.isDeleted).toUpperCase()!=='Y'&&r.status!=='completed');
  const keys=new Set<string>(),shapes=new Map<string,number>();
  for(const row of rows){
    Object.keys(row).forEach(k=>keys.add(k));
    for(const field of ['links','noteLinks','noteLink','link']){
      if(row[field]==null)continue;
      let value=row[field];
      let form=Array.isArray(value)?'array':typeof value;
      if(typeof value==='string'){try{value=JSON.parse(value);form+=' (JSON)';}catch{}}
      const entries=Array.isArray(value)?value:[value];
      const fields=[...new Set(entries.flatMap((v:any)=>v&&typeof v==='object'?Object.keys(v):[]))].sort();
      const signature=field+' '+form+' ['+fields.join(', ')+']';
      shapes.set(signature,(shapes.get(signature)??0)+1);
    }
  }
  return ['Open tasks: '+rows.length,'Recognized notebook links: '+rows.filter((r:any)=>taskNoteLink(r)).length,'Task field names: '+[...keys].sort().join(', '),'Link shapes: '+([...shapes].map(([k,n])=>k+': '+n).join('\n')||'No explicit link fields returned')].join('\n');
}
export async function updateNativeTodo(id:string, change:{complete?:true;title?:string;due?:string|null}):Promise<void>{
  const token:string=await DashboardNative.secureLoadTodoToken();
  if(!token)throw new Error('Reconnect Supernote Cloud in Settings.');
  const read=()=>cloudCall('/file/schedule/task/all',{maxResults:1000},token);
  const before=await read();
  if(!Array.isArray(before.scheduleTask))throw new Error('Invalid task response.');
  const row=before.scheduleTask.find((r:any)=>String(r?.taskId)===id&&String(r.isDeleted).toUpperCase()!=='Y');
  if(!row||row.status==='completed')throw new Error('Task is no longer open. Refresh the dashboard.');
  const patch:Record<string,unknown>={};
  if(change.title!==undefined){
    if(!change.title.trim())throw new Error('Task name is required.');
    patch.title=change.title.trim();
  }
  if(change.due!==undefined){
    if(change.due===null)patch.dueTime=0;
    else {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(change.due))throw new Error('Use YYYY-MM-DD.');
      const ms=Date.parse(change.due+'T00:00:00');
      if(!Number.isFinite(ms)||localDate(ms)!==change.due)throw new Error('Invalid due date.');
      patch.dueTime=ms;
    }
  }
  if(change.complete){patch.status='completed';patch.completedTime=Date.now();}
  if(!Object.keys(patch).length)return;
  // Preserve the server's entire row including link, recurrence and reminder metadata.
  // PUT only: POST creates a duplicate even if taskId is supplied.
  await cloudCall('/file/schedule/task',{...row,...patch,lastModified:Date.now()},token,'PUT');
  const after=await read();
  const confirmed=Array.isArray(after.scheduleTask)&&after.scheduleTask.find((r:any)=>String(r?.taskId)===id&&String(r.isDeleted).toUpperCase()!=='Y');
  if(!confirmed|| (change.complete&&confirmed.status!=='completed')||
    (change.title!==undefined&&String(confirmed.title)!==change.title.trim())||
    (change.due!==undefined&&localDate(confirmed.dueTime)!==change.due))
    throw new Error('Supernote did not confirm the update. Refresh before retrying.');
}
