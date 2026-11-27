/** Pure behavior and offline snapshot contract of the read-only TRMNL feed. */
jest.mock('react-native', () => ({
  NativeModules: {DashboardNative: {
    readPrivateCalendarSnapshot: jest.fn(async()=> ''),
    savePrivateCalendarSnapshot: jest.fn(async()=> true),
    secureLoadCalendarUrl: jest.fn(async()=> 'https://fixture.workers.dev/calendar'),
    secureSaveCalendarUrl: jest.fn(async()=> true),
  }},
  AppState: {currentState:'active'},
}));
jest.mock('sn-plugin-lib',()=>({
  PluginManager:{
    hasPermission:jest.fn(async()=>1),
    requestPermission:jest.fn(async()=>1),
  },
}));
import {NativeModules} from 'react-native';
import {
  addCalendarDays, agendaFromFeed, allDayRange, dateKey, dayLabel, eventsOnDay,
  eventDuration, eventTimeRange, loadCalendarCache, normalizeFeed,
  refreshCalendar, sevenDayKeys,
} from './prettyCalendar';
import {compactEventRange, hasTimeConflict, fitAgendaRows, wrapEventDuration} from './PrettyAgenda';

const event = (summary:string,start:string,end:string,all_day=false,calendar='Work') =>
  ({summary,start,end,all_day,calendar});
const feed = (events:ReturnType<typeof event>[]) =>
  normalizeFeed({events,updated_at:'2026-11-24T13:00:00Z',
    polled_at:'2026-11-24T13:05:00Z',polled_epoch:1795525500});

