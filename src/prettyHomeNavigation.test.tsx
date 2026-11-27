/** Regression: Home must not rescan unchanged files while preferences load. */
jest.mock('react-native',()=>{
  const listeners=new Map<string,Set<(value:any)=>void>>();
  return {
    NativeModules:{DashboardNative:{
      hideBubble:jest.fn(async()=>true),
      getBattery:jest.fn(async()=>({level:70,charging:false})),
      getNetworkStatus:jest.fn(async()=>({wifi:true})),
      listDir:jest.fn(),
      secureLoadCalendarUrl:jest.fn(async()=>''),
      readPrivateCalendarSnapshot:jest.fn(async()=>''),
    }},
    AppState:{currentState:'active',addEventListener:jest.fn(()=>({remove:()=>{}}))},
    DeviceEventEmitter:{
      addListener:(event:string,fn:(value:any)=>void)=>{
        if(!listeners.has(event))listeners.set(event,new Set());
        listeners.get(event)!.add(fn);
        return {remove:()=>listeners.get(event)?.delete(fn)};
      },
      emit:(event:string,value:any)=>listeners.get(event)?.forEach(fn=>fn(value)),
    },
    View:'View',Text:'Text',TouchableOpacity:'TouchableOpacity',ScrollView:'ScrollView',
    Image:'Image',Modal:'Modal',TextInput:'TextInput',
    StyleSheet:{create:(styles:any)=>styles},
    useColorScheme:()=> 'light',
    useWindowDimensions:()=>({width:760,height:950}),
  };
});
jest.mock('sn-plugin-lib',()=>({PluginManager:{},
  PluginCommAPI:{getNoteSystemTemplates:jest.fn(async()=>[
    {name:'style_white',vUri:'white'},{name:'style_list_format',vUri:'list'},
    {name:'style_arabic_line_ruling',vUri:'arabic'},{name:'style_task_list',vUri:'task'},
    {name:'style_5mm_grid',vUri:'grid'},
  ])},PluginFileAPI:{createNote:jest.fn(async()=>({success:true,result:true}))}}));
jest.mock('./config',()=>({loadConfig:jest.fn(async()=>({zones:[]}))}));
jest.mock('./perf',()=>({markOpen:jest.fn(),ready:jest.fn()}));
jest.mock('./bubble',()=>({leavePlugin:jest.fn()}));
jest.mock('./open',()=>({openFile:jest.fn(),openVerifiedTaskPage:jest.fn(async()=>true),openFolder:jest.fn(),launchApp:jest.fn(),openNativeSettings:jest.fn(),openCalendarToday:jest.fn()}));
jest.mock('./scanner',()=>({scanKeywords:jest.fn(),scanStars:jest.fn(async()=>({notes:[{file:'/storage/emulated/0/Note/Example.note',mtime:1,pages:[{page:3,count:2}]}],truncated:false,total:1}))}));
jest.mock('./relay',()=>({dayKey:jest.fn(),dueBucket:jest.fn(()=> 'none')}));
jest.mock('./recent',()=>({readRecentDetailed:jest.fn(async()=>({
  paths:['/storage/emulated/0/Note/Project/Example.note'],mode:'opened',
}))}));
jest.mock('./prettyCloud',()=>({
  hasSupernoteLogin:jest.fn(async()=>false),
  readNativeSupernoteTasks:jest.fn(async()=>({tasks:[],truncated:false})),
  updateNativeTodo:jest.fn(async()=>{}),
}));
jest.mock('./prettyPrefs',()=>({
  ...jest.requireActual('./prettyPrefs'),
  loadPrettyPrefs:jest.fn(),
  savePrettyPrefs:jest.fn(async()=>true),
}));

import React from 'react';
import {act,create,ReactTestRenderer} from 'react-test-renderer';
import {NativeModules} from 'react-native';
import App from '../App';
import {PrettyNoteCreate,defaultNoteName,templateLabel} from './PrettyNoteCreate';
import {PluginFileAPI} from 'sn-plugin-lib';
import {setRoute,getRoute} from './route';
import {DEFAULT_PRETTY,loadPrettyPrefs,PrettyPrefs} from './prettyPrefs';
import {PrettyHome} from './PrettyHome';
import {PrettySettings} from './PrettySettings';
import {launchApp,openNativeSettings,openCalendarToday,openFile} from './open';
import {dueBucket} from './relay';
import {readNativeSupernoteTasks,updateNativeTodo} from './prettyCloud';
import {HomeAgendaList,scheduleBounds} from './PrettyAgenda';
import {PrettyFitList} from './PrettyFitList';
import {agendaFromFeed,normalizeFeed,dateKey,dayLabel,addCalendarDays,loadCalendarCache} from './prettyCalendar';

