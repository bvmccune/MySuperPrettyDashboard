/**
 * Pretty Calendar read-only integration.
 *
 * One source of truth: the pre-existing TRMNL Cloudflare Worker JSON feed.
 * Never creates/updates/deletes native Supernote events. Replaces its local
 * private snapshot wholesale after validating the full response.
 *
 * Local cache is in Android app-private storage via DashboardNative, not in
 * shared MyStyle. No work meeting titles are logged or sent to any other URL.
 */
import {AppState, NativeModules} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';

// Feed address is stored encrypted on the Manta, never embedded in public code.
export async function isCalendarSourceConfigured():Promise<boolean> {
  const url:string=await DashboardNative.secureLoadCalendarUrl();
  return Boolean(url);
}
export async function configureCalendarSource(url:string):Promise<void> {
  const source=url.trim();
  if (!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev\/calendar\/?$/i.test(source))
    throw new Error('Enter the HTTPS Pretty Calendar Cloudflare Worker /calendar URL.');
  const result=await DashboardNative.secureSaveCalendarUrl(source);
  if(result!==true)throw new Error('The calendar source could not be saved.');
}
export const CALENDAR_REFRESH_MS = 5 * 60 * 1000;

const {DashboardNative} = NativeModules;
const INTERNET = 'plugin.permission.INTERNET';
const MAX_EVENTS = 5000;

export interface FeedEvent {
  summary: string;
  start: string;
  end: string;
  all_day: boolean;
  calendar: string;
}
export interface PrettyCalendarFeed {
  events: FeedEvent[];
  updated_at: string | number | null;
  polled_at: string | number | null;
  polled_epoch: number | null;
}
export interface CalendarSnapshot {
  schema: 1;
  fetchedAt: number;
  feed: PrettyCalendarFeed;
}
export type CalendarStatus = 'loading' | 'fresh' | 'cached' | 'empty' | 'unavailable';
export interface CalendarResult {
  snapshot: CalendarSnapshot | null;
  status: CalendarStatus;
  error?: string;
  lastAttemptAt?: number;
}
export interface AgendaEvent extends FeedEvent {
  startMillis: number;
  endMillis: number;
  startDay: string;
  endDayExclusive: string;
  key: string;
}

const validDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(new Date(value + 'T12:00:00Z').getTime()) &&
  new Date(value + 'T12:00:00Z').toISOString().slice(0,10) === value;

