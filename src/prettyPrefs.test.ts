jest.mock('react-native',()=>({NativeModules:{DashboardNative:{}}}));
import {ACTIONS,DEFAULT_PRETTY,normalPretty} from './prettyPrefs';

describe('Manta-specific settings migration',()=>{
  it('defaults to approved six shortcuts and medium typography',()=>{
    const result=normalPretty(null);
    expect(result.shortcuts).toEqual(['refresh','settings','calendar','search','cloud-sync','last-saved-note']);
    expect(result.size).toBe('normal');
    expect(ACTIONS.map(a=>a.key)).not.toContain('stars');
    expect(ACTIONS.find(a=>a.key==='files')?.name).toBe('Notes folder');
  });
  it('migrates the six-button layout without losing Quick Access',()=>{
    const saved={shortcuts:['calendar','files','favorites','search','stars','last-note'],
      size:'large',quick:[{kind:'note-last',path:'/storage/emulated/0/Note/Demo.note',label:'Demo'}],
      bubbleSpot:'top-right',starPreview:'text'};
    const p=normalPretty(saved);
    expect(p.shortcuts).toEqual(['refresh','settings','calendar','search','cloud-sync','last-saved-note']);
    expect(p.quick).toHaveLength(1);
    expect(p.size).toBe('large');
    expect(Object.keys(p)).not.toContain('starPreview');
    expect(Object.keys(p)).not.toContain('bubbleSpot');
    expect(Object.keys(p)).not.toContain('noteMode');
  });
  it('rejects invalid shortcuts without changing list length',()=>{
    const p=normalPretty({shortcuts:['calendar','fake','todo','bad',null]});
    expect(p.shortcuts).toHaveLength(6);
    expect(p.shortcuts).not.toContain('fake');
  });
});

it('appends the two new actions without disturbing four existing shortcuts',()=>{
  const p=normalPretty({shortcuts:['search','settings','calendar','refresh']});
  expect(p.shortcuts).toEqual(['search','settings','calendar','refresh','cloud-sync','last-saved-note']);
  expect(normalPretty(p)).toEqual(p);
});
