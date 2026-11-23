/**
 * Read-only bridge to the user's REAL Supernote To-do list.
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
    'MySuperPrettyDashboard needs internet access to read your existing Supernote To-do tasks from Supernote Cloud.');
  if (result !== 1 && result !== 2) throw new Error('Internet permission is required to sync Supernote To-do.');
}
async function cloudCall(path: string, data: Record<string, unknown>, token?: string): Promise<Record<string, any>> {
  await permission();
  const response = await fetch(BASE + path, {
    method: 'POST',
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
      detail:String(row.detail ?? ''),listId:String(row.taskListId ?? ''),
    });
  }
  const page = String(data.nextPageToken ?? '').trim();
  const truncated = page !== '' && page !== 'null' && page !== 'undefined';
  return {tasks,truncated};
}