export function dateKey(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
export function addCalendarDays(key: string, offset: number): string {
  if (!validDate(key)) throw new Error('Invalid calendar day');
  const d = new Date(key + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0,10);
}
export function dayLabel(key: string): string {
  const d = new Date(key + 'T12:00:00Z');
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()] + ' ' +
    String(d.getUTCMonth()+1) + '/' + String(d.getUTCDate());
}
function isCancelled(event: any): boolean {
  // Current feed does not declare a status field. Only the explicit title
  // prefix (or optional future status) is observable and safe to filter.
  return /^cancel(?:ed|led)(?:\s*[:\-–]|\s+)/i.test(String(event.summary ?? '').trim()) ||
    /^(cancelled|canceled)$/i.test(String(event.status ?? ''));
}
function numericDate(s: string): number {
  return new Date(s).getTime();
}
function localDayOf(ms: number): string {
  return dateKey(new Date(ms));
}
function parseAgendaEvent(event: FeedEvent, i: number): AgendaEvent | null {
  if (!event || typeof event.summary !== 'string' || typeof event.start !== 'string' ||
      typeof event.end !== 'string' || typeof event.calendar !== 'string' ||
      typeof event.all_day !== 'boolean') return null;
  if (isCancelled(event)) return null;
  const title = event.summary.trim();
  if (!title) return null;
  let startMillis: number, endMillis: number, startDay: string, endDayExclusive: string;
  if (event.all_day) {
    // All-day dates are calendar days, never converted via a UTC Date→local
    // Date pipeline (which would shift them backwards in US time zones).
    startDay = event.start.slice(0,10);
    endDayExclusive = event.end.slice(0,10);
    if (!validDate(startDay) || !validDate(endDayExclusive)) return null;
    if (endDayExclusive <= startDay) endDayExclusive = addCalendarDays(startDay,1);
    startMillis = numericDate(startDay + 'T00:00:00Z');
    endMillis = numericDate(endDayExclusive + 'T00:00:00Z');
  } else {
    startMillis = numericDate(event.start);
    endMillis = numericDate(event.end);
    if (!Number.isFinite(startMillis) || !Number.isFinite(endMillis) || endMillis < startMillis) return null;
    startDay = localDayOf(startMillis);
    // End is exclusive. Exact midnight belongs to the previous day only.
    endDayExclusive = addCalendarDays(localDayOf(endMillis === startMillis ? startMillis : endMillis - 1), 1);
  }
  const normalized: FeedEvent = {summary:title, start:event.start, end:event.end,
    all_day:event.all_day, calendar:event.calendar};
  return {...normalized,startMillis,endMillis,startDay,endDayExclusive,
    key:String(i)+':'+event.start+':'+event.end};
}
export function normalizeFeed(input: unknown): PrettyCalendarFeed {
  if (!input || typeof input !== 'object') throw new Error('Calendar returned an invalid JSON object');
  const raw = input as any;
  if (!Array.isArray(raw.events) || raw.events.length > MAX_EVENTS) throw new Error('Calendar events are missing or exceed the supported limit');
  // Schema validation is strict; do not overwrite the last good snapshot with
  // a potentially partial, failed or incompatible worker response.
  for (const e of raw.events) {
    if (!e || typeof e.summary !== 'string' || typeof e.start !== 'string' ||
        typeof e.end !== 'string' || typeof e.all_day !== 'boolean' ||
        typeof e.calendar !== 'string')
      throw new Error('Calendar event schema differs from the documented source');
    if (!e.all_day && (!Number.isFinite(numericDate(e.start)) || !Number.isFinite(numericDate(e.end))))
      throw new Error('Calendar returned an invalid event timestamp');
    if (e.all_day && (!validDate(e.start.slice(0,10)) || !validDate(e.end.slice(0,10))))
      throw new Error('Calendar returned an invalid all-day date');
  }
  const polled_epoch = raw.polled_epoch === null || raw.polled_epoch === undefined ? null :
    (typeof raw.polled_epoch === 'number' && Number.isFinite(raw.polled_epoch) ? raw.polled_epoch : null);
  if (raw.polled_epoch != null && polled_epoch === null) throw new Error('Invalid calendar poll timestamp');
  return {
    events:raw.events.map((e:FeedEvent)=>({
      summary:e.summary,start:e.start,end:e.end,all_day:e.all_day,calendar:e.calendar,
    })),
    updated_at: typeof raw.updated_at === 'string' || typeof raw.updated_at === 'number' ? raw.updated_at : null,
    polled_at: typeof raw.polled_at === 'string' || typeof raw.polled_at === 'number' ? raw.polled_at : null,
    polled_epoch,
  };
}
function holidayKey(event: AgendaEvent): string | null {
  if (!event.all_day) return null;
  let name=event.summary.trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  if (!/\b(holiday|thanksgiving|christmas|new year|easter|memorial day|labor day|independence day|veterans day|juneteenth)\b/.test(name)) return null;
  name=name.replace(/\s+day$/,'').replace(/^observed\s+/,'').trim();
  return event.startDay+'|'+event.endDayExclusive+'|'+name;
}
export function agendaFromFeed(feed: PrettyCalendarFeed): AgendaEvent[] {
  const seenHolidays=new Set<string>();
  const parsed:AgendaEvent[]=[];
  for(let i=0;i<feed.events.length;i++){
    const event=parseAgendaEvent(feed.events[i],i);
    if(!event) continue;
    const duplicate=holidayKey(event);
    if(duplicate){
      if(seenHolidays.has(duplicate))continue;
      seenHolidays.add(duplicate);
    }
    parsed.push(event);
  }
  return parsed.sort((a,b)=>
    Number(b.all_day)-Number(a.all_day) || a.startMillis-b.startMillis ||
    a.summary.localeCompare(b.summary));
}
export function eventsOnDay(feed: PrettyCalendarFeed, key: string): AgendaEvent[] {
  if(!validDate(key)) return [];
  return agendaFromFeed(feed).filter(e=>e.startDay<=key && key<e.endDayExclusive)
    .sort((a,b)=>Number(b.all_day)-Number(a.all_day)||a.startMillis-b.startMillis||a.summary.localeCompare(b.summary));
}
export function sevenDayKeys(today:Date=new Date()): string[] {
  const first=dateKey(today);
  return Array.from({length:7},(_,i)=>addCalendarDays(first,i));
}
export function eventTime(event:AgendaEvent):string {
  if(event.all_day)return 'All day';
  return new Date(event.startMillis).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
}
/** Match the approved compact mockup: no :00, lower-case am/pm, one
 * meridiem when both endpoints share it, both when crossing noon/midnight. */
