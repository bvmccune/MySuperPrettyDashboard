jest.mock('sn-plugin-lib',()=>({PluginManager:{}}));
jest.mock('react-native',()=>({NativeModules:{DashboardNative:{}}}));
import {ACTIONS,DEFAULT_PRETTY,normalPretty,QUICK_ICONS} from './prettyPrefs';

describe('Manta-specific settings migration',()=>{
  it('defaults to approved four shortcuts and medium typography',()=>{
    const result=normalPretty(null);
    expect(result.shortcuts).toEqual(['refresh','settings','calendar','search']);
    expect(result.size).toBe('normal');
    expect(ACTIONS.map(a=>a.key)).not.toContain('stars');
    expect(ACTIONS.map(a=>a.key)).not.toContain('last-note');
    expect(ACTIONS.map(a=>a.key)).not.toContain('cloud-sync');
    expect(ACTIONS.map(a=>a.key)).not.toContain('last-saved-note');
    expect(ACTIONS.find(a=>a.key==='files')?.name).toBe('Notes folder');
  });
  it('migrates the six-button layout without losing Quick Access',()=>{
    const saved={shortcuts:['calendar','files','favorites','search','stars','last-note'],
      size:'large',quick:[{kind:'note-last',path:'/storage/emulated/0/Note/Demo.note',label:'Demo'}],
      bubbleSpot:'top-right',starPreview:'text'};
    const p=normalPretty(saved);
    expect(p.shortcuts).toEqual(['refresh','settings','calendar','search']);
    expect(p.quick).toHaveLength(1);
    expect(p.size).toBe('large');
    expect(Object.keys(p)).not.toContain('starPreview');
    expect(Object.keys(p)).not.toContain('bubbleSpot');
    expect(Object.keys(p)).not.toContain('noteMode');
  });
  it('rejects invalid shortcuts without changing list length',()=>{
    const p=normalPretty({shortcuts:['calendar','fake','todo','bad',null]});
    expect(p.shortcuts).toHaveLength(4);
    expect(p.shortcuts).not.toContain('fake');
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

it('enforces exactly the eleven approved quick access icons and migrates disallowed choices',()=>{
 expect(QUICK_ICONS).toEqual(['files','stars','keywords','recent','refresh','calendar-dot','auto-refresh','calendar','new-note','notebook','open-notebook']);
 const p=normalPretty({quick:[{kind:'note-last',label:'A',path:'/storage/emulated/0/Note/A.note',icon:'stardust'},{kind:'folder',label:'B',path:'/storage/emulated/0/Note/B',icon:'star-filled'}]});
 expect(p.quick.map(x=>x.icon)).toEqual(['notebook','files']);
});