describe('Pretty Calendar — user-approved read-only agenda',()=>{
  test('calendar schema has only the five approved event fields',()=>{
    const f=feed([event('Design review','2026-11-24T09:00:00-05:00','2026-11-24T10:30:00-05:00')]);
    expect(Object.keys(f.events[0])).toEqual(['summary','start','end','all_day','calendar']);
    expect(()=>normalizeFeed({events:[{summary:'invalid'}]})).toThrow();
    expect(()=>normalizeFeed({events:'bad'})).toThrow();
  });
  test('calendar day math crosses months and daylight saving without drifting',()=>{
    expect(addCalendarDays('2026-11-30',1)).toBe('2026-12-01');
    expect(addCalendarDays('2026-03-07',2)).toBe('2026-03-09');
    expect(sevenDayKeys(new Date(2026,10,24))).toHaveLength(7);
    expect(dayLabel('2026-11-24')).toBe('Tue 11/24');
  });
  test('multi-day all-day events occur on each day, with exclusive end',()=>{
    const f=feed([event('Hotel stay','2026-11-25','2026-11-28',true,'Personal')]);
    expect(eventsOnDay(f,'2026-11-24')).toHaveLength(0);
    expect(eventsOnDay(f,'2026-11-25')).toHaveLength(1);
    expect(eventsOnDay(f,'2026-11-26')).toHaveLength(1);
    expect(eventsOnDay(f,'2026-11-27')).toHaveLength(1);
    expect(eventsOnDay(f,'2026-11-28')).toHaveLength(0);
  });
  test('all-day dates remain date-only, regardless of UTC offset',()=>{
    const f=feed([event('Thanksgiving','2026-11-26T00:00:00Z','2026-11-27T00:00:00Z',true)]);
    expect(eventsOnDay(f,'2026-11-26')).toHaveLength(1);
    expect(eventsOnDay(f,'2026-11-25')).toHaveLength(0);
  });
  test('overlapping events remain distinct; duplicates of holidays collapse',()=>{
    const f=feed([
      event('Thanksgiving Day','2026-11-26','2026-11-27',true,'US Holidays'),
      event('Thanksgiving','2026-11-26','2026-11-27',true,'Personal Holidays'),
      event('Project Sync','2026-11-26T13:00:00Z','2026-11-26T14:00:00Z'),
      event('Project Review','2026-11-26T13:30:00Z','2026-11-26T14:30:00Z'),
    ]);
    const rows=eventsOnDay(f,'2026-11-26');
    expect(rows).toHaveLength(3);
    expect(rows[0].all_day).toBe(true);
  });
  test('cancelled titles are filtered from agenda, not falsely shown as meetings',()=>{
    const f=feed([
      event('Canceled: ERP Weekly Update','2026-11-24T12:00:00Z','2026-11-24T13:00:00Z'),
      event('Core Team Huddle','2026-11-24T14:00:00Z','2026-11-24T14:30:00Z'),
    ]);
    expect(agendaFromFeed(f).map(x=>x.summary)).toEqual(['Core Team Huddle']);
  });
  test('event row: title left, start–end plus duration right; no description',()=>{
    const f=feed([event('Core Team Huddle','2026-11-24T14:00:00Z','2026-11-24T14:30:00Z')]);
    const a=agendaFromFeed(f)[0];
    expect(eventDuration(a)).toBe('30m');
    expect(compactEventRange(a)).toContain(' 30m');
    expect(compactEventRange(a)).toContain('–');
    expect(eventTimeRange(a)).toContain('–');
    expect('description' in a).toBe(false);
  });
  test('two overlapping circles only appear for overlapping timed events',()=>{
    const f=feed([
      event('Meeting A','2026-11-24T13:00:00-05:00','2026-11-24T14:00:00-05:00'),
      event('Meeting B','2026-11-24T13:30:00-05:00','2026-11-24T14:30:00-05:00'),
      event('Meeting C','2026-11-24T14:30:00-05:00','2026-11-24T15:00:00-05:00'),
      event('PTO','2026-11-24','2026-11-25',true),
    ]);
    const agenda=agendaFromFeed(f);
    const first=agenda.find(e=>e.summary==='Meeting A')!;
    const second=agenda.find(e=>e.summary==='Meeting B')!;
    const third=agenda.find(e=>e.summary==='Meeting C')!;
    const pto=agenda.find(e=>e.summary==='PTO')!;
    expect(hasTimeConflict(first,agenda)).toBe(true);
    expect(hasTimeConflict(second,agenda)).toBe(true);
    expect(hasTimeConflict(third,agenda)).toBe(false);
    expect(hasTimeConflict(pto,agenda)).toBe(false);
  });
  test('calendar date always opens seven days anchored on today',()=>{
    const now=new Date(2026,10,24);
    const days=sevenDayKeys(now);
    expect(days[0]).toBe('2026-11-24');
    expect(days[6]).toBe('2026-11-30');
  });
  test('offline failed refresh retains last successful saved snapshot',async()=>{
    const api=(NativeModules as any).DashboardNative;
    const saved=JSON.stringify({schema:1,fetchedAt:1780000000000,
      feed:feed([event('Existing meeting','2026-11-24T14:00:00Z','2026-11-24T15:00:00Z')])});
    api.readPrivateCalendarSnapshot.mockResolvedValueOnce(saved);
    await loadCalendarCache();
    (global as any).fetch=jest.fn(async()=>{throw new Error('No internet');});
    const result=await refreshCalendar();
    expect(result.status).toBe('cached');
    expect(result.snapshot?.feed.events[0].summary).toBe('Existing meeting');
    expect(api.savePrivateCalendarSnapshot).not.toHaveBeenCalled();
  });
  test('successful refresh replaces snapshot, preserving source timestamps',async()=>{
    const api=(NativeModules as any).DashboardNative;
    (global as any).fetch=jest.fn(async()=>({
      ok:true,json:async()=>({events:[event('New meeting','2026-11-25T14:00:00Z',
        '2026-11-25T15:00:00Z')],updated_at:'update1',
        polled_at:'poll1',polled_epoch:1795525500}),
    }));
    const result=await refreshCalendar();
    expect(result.status).toBe('fresh');
    expect(result.snapshot?.feed.events[0].summary).toBe('New meeting');
    expect(result.snapshot?.feed.updated_at).toBe('update1');
    expect(api.savePrivateCalendarSnapshot).toHaveBeenCalledTimes(1);
  });
});

 describe('Calendar mockup acceptance rules',()=>{
  const at=(h:number,m=0)=>new Date(2026,10,26,h,m).toISOString();
  const row=(start:string,end:string)=>agendaFromFeed(feed([event('Example',start,end)]))[0];
  test('exact compact time and duration labels, including noon, midnight and point events',()=>{
    expect(compactEventRange(row(at(11),at(11,30)))).toBe('11:00–11:30 AM 30m');
    expect(compactEventRange(row(at(13),at(14)))).toBe('1:00–2:00 PM 1h');
    expect(compactEventRange(row(at(11,30),at(13)))).toBe('11:30 AM–1:00 PM 1h 30m');
    expect(compactEventRange(row(at(0),at(1)))).toBe('12:00–1:00 AM 1h');
    expect(compactEventRange(row(at(10),at(10)))).toBe('10:00 AM');
    expect(compactEventRange(agendaFromFeed(feed([event('PTO','2026-11-26','2026-11-27',true)]))[0])).toBe('All day');
  });
  test('point events do not create conflicts and are not dropped at midnight',()=>{
    const rows=agendaFromFeed(feed([event('Reminder',at(10),at(10)),event('Meeting',at(9),at(11)),event('Midnight',at(0),at(0))]));
    expect(rows).toHaveLength(3);
    expect(rows.every(e=>!hasTimeConflict(e,rows))).toBe(true);
    expect(rows[0].startDay).toBe('2026-11-26');
    expect(rows[0].endDayExclusive).toBe('2026-11-27');
  });
  test('overflow uses actual measured heights, not the number of characters',()=>{
    expect(fitAgendaRows([34,53,34,74],121)).toBe(3);
    expect(fitAgendaRows([34,53,34,74],120)).toBe(2);
    expect(fitAgendaRows([34,53],20)).toBe(0);
    expect(fitAgendaRows([34,53],87)).toBe(2);
  });
});