const native=NativeModules.DashboardNative;
const load=loadPrettyPrefs as jest.MockedFunction<typeof loadPrettyPrefs>;
const list=native.listDir as jest.Mock;
const project='/storage/emulated/0/Note/Project';
let app:ReactTestRenderer|undefined;
let finishPrefs:(prefs:PrettyPrefs)=>void;
let pending:Array<(items:any[])=>void>;

function doneButton(){
  return app!.root.findAllByType('TouchableOpacity' as any).find(node=>
    node.props.accessibilityLabel==='Done · Save and return')!;
}

beforeEach(()=>{
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
  setRoute('config');
  load.mockReset();
  list.mockReset();
  pending=[];
  list.mockImplementation((dir:string)=>dir===project
    ? new Promise<any[]>(resolve=>pending.push(resolve))
    : Promise.resolve([]));
});
afterEach(async()=>{
  if(app)await act(async()=>{app!.unmount();});
  app=undefined;
});

it('returns from real Settings and does not repeat metadata reads while Home preferences are pending',async()=>{
  const delayed=new Promise<PrettyPrefs>(resolve=>{finishPrefs=resolve;});
  load.mockResolvedValueOnce(DEFAULT_PRETTY) // Settings initial load
    .mockResolvedValueOnce(DEFAULT_PRETTY) // Done read-back
    .mockReturnValue(delayed); // Home initial load (including nonce refresh)
  await act(async()=>{app=create(<App/>);});
  expect(app!.root.findByType(PrettySettings)).toBeTruthy();
  await act(async()=>{await doneButton().props.onPress();});
  expect(getRoute()).toBe('dashboard');
  expect(app!.root.findByType(PrettyHome)).toBeTruthy();
  const readsBefore=list.mock.calls.filter(([dir])=>dir===project).length;
  expect(readsBefore).toBeGreaterThan(0);
  await act(async()=>{
    pending.splice(0).forEach(resolve=>resolve([{path:project+'/Example.note',mtime:123}]));
  });
  // The resulting metadata state update must NOT trigger another lookup
  // merely because the as-yet-unloaded pinned array is empty.
  expect(list.mock.calls.filter(([dir])=>dir===project)).toHaveLength(readsBefore);
  await act(async()=>{finishPrefs(DEFAULT_PRETTY);});
  expect(app!.root.findByType(PrettyHome)).toBeTruthy();
  await act(async()=>{
    app!.root.findAllByType('TouchableOpacity' as any)
      .find(node=>node.props.accessibilityLabel==='Settings')!.props.onPress();
  });
  expect(getRoute()).toBe('config');
  expect(app!.root.findByType(PrettySettings)).toBeTruthy();
});

it('keeps Settings open and displays an error when read-back fails verification',async()=>{
  load.mockResolvedValueOnce(DEFAULT_PRETTY)
    .mockResolvedValueOnce({...DEFAULT_PRETTY,size:'extra'});
  await act(async()=>{app=create(<App/>);});
  await act(async()=>{await doneButton().props.onPress();});
  expect(getRoute()).toBe('config');
  expect(app!.root.findAllByType('Text' as any).some(t=>
    String(t.props.children).includes('Settings save failed: Saved settings differ'))).toBe(true);
});

it('shows native-style New Note controls and passes selected orientation and template to the SDK',async()=>{
  const onClose=jest.fn();
  await act(async()=>{app=create(<PrettyNoteCreate onClose={onClose}/>);});
  const touch=(label:string)=>app!.root.findAllByType('TouchableOpacity' as any).find(node=>
    node.props.accessibilityLabel===label||node.findAllByType('Text' as any).some(t=>t.props.children===label))!;
  expect(defaultNoteName(new Date(2026,10,25,3,5,46))).toBe('20261125_030546');
  expect(templateLabel('style_arabic_line_ruling')).toBe('Arabic lined ruling');
  expect(touch('Cancel')).toBeTruthy();
  expect(touch('Create')).toBeTruthy();
  await act(async()=>{touch('View All ›').props.onPress();});
  await act(async()=>{touch('5 mm grid').props.onPress();});
  await act(async()=>{touch('Horizontal').props.onPress();});
  await act(async()=>{app!.root.findByType('TextInput' as any).props.onChangeText('Test-native');});
  await act(async()=>{await touch('Create').props.onPress();});
  expect(PluginFileAPI.createNote).toHaveBeenCalledWith({notePath:'/storage/emulated/0/Note/Test-native.note',
    template:'style_5mm_grid',mode:1,isPortrait:false});
  expect(onClose).toHaveBeenCalled();
});

