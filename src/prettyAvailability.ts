/** Port of My Pretty Calendar CURRENT → NEXT. Strict overlap, not touching intervals. */
import {AgendaEvent,dateKey} from './prettyCalendar';
export type AvailabilityBox={kind:'free'|'busy'|'rest'|'unavailable'|'art';minutes?:number;left?:boolean};
export function minuteLabel(m:number){return [Math.floor(m/60)?Math.floor(m/60)+'h':'',m%60?m%60+'m':''].filter(Boolean).join(' ')||'0m';}
export function availability(events:AgendaEvent[],now=new Date(),hiddenTitles:string[]=[]):[AvailabilityBox,AvailabilityBox]{
 const today=dateKey(now),time=now.getTime(),minutes=(ms:number)=>Math.max(0,Math.ceil(ms/60000));
 const filters=hiddenTitles.map(s=>s.trim().toLowerCase()).filter(Boolean);
 const intervals=events.filter(e=>!e.all_day&&e.startDay<=today&&today<e.endDayExclusive&&Number.isFinite(e.startMillis)&&Number.isFinite(e.endMillis)&&e.endMillis>e.startMillis&&e.endMillis>time&&!filters.some(s=>e.summary.toLowerCase().includes(s))).map(e=>({start:e.startMillis,end:e.endMillis})).sort((a,b)=>a.start-b.start);
 const blocks:{start:number;end:number}[]=[];
 for(const interval of intervals){const last=blocks[blocks.length-1];if(last&&interval.start<last.end)last.end=Math.max(last.end,interval.end);else blocks.push({...interval});}
 const current=blocks.findIndex(b=>b.start<=time&&b.end>time);
 if(current>=0){const b=blocks[current],next=blocks[current+1];return [{kind:'busy',minutes:minutes(b.end-time),left:true},!next?{kind:'rest'}:next.start>b.end?{kind:'free',minutes:minutes(next.start-b.end)}:{kind:'busy',minutes:minutes(next.end-next.start)}];}
 const next=blocks.find(b=>b.start>time);
 return next?[{kind:'free',minutes:minutes(next.start-time)},{kind:'busy',minutes:minutes(next.end-next.start)}]:[{kind:'rest'},{kind:'art'}];
}