import {GRAYSCALE,INK,PAPER,DARK_GRAY,LIGHT_GRAY} from './prettyPalette';
test('16-level grayscale targets are evenly spaced and UI colors are members',()=>{
 expect(GRAYSCALE).toHaveLength(16);
 expect(GRAYSCALE.map(c=>parseInt(c.slice(1,3),16))).toEqual(Array.from({length:16},(_,i)=>i*17));
 for(const color of [INK,PAPER,DARK_GRAY,LIGHT_GRAY])expect(GRAYSCALE).toContain(color);
});

test('visible row shading uses the next darker level after Manta rejected #EEEEEE',()=>expect(LIGHT_GRAY).toBe('#DDDDDD'));


 test('duration wrap uses the approved seven-character reference and always wraps conflicts',()=>{
 expect(wrapEventDuration('10:00–11:00 AM',false)).toBe(false);
 expect(wrapEventDuration('10:00–11:00 AM',true)).toBe(true);
 expect(wrapEventDuration('9:30–10:00 AM',false)).toBe(true);
 expect(wrapEventDuration('11:00 AM–12:00 PM',false)).toBe(true);
 });

test('TRMNL duration rounds positive partial minutes up and formats mixed units',()=>{
 const start=new Date(2026,10,26,10).getTime();
 const row=(ms:number)=>agendaFromFeed(feed([event('Example',new Date(start).toISOString(),new Date(start+ms).toISOString())]))[0];
 expect(eventDuration(row(1))).toBe('1m');
 expect(eventDuration(row(3600001))).toBe('1h 1m');
 expect(compactEventRange(row(0))).toBe('10:00 AM');
});

test('formats all-day range labels without changing event membership',()=>{
  const same=feed([event('Fixture','2026-11-25','2026-11-28',true)]);
  const across=feed([event('Fixture','2026-11-30','2026-12-03',true)]);
  const single=feed([event('Fixture','2026-11-25','2026-11-26',true)]);
  expect(allDayRange(agendaFromFeed(same)[0])).toBe('25–27 Nov');
  expect(eventTimeRange(agendaFromFeed(across)[0])).toBe('30 Nov–2 Dec');
  expect(compactEventRange(agendaFromFeed(single)[0])).toBe('All day');
  expect(eventsOnDay(same,'2026-11-28')).toHaveLength(0);
  expect(eventsOnDay(across,'2026-12-02')).toHaveLength(1);
});