it('calculates +N from measured rows and includes conflicts with events omitted from Home',async()=>{
  const at=(h:number,m=0)=>new Date(2026,10,26,h,m).toISOString();
  const rows=agendaFromFeed(normalizeFeed({events:[
    {summary:'A',start:at(9),end:at(10),all_day:false,calendar:'Work'},
    {summary:'B long title',start:at(9,30),end:at(10,30),all_day:false,calendar:'Work'},
    {summary:'C',start:at(11),end:at(12),all_day:false,calendar:'Work'},
  ]}));
  const onEvent=jest.fn();
  await act(async()=>{app=create(<HomeAgendaList events={rows} scale={1} fontBoost={1} initialHeight={60}
    header={n=>React.createElement('Text',{},'+'+n)} onEvent={onEvent} empty={null}/>);});
  await act(async()=>{
    const nodes=app!.root.findAll(node=>typeof node.type==='string'&&String(node.props.testID).startsWith('measure-event-'));
    expect(nodes).toHaveLength(2);
    nodes.forEach((node,i)=>node.props.onLayout({nativeEvent:{layout:{height:i===0?34:55}}}));
  });
  expect(app!.root.findAllByType('Text' as any).some(n=>n.props.children==='+2')).toBe(true);
  const body=app!.root.findByProps({testID:'home-agenda-body'});
  const buttons=body.findAllByType('TouchableOpacity' as any);
  const visible=buttons[buttons.length-1];
  expect(visible.props.accessibilityLabel).toContain('A.');
  expect(visible.props.accessibilityLabel).toContain('Conflicts with another appointment');
  await act(async()=>{visible.props.onPress();});
  expect(onEvent).toHaveBeenCalledWith(rows[0]);
});
it('calendar shortcut opens native calendar; dashboard agenda remains separate',async()=>{
  const today=new Date(),todayKey=dateKey(today);
  const start=new Date(today.getFullYear(),today.getMonth(),today.getDate(),9);
  const end=new Date(start.getTime()+3600000);
  const sample={summary:'Calendar acceptance fixture',start:start.toISOString(),end:end.toISOString(),all_day:false,calendar:'Work'};
  native.readPrivateCalendarSnapshot.mockResolvedValueOnce(JSON.stringify({schema:1,fetchedAt:Date.now(),feed:{events:[sample]}}));
  await loadCalendarCache();
  load.mockResolvedValue(DEFAULT_PRETTY);
  await act(async()=>{app=create(<PrettyHome config={null} nonce={0} onSettings={()=>{}}/>);});
  const touch=(label:string)=>app!.root.findAllByType('TouchableOpacity' as any).find(n=>n.props.accessibilityLabel===label)!;
  const day=new Date(today);day.setDate(today.getDate()+(today.getDay()===0?-1:1));
  await act(async()=>{touch('Select '+day.toDateString()).props.onPress();});
  const selectedHeading=dayLabel(dateKey(day));
  const selectedEventHeading=dayLabel(dateKey(day))+' Events';
  expect(app!.root.findAllByType('Text' as any).some(n=>(Array.isArray(n.props.children)?n.props.children.join(''):n.props.children)===selectedHeading)).toBe(true);
  expect(app!.root.findAllByType('Text' as any).some(n=>n.props.children===selectedEventHeading)).toBe(true);
  await act(async()=>{touch('Calendar').props.onPress();});
  expect(openCalendarToday).toHaveBeenCalled();
  await act(async()=>{touch('View all events').props.onPress();});
  await act(async()=>{touch('Today').props.onPress();});
  // React represents the two JSX date expressions and intervening text as
  // separate children. Compare the visible text, not their array identity.
  const showsRange=(first:string)=>app!.root.findAllByType('Text' as any).some(n=>{
    const children=n.props.children;
    const rendered=Array.isArray(children)?children.join(''):children;
    return rendered===dayLabel(first)+' – '+dayLabel(addCalendarDays(first,6));
  });
  expect(showsRange(todayKey)).toBe(true);
  await act(async()=>{touch('Previous seven days').props.onPress();});
  expect(showsRange(addCalendarDays(todayKey,-7))).toBe(true);
  await act(async()=>{touch('Today').props.onPress();});
  expect(showsRange(todayKey)).toBe(true);
  const event=app!.root.findAllByType('TouchableOpacity' as any).find(n=>String(n.props.accessibilityLabel).includes('Calendar acceptance fixture')&&String(n.props.accessibilityLabel).includes('Select for event details'))!;
  expect(event).toBeTruthy();
  await act(async()=>{event.props.onPress();});
  expect(app!.root.findAllByType('Text' as any).some(n=>n.props.children==='Event details')).toBe(true);
  expect(app!.root.findAllByType('Text' as any).some(n=>(Array.isArray(n.props.children)?n.props.children.join(''):n.props.children)===selectedHeading)).toBe(true);
  expect(app!.root.findAllByType('Text' as any).some(n=>n.props.children===selectedEventHeading)).toBe(true);
  await act(async()=>{touch('Back').props.onPress();});
  expect(app!.root.findAllByType('Text' as any).some(n=>n.props.children==='Seven-day agenda')).toBe(true);
});

