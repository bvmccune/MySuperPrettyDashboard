import {AgendaEvent,dateKey} from './prettyCalendar';
export type WorkHours={start:string;end:string};
export const DEFAULT_WORK_HOURS:WorkHours={start:'09:00',end:'17:00'};
function parseTime(s:string):number|null{const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);return m?Number(m[1])*60+Number(m[2]):null;}
export function validWorkHours(x:any):x is WorkHours{if(!x||typeof x.start!=='string'||typeof x.end!=='string')return false;const s=parseTime(x.start),e=parseTime(x.end);return s!==null&&e!==null&&s<e;}
export function availability(day:string,events:AgendaEvent[],hours:WorkHours,now=new Date()){
 const base=new Date(day+'T00:00:00'),start=parseTime(hours.start)??540,end=parseTime(hours.end)??1020;
 const at=(m:number)=>new Date(base.getFullYear(),base.getMonth(),base.getDate(),Math.floor(m/60),m%60).getTime();
 const remaining=day===dateKey(now),finish=at(end),begin=Math.min(finish,Math.max(at(start),remaining?now.getTime():at(start)));
 const intervals=events.filter(e=>!e.all_day&&e.endMillis>e.startMillis).map(e=>[Math.max(begin,e.startMillis),Math.min(finish,e.endMillis)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
 let busyMs=0,first=0,last=0;for(const [a,b] of intervals){if(a>last){busyMs+=last-first;first=a;last=b;}else last=Math.max(last,b);}busyMs+=last-first;
 const total=Math.max(0,Math.round((finish-begin)/60000)),busy=Math.min(total,Math.max(0,Math.round(busyMs/60000)));return {free:total-busy,busy,remaining};
}
export function minuteLabel(m:number){return [Math.floor(m/60)?Math.floor(m/60)+'h':'',m%60?m%60+'m':''].filter(Boolean).join(' ')||'0m';}