export function compactEventTime(ms:number,showPeriod=true):string {
  const d=new Date(ms),hours=d.getHours(),minutes=d.getMinutes();
  return String(hours%12||12)+(minutes?':'+String(minutes).padStart(2,'0'):'')+
    (showPeriod?(hours<12?' am':' pm'):'');
}
export function eventTimeRange(event:AgendaEvent):string {
  if(event.all_day)return 'All day';
  if(event.startMillis===event.endMillis)return compactEventTime(event.startMillis);
  const samePeriod=(new Date(event.startMillis).getHours()<12)===(new Date(event.endMillis).getHours()<12);
  return compactEventTime(event.startMillis,!samePeriod)+'–'+compactEventTime(event.endMillis);
}
export function compactEventRange(event:AgendaEvent):string {
  const time=eventTimeRange(event);
  return event.all_day||event.startMillis===event.endMillis?time:time+' '+eventDuration(event);
}
export function eventDuration(event:AgendaEvent):string {
  if(event.all_day)return 'All day';
  const minutes=Math.max(0,Math.round((event.endMillis-event.startMillis)/60000));
  const hours=Math.floor(minutes/60), mins=minutes%60;
  return [hours?hours+'h':'',mins?mins+'m':''].filter(Boolean).join(' ')||'0m';
}

let latest: CalendarResult={snapshot:null,status:'loading'};
let pending:Promise<CalendarResult>|null=null;
let permissionGranted=false;

export function currentCalendar():CalendarResult {return latest;}
export async function loadCalendarCache():Promise<CalendarResult>{
  try{
    const data:string=await DashboardNative.readPrivateCalendarSnapshot();
    if(!data) return latest.snapshot ? latest : (latest={snapshot:null,status:'unavailable'});
    const parsed=JSON.parse(data);
    if(parsed?.schema!==1 || !Number.isFinite(parsed?.fetchedAt))throw new Error('Old cache');
    const snapshot:CalendarSnapshot={schema:1,fetchedAt:parsed.fetchedAt,feed:normalizeFeed(parsed.feed)};
    // The live network request may finish first; never replace newer data
    // with older disk content because of an initialization race.
    if(latest.snapshot && latest.snapshot.fetchedAt>snapshot.fetchedAt)return latest;
    return latest={snapshot,status:snapshot.feed.events.length===0?'empty':'cached'};
  } catch {return latest.snapshot ? latest : (latest={snapshot:null,status:'unavailable'});}
}
async function internetPermission():Promise<void>{
  if(permissionGranted)return;
  const current=await PluginManager.hasPermission(INTERNET);
  if(current===1||current===2){permissionGranted=true;return;}
  const granted=await PluginManager.requestPermission(INTERNET,
    'Read your existing Pretty Calendar events directly from your Cloudflare feed, without changing any events.');
  if(granted!==1&&granted!==2)throw new Error('Calendar network permission was not granted');
  permissionGranted=true;
}
export function refreshCalendar():Promise<CalendarResult>{
  if(pending)return pending;
  pending=(async()=>{
    const last=latest.snapshot;
    let controller:AbortController|null=null;
    let timeout:ReturnType<typeof setTimeout>|undefined;
    try {
      const source:string=await DashboardNative.secureLoadCalendarUrl();
      if(!source)throw new Error('Configure your Pretty Calendar feed URL once in Settings.');
      await internetPermission();
      controller=new AbortController();
      timeout=setTimeout(()=>controller?.abort(),15000);
      const response=await fetch(source,{
        method:'GET',
        headers:{Accept:'application/json'},
        signal:controller.signal,
      });
      if(!response.ok)throw new Error('Calendar feed returned HTTP '+response.status);
      const feed=normalizeFeed(await response.json());
      const snapshot:CalendarSnapshot={schema:1,fetchedAt:Date.now(),feed};
      // A persist failure must not silently destroy the last offline snapshot.
      const saved=await DashboardNative.savePrivateCalendarSnapshot(JSON.stringify(snapshot));
      if(saved!==true)throw new Error('Could not save calendar snapshot');
      return latest={snapshot,status:feed.events.length===0?'empty':'fresh',lastAttemptAt:Date.now()};
    }catch(e:any){
      const error=e?.name==='AbortError'?'Calendar request timed out':
        String(e?.message||'Calendar is unavailable');
      return latest={snapshot:last,status:last?'cached':'unavailable',error,lastAttemptAt:Date.now()};
    }finally{if(timeout)clearTimeout(timeout);}
  })().finally(()=>{pending=null;});
  return pending;
}