it('fits complete wrapped rows after actual layout measurement',async()=>{
  await act(async()=>{app=create(<PrettyFitList items={['one','two','three']}
    keyOf={x=>x} renderRow={x=>React.createElement('Text',{},x)}
    minHeight={38} maxHeight={85} initialHeight={100} empty={null}/>);});
  await act(async()=>{
    const rows=app!.root.findAll(n=>typeof n.type==='string'&&String(n.props.testID).startsWith('fit-measure-'));
    expect(rows).toHaveLength(3);
    rows.forEach((n,i)=>n.props.onLayout({nativeEvent:{layout:{height:[38,61,38][i]}}}));
  });
  const count=(value:string)=>app!.root.findAllByType('Text' as any).filter(n=>n.props.children===value).length;
  expect(count('one')).toBe(2);
  expect(count('two')).toBe(2);
  expect(count('three')).toBe(1);
});

it('schedule extends only for timed events and merges overlaps',()=>{
  const day='2026-11-26',at=(h:number)=>new Date(2026,10,26,h).toISOString();
  const events=agendaFromFeed(normalizeFeed({events:[{summary:'Holiday',start:day,end:'2026-11-27',all_day:true,calendar:'Work'},{summary:'Early',start:at(7),end:at(9),all_day:false,calendar:'Work'},{summary:'Overlap',start:at(8),end:at(10),all_day:false,calendar:'Work'},{summary:'Late',start:at(18),end:at(20),all_day:false,calendar:'Work'}]}));
  const rail=scheduleBounds(day,events);
  expect(new Date(rail.start).getHours()).toBe(7);expect(new Date(rail.end).getHours()).toBe(20);expect(rail.merged).toHaveLength(2);
});

it('distinguishes true overlaps from exact back-to-back boundaries',()=>{
  const day='2026-11-26',at=(h:number,m=0)=>new Date(2026,10,26,h,m).toISOString();
  const events=agendaFromFeed(normalizeFeed({events:[
    {summary:'A',start:at(11,45),end:at(12,45),all_day:false,calendar:'Work'},
    {summary:'B',start:at(12),end:at(13),all_day:false,calendar:'Work'},
    {summary:'C',start:at(13),end:at(14),all_day:false,calendar:'Work'},
    {summary:'D',start:at(14),end:at(15),all_day:false,calendar:'Work'},
  ]}));
  const rail=scheduleBounds(day,events);
  expect(rail.overlaps).toEqual([{start:Date.parse(at(12)),end:Date.parse(at(12,45))}]);
  expect(rail.dividers).toEqual([Date.parse(at(13)),Date.parse(at(14))]);
  expect(rail.merged).toHaveLength(1);
});

it('routes completion and long press editing to the real-task write bridge',async()=>{
  const task={id:'abc',title:'Test task',due:null,detail:'',listId:'one'};
  const read=readNativeSupernoteTasks as jest.Mock;
  read.mockResolvedValue({tasks:[task],truncated:false});
  load.mockResolvedValue(DEFAULT_PRETTY);
  await act(async()=>{app=create(<PrettyHome config={null} nonce={0} onSettings={()=>{}}/>);});
  const touch=(label:string)=>app!.root.findAllByType('TouchableOpacity' as any).find(n=>n.props.accessibilityLabel===label)!;
  await act(async()=>{touch('Open task Test task; long press to edit').props.onLongPress();});
  const input=app!.root.findAllByType('TextInput' as any)[0];
  await act(async()=>{input.props.onChangeText('Changed task');});
  await act(async()=>{await touch('Save').props.onPress();});
  expect(updateNativeTodo).toHaveBeenCalledWith('abc',{title:'Changed task'});
  read.mockResolvedValue({tasks:[],truncated:false});
  await act(async()=>{await touch('Complete Test task').props.onPress();});
  expect(updateNativeTodo).toHaveBeenCalledWith('abc',{complete:true});
  expect(touch('Complete Test task')).toBeUndefined();
  read.mockResolvedValue({tasks:[],truncated:false});
});

