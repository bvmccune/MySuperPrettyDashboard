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
jest.mock('./open',()=>({openFile:jest.fn(),openFolder:jest.fn(),launchApp:jest.fn()}));
jest.mock('./scanner',()=>({scanKeywords:jest.fn()}));
jest.mock('./relay',()=>({dayKey:jest.fn(),dueBucket:jest.fn(()=> 'none')}));
jest.mock('./recent',()=>({readRecentDetailed:jest.fn(async()=>({
  paths:['/storage/emulated/0/Note/Project/Example.note'],mode:'opened',
}))}));
jest.mock('./prettyCloud',()=>({
  hasSupernoteLogin:jest.fn(async()=>false),
  readNativeSupernoteTasks:jest.fn(async()=>({tasks:[],truncated:false})),
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
