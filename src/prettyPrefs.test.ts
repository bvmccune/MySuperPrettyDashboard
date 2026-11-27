jest.mock('sn-plugin-lib',()=>({PluginManager:{}}));
jest.mock('react-native',()=>({NativeModules:{DashboardNative:{}}}));
import {DEFAULT_PRETTY,normalPretty,QUICK_ICONS} from './prettyPrefs';

describe('SmartyNote preference migration',()=>{
  it('defaults to only live settings',()=>{
    const result=normalPretty(null);
    expect(result.size).toBe('normal');
    expect(Object.keys(result).sort()).toEqual(['favorites','quick','size']);
  });
  it('preserves saved links while dropping retired settings',()=>{
    const p=normalPretty({shortcuts:['calendar','files','favorites','search','stars','last-note'],
      size:'large',quick:[{kind:'note-last',path:'/storage/emulated/0/Note/Demo.note',label:'Demo'}],
      bubbleSpot:'top-right',starPreview:'text',noteMode:'standard'});
    expect(p.quick).toHaveLength(1);expect(p.size).toBe('large');
    for(const key of ['shortcuts','starPreview','bubbleSpot','noteMode'])expect(p).not.toHaveProperty(key);
  });
});

it('drops retired weather and work hours settings',()=>{
  const prefs=normalPretty({size:'large',weatherLocation:{name:'Custom',latitude:40,longitude:-75},workHours:{start:'08:30',end:'16:30'}});
  expect(prefs.size).toBe('large');expect(prefs).not.toHaveProperty('weatherLocation');expect(prefs).not.toHaveProperty('workHours');
});
it('persists the Stars shortcut as a separate destination',()=>{
  expect(normalPretty({quick:[{kind:'note-last',path:'app:stars',label:'Stars'}]}).quick).toEqual([{kind:'note-last',path:'app:stars',label:'Stars',icon:'stars'}]);
});

it('preserves Calendar link and custom icon',()=>{
 const pin={kind:'note-last',path:'app:calendar',label:'My calendar',icon:'calendar'};
 expect(normalPretty({quick:[pin]}).quick).toEqual([pin]);
});

it('enforces the twelve approved quick access icons and migrates disallowed choices',()=>{
 expect(QUICK_ICONS).toEqual(['files','stars','stars-filled','keywords','recent','refresh','calendar-dot','auto-refresh','calendar','new-note','notebook','open-notebook']);
 const p=normalPretty({quick:[{kind:'note-last',label:'A',path:'/storage/emulated/0/Note/A.note',icon:'stardust'},{kind:'folder',label:'B',path:'/storage/emulated/0/Note/B',icon:'star-filled'}]});
 expect(p.quick.map(x=>x.icon)).toEqual(['notebook','files']);
});

it('preserves the filled star through preference normalization',()=>{
 const pin={kind:'folder',path:'/storage/emulated/0/Note/Project',label:'Project',icon:'stars-filled'};
 expect(normalPretty({quick:[pin]}).quick).toEqual([pin]);
});