it('opens real Stars results from a pinned Stars destination',async()=>{
  load.mockResolvedValue({...DEFAULT_PRETTY,quick:[{kind:'note-last',path:'app:stars',label:'Stars',icon:'stars'}]});
  await act(async()=>{app=create(<PrettyHome config={null} nonce={0} onSettings={()=>{}}/>);});
  const pin=app!.root.findAllByType('TouchableOpacity' as any).find(n=>n.findAllByType('Text' as any).some(t=>t.props.children==='Stars'))!;
  await act(async()=>{pin.props.onPress();});
  const result=app!.root.findAllByType('TouchableOpacity' as any).find(n=>String(n.props.accessibilityLabel).includes('Open Example page 3'))!;
  expect(result).toBeTruthy();
  await act(async()=>{result.props.onPress();});
  expect(openFile).toHaveBeenCalledWith('/storage/emulated/0/Note/Example.note',3);
});

it('puts the black OVERDUE badge above the due date in each task row',async()=>{
  const read=readNativeSupernoteTasks as jest.Mock;
  const bucket=dueBucket as jest.Mock;
  bucket.mockReturnValue('overdue');
  read.mockResolvedValue({tasks:[{id:'overdue-fixture',title:'Overdue test',due:'2026-11-24',detail:'',listId:'one'}],truncated:false});
  load.mockResolvedValue(DEFAULT_PRETTY);
  try{
    await act(async()=>{app=create(<PrettyHome config={null} nonce={0} onSettings={()=>{}}/>);});
    const text=app!.root.findAllByType('Text' as any).map(n=>n.props.children);
    const badge=text.indexOf('OVERDUE'),date=text.indexOf('11/24');
    expect(badge).toBeGreaterThanOrEqual(0);expect(date).toBeGreaterThan(badge);
  }finally{bucket.mockReturnValue('none');read.mockResolvedValue({tasks:[],truncated:false});}
});

it('uses an icon-only Search button that launches native Global Search',async()=>{
  load.mockResolvedValue(DEFAULT_PRETTY);
  await act(async()=>{app=create(<PrettyHome config={null} nonce={0} onSettings={()=>{}}/>);});
  const buttons=app!.root.findAllByType('TouchableOpacity' as any);
  const search=buttons.find(n=>n.props.accessibilityLabel==='Search')!;
  const note=buttons.find(n=>n.props.accessibilityLabel==='Choose note name, type, template')!;
  expect(search).toBeTruthy();expect(note).toBeTruthy();
  expect(buttons.indexOf(search)).toBeLessThan(buttons.indexOf(note));
  expect(search.findAllByType('Text' as any)).toHaveLength(0);
  await act(async()=>{search.props.onPress();});
  expect(launchApp).toHaveBeenCalledWith('com.ratta.search/com.ratta.search.MainActivity');
});

it('matches original TRMNL conflict geometry at every display scale',async()=>{
  const {Conflict,CONFLICT_MARKER}=require('./PrettyAgenda');
  expect(CONFLICT_MARKER).toEqual({diameter:12,overlap:2,width:23,height:13});
  for(const scale of [1,1.5]){
    await act(async()=>{app=create(<Conflict scale={scale}/>);});
    const first=app!.root.findAll(n=>typeof n.type==='string'&&n.props.testID==='conflict-dot-first')[0];
    const second=app!.root.findAll(n=>typeof n.type==='string'&&n.props.testID==='conflict-dot-second')[0];
    expect(first.props.style.width).toBe(12*scale);
    expect(first.props.style.height).toBe(12*scale);
    expect(second.props.style.marginLeft).toBe(-2*scale);
    expect(second.props.style.backgroundColor).toBe('#000');
  }
});

