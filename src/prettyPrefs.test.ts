jest.mock('sn-plugin-lib',()=>({PluginManager:{}}));
jest.mock('react-native',()=>({NativeModules:{DashboardNative:{}}}));
import {ACTIONS,DEFAULT_PRETTY,normalPretty} from './prettyPrefs';

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

 it('migrates weather and working hours without altering existing preferences',()=>{
  const prefs=normalPretty({size:'large',weatherLocation:{name:'Custom',latitude:40,longitude:-75},workHours:{start:'08:30',end:'16:30'}});
  expect(prefs.weatherLocation.name).toBe('Custom');expect(prefs.workHours).toEqual({start:'08:30',end:'16:30'});
  expect(normalPretty({workHours:{start:'17:00',end:'09:00'}}).workHours).toEqual(DEFAULT_PRETTY.workHours);
  expect(normalPretty({weatherLocation:{name:'Invalid',latitude:200,longitude:0}}).weatherLocation).toEqual(DEFAULT_PRETTY.weatherLocation);
});
