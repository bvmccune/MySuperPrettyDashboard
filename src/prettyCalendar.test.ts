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
  addCalendarDays, agendaFromFeed, dateKey, dayLabel, eventsOnDay,
  eventDuration, eventTimeRange, loadCalendarCache, normalizeFeed,
  refreshCalendar, sevenDayKeys,
} from './prettyCalendar';
import {compactEventRange, hasTimeConflict, fitAgendaRows} from './PrettyAgenda';

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
    expect(compactEventRange(row(at(11),at(11,30)))).toBe('11–11:30 am 30m');
    expect(compactEventRange(row(at(13),at(14)))).toBe('1–2 pm 1h');
    expect(compactEventRange(row(at(11,30),at(13)))).toBe('11:30 am–1 pm 1h 30m');
    expect(compactEventRange(row(at(0),at(1)))).toBe('12–1 am 1h');
    expect(compactEventRange(row(at(10),at(10)))).toBe('10 am');
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

// Include weather/availability acceptance tests in the existing CI test entry.
import './weatherIconMapping.test';
import {availability,minuteLabel} from './prettyAvailability';
import {gaugeFraction} from './PrettySummaryPanel';
import {normalizeWeather,weatherDay,weatherIsDay,weatherCondition,weatherForecastUrl,DEFAULT_WEATHER_LOCATION,getWeatherJson} from './prettyWeather';

describe('availability and weather acceptance',()=>{
  test('TRMNL current to next: strict overlaps, back-to-back, all-day and instant excluded',()=>{
    const t=(hour:number,minute=0)=>new Date(2026,10,25,hour,minute).toISOString();
    const agenda=agendaFromFeed(feed([event('A',t(9),t(11)),event('B',t(10),t(12)),event('C',t(12),t(13)),event('D',t(15),t(16)),event('Instant',t(17),t(17)),event('Holiday','2026-11-25','2026-11-26',true)]));
    const at=(h:number,m=0)=>availability(agenda,new Date(2026,10,25,h,m));
    expect(at(8)).toEqual([{kind:'free',minutes:60},{kind:'busy',minutes:180}]);
    expect(at(10,30)).toEqual([{kind:'busy',minutes:90,left:true},{kind:'busy',minutes:60}]);
    expect(at(12)).toEqual([{kind:'busy',minutes:60,left:true},{kind:'free',minutes:120}]);
    expect(at(15)).toEqual([{kind:'busy',minutes:60,left:true},{kind:'rest'}]);
    expect(at(16)).toEqual([{kind:'rest'},{kind:'art'}]);
    expect(at(17)).toEqual([{kind:'rest'},{kind:'art'}]);
    expect(minuteLabel(210)).toBe('3h 30m');
    expect(availability(agenda,new Date(2026,10,25,14),['D'])).toEqual([{kind:'rest'},{kind:'art'}]);
  });
  test('temperature gauge clamps readings and handles equal high and low',()=>{
    expect(gaugeFraction(46,45,54)).toBeCloseTo(1/9);
    expect(gaugeFraction(40,45,54)).toBe(0);
    expect(gaugeFraction(60,45,54)).toBe(1);
    expect(gaugeFraction(45,45,45)).toBe(.5);
  });
  test('daily high and low follow location day and sunset changes icons independently of theme',()=>{
    const midnight=1795582800,sunrise=midnight+7*3600,sunset=midnight+17*3600;
    const raw={current:{temperature_2m:60,weather_code:0,time:sunrise,is_day:1,wind_speed_10m:5},daily:{time:[midnight,midnight+86400],temperature_2m_max:[65,70],temperature_2m_min:[40,45],sunrise:[sunrise,sunrise+86400],sunset:[sunset,sunset+86400]}};
    const s=normalizeWeather(raw,DEFAULT_WEATHER_LOCATION,sunrise*1000);
    expect(s.current).toBe(60);expect(weatherDay(s,sunrise*1000)?.high).toBe(65);expect(weatherDay(s,sunrise*1000)?.low).toBe(40);
    expect(weatherIsDay(s,sunrise*1000-1)).toBe(false);expect(weatherIsDay(s,sunrise*1000)).toBe(true);expect(weatherIsDay(s,sunset*1000)).toBe(false);
    expect(weatherDay(s,(midnight+86400)*1000)?.high).toBe(70);
    expect(weatherForecastUrl(DEFAULT_WEATHER_LOCATION)).toContain('temperature_unit=fahrenheit');
    expect(()=>normalizeWeather({...raw,daily:{...raw.daily,temperature_2m_min:[80,45]}},DEFAULT_WEATHER_LOCATION)).toThrow();
  });
  test('Open-Meteo native fallback is used for network failures, not HTTP client errors',async()=>{
    const native=NativeModules.DashboardNative;
    const oldFetch=global.fetch,oldNative=native.fetchOpenMeteoJson;
    const url=weatherForecastUrl(DEFAULT_WEATHER_LOCATION);
    native.fetchOpenMeteoJson=jest.fn(async()=>JSON.stringify({ok:true}));
    try{
      global.fetch=jest.fn(async()=>{throw new Error('Network request failed');}) as any;
      await expect(getWeatherJson(url)).resolves.toEqual({ok:true});
      expect(native.fetchOpenMeteoJson).toHaveBeenCalledWith(url);
      (native.fetchOpenMeteoJson as jest.Mock).mockClear();
      global.fetch=jest.fn(async()=>({ok:false,status:400})) as any;
      await expect(getWeatherJson(url)).rejects.toThrow('Weather HTTP 400');
      expect(native.fetchOpenMeteoJson).not.toHaveBeenCalled();
    }finally{global.fetch=oldFetch;native.fetchOpenMeteoJson=oldNative;}
  });
  test('all WMO weather codes have a recognized mapping',()=>{
    for(const code of [0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99])expect(weatherCondition(code).condition).not.toBe('unavailable');
    expect(weatherCondition(0,28).condition).toBe('windy');expect(weatherCondition(99).hail).toBe(true);expect(weatherCondition(-1).condition).toBe('unavailable');
  });
});

import {GRAYSCALE,INK,PAPER,DARK_GRAY,LIGHT_GRAY} from './prettyPalette';
test('16-level grayscale targets are evenly spaced and UI colors are members',()=>{
 expect(GRAYSCALE).toHaveLength(16);
 expect(GRAYSCALE.map(c=>parseInt(c.slice(1,3),16))).toEqual(Array.from({length:16},(_,i)=>i*17));
 for(const color of [INK,PAPER,DARK_GRAY,LIGHT_GRAY])expect(GRAYSCALE).toContain(color);
});

import {rockyPhrase,ROCKY_PHRASES} from './prettyRocky';
test('all four Rocky phrases are selected by the random draw',()=>{
 expect([0,.25,.5,.75].map(n=>rockyPhrase(()=>n))).toEqual([...ROCKY_PHRASES]);
});
import {normalizeAutomaticLocation} from './prettyWeather';
test('automatic location uses detected city and coordinates, excludes IP, rejects errors',()=>{
 expect(normalizeAutomaticLocation({ip:'192.0.2.1',city:'Example',region:'State',country_code:'US',latitude:35,longitude:-80})).toEqual({name:'Example, State, US',latitude:35,longitude:-80});
 expect(()=>normalizeAutomaticLocation({error:true,city:'Example',latitude:35,longitude:-80})).toThrow();
 expect(()=>normalizeAutomaticLocation({city:'Example',latitude:91,longitude:-80})).toThrow();
});
test('visible row shading uses the next darker level after Manta rejected #EEEEEE',()=>expect(LIGHT_GRAY).toBe('#DDDDDD'));