it('edits a real task due date through the calendar picker, saving only after task Save',async()=>{
  const read=readNativeSupernoteTasks as jest.Mock;
  read.mockResolvedValue({tasks:[{id:'date-task',title:'Date test',due:'2026-11-24',detail:'',listId:'one'}],truncated:false});
  load.mockResolvedValue(DEFAULT_PRETTY);
  await act(async()=>{app=create(<PrettyHome config={null} nonce={0} onSettings={()=>{}}/>);});
  const touch=(label:string)=>app!.root.findAllByType('TouchableOpacity' as any).find(n=>n.props.accessibilityLabel===label)!;
  await act(async()=>{touch('Open task Date test; long press to edit').props.onLongPress();});
  await act(async()=>{touch('Choose due date').props.onPress();});
  await act(async()=>{touch('2026-11-25').props.onPress();});
  await act(async()=>{touch('Save').props.onPress();});
  expect(touch('Choose due date')).toBeTruthy();
  await act(async()=>{await touch('Save').props.onPress();});
  expect(updateNativeTodo).toHaveBeenCalledWith('date-task',{due:'2026-11-25'});
  read.mockResolvedValue({tasks:[],truncated:false});
});
it('calendar picker month cells include Monday-first and leap day',()=>{
  const {monthCells}=require('./PrettyTaskDatePicker');
  const cells=monthCells(2024,1);
  expect(cells[0]).toBe('2024-01-29');
  expect(cells).toContain('2024-02-29');
  expect(cells).toHaveLength(42);
});

it('places Stardust native Settings before Search, distinct from plugin Settings',async()=>{
  load.mockResolvedValue(DEFAULT_PRETTY);
  const onSettings=jest.fn();
  await act(async()=>{app=create(<PrettyHome config={null} nonce={0} onSettings={onSettings}/>);});
  const buttons=app!.root.findAllByType('TouchableOpacity' as any);
  const profile=buttons.find(n=>n.props.accessibilityLabel==='Supernote Settings')!;
  const search=buttons.find(n=>n.props.accessibilityLabel==='Search')!;
  const gear=buttons.find(n=>n.props.accessibilityLabel==='Settings')!;
  expect(profile).toBeTruthy();expect(buttons.indexOf(profile)).toBeLessThan(buttons.indexOf(search));
  await act(async()=>{profile.props.onPress();});
  expect(openNativeSettings).toHaveBeenCalled();expect(onSettings).not.toHaveBeenCalled();
  await act(async()=>{gear.props.onPress();});
  expect(onSettings).toHaveBeenCalled();
});

it('fits Quick access in measured complete rows beyond six, with exact pin-only overflow',async()=>{
  const pins=Array.from({length:20},(_,i)=>({kind:'folder' as const,path:'/storage/emulated/0/Note/Folder'+i,label:'Folder '+i,icon:'files' as const}));
  load.mockResolvedValue({...DEFAULT_PRETTY,quick:pins});
  await act(async()=>{app=create(<PrettyHome config={null} nonce={0} onSettings={()=>{}}/>);});
  const body=app!.root.findAll(n=>typeof n.type==='string'&&n.props.testID==='quick-fit-body')[0];
  await act(async()=>{body.props.onLayout({nativeEvent:{layout:{height:260}}});});
  const measurements=()=>app!.root.findAll(n=>typeof n.type==='string'&&String(n.props.testID).startsWith('fit-measure-quick-'));
  await act(async()=>{measurements().forEach(n=>n.props.onLayout({nativeEvent:{layout:{height:36}}}));});
  const visible=()=>app!.root.findAll(n=>typeof n.type==='string'&&String(n.props.testID).startsWith('fit-visible-quick-'));
  const count=(label:string)=>app!.root.findAll(n=>typeof n.type==='string'&&n.props.accessibilityLabel===label).length;
  expect(visible()).toHaveLength(7);
  expect(count('6 additional shortcuts')).toBe(1);
  await act(async()=>{measurements()[0].props.onLayout({nativeEvent:{layout:{height:72}}});});
  expect(visible()).toHaveLength(6);
  expect(count('8 additional shortcuts')).toBe(1);
});
it('add tile never replaces a saved shortcut and is not counted as hidden',()=>{
  const {quickRows,hiddenQuickPins}=require('./prettyQuickLayout');
  const rows=quickRows([1,2,3,4,5]);
  expect(rows).toEqual([[1,2],[3,4],[5,null]]);
  expect(hiddenQuickPins(rows,1)).toBe(1);
  expect(hiddenQuickPins(quickRows([1,2]),1)).toBe(0);
  expect(quickRows(Array.from({length:30},(_,i)=>i))).toHaveLength(15);
});
