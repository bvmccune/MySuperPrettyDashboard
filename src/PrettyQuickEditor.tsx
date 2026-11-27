import React,{useEffect,useState} from 'react';
import {Image,NativeModules,ScrollView,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {ShortcutItem} from './config';
import {PrettyPrefs,savePrettyPrefs,loadPrettyPrefs,QuickPin,QuickIcon,quickIcon} from './prettyPrefs';
import {PrettyScreenHeader} from './PrettyScreen';
type Pin=QuickPin;
type Entry={path:string;name:string;isDir:boolean};
const ROOT='/storage/emulated/0';
const ROOTS=[ROOT+'/Note',ROOT+'/Document',ROOT+'/MyStyle'];
const ICONS:{key:QuickIcon;label:string;image:any}[]=[
  {key:'stars',label:'Stars',image:require('../assets/pretty/stars.png')},
  {key:'stars-filled',label:'Filled star',image:require('../assets/pretty/stars-filled.png')},
  {key:'keywords',label:'Keyword',image:require('../assets/pretty/keywords.png')},
  {key:'recent',label:'Planned',image:require('../assets/pretty/recent.png')},
  {key:'refresh',label:'Refresh',image:require('../assets/pretty/refresh.png')},
  {key:'calendar-dot',label:'Calendar Dot',image:require('../assets/pretty/calendar-dot.png')},
  {key:'auto-refresh',label:'Auto Refresh',image:require('../assets/pretty/auto-refresh.png')},
  {key:'new-note',label:'New Note',image:require('../assets/pretty/new-note.png')},
  {key:'open-notebook',label:'Open Notebook',image:require('../assets/pretty/open-notebook.png')},
  {key:'files',label:'Files',image:require('../assets/pretty/files.png')},
  {key:'notebook',label:'Notebook',image:require('../assets/pretty/notebook.png')},
  {key:'calendar',label:'Calendar',image:require('../assets/pretty/calendar.png')},
];
const font={fontFamily:'GoogleSansFlex',fontSize:20,color:'#000'};
function Button({title,onPress,disabled=false}:{title:string;onPress:()=>void;disabled?:boolean}){
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={{padding:10,borderWidth:1,borderColor:'#777',margin:4,opacity:disabled?.5:1}}><Text style={font}>{title}</Text></TouchableOpacity>;
}
export function PrettyQuickEditor({prefs,initialIndex=null,onSaved,onClose}:{prefs:PrettyPrefs|null;initialIndex?:number|null;onSaved:(next:PrettyPrefs)=>void;onClose:()=>void}){
  const [pins,setPins]=useState<Pin[]>(()=>prefs?.quick??[]);
  const [dir,setDir]=useState<string|null>(null);
  const [entries,setEntries]=useState<Entry[]>([]);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [draft,setDraft]=useState<Pin|null>(()=>initialIndex!==null&&initialIndex>=0?prefs?.quick[initialIndex]??null:null);
  const [selecting,setSelecting]=useState(initialIndex===-1);
  useEffect(()=>{if(!dir)return;let active=true;setEntries([]);
    NativeModules.DashboardNative.listDir(dir).then((rows:Entry[])=>{if(active)setEntries(rows.filter(e=>e.isDir||/\.(note|pdf|epub|cbz|xps|fb2)$/i.test(e.name)).sort((a,b)=>Number(b.isDir)-Number(a.isDir)||a.name.localeCompare(b.name)));}).catch((e:unknown)=>{if(active)setStatus(String(e));});
    return()=>{active=false;};
  },[dir]);
  const move=(i:number,delta:number)=>setPins(old=>{const j=i+delta;if(j<0||j>=old.length)return old;const next=[...old];[next[i],next[j]]=[next[j],next[i]];return next;});
  const choose=(pin:Pin)=>{setDraft(old=>old?{...pin,label:old.label,icon:old.icon}:pin);setDir(null);setSelecting(false);setStatus('');};
  const chooseFile=(path:string,isDir:boolean)=>choose({kind:isDir?'folder':'note-last',path,label:path.split('/').pop()?.replace(/\.(note|pdf|epub)$/i,'')||path,icon:isDir?'files':'notebook'});
  const save=async(nextPins:Pin[])=>{if(!prefs||busy)return;if(nextPins.some(p=>!p.label.trim())){setStatus('Every link needs a name.');return;}if(nextPins.length>30){setStatus('Maximum 30 stored links.');return;}if(new Set(nextPins.map(p=>p.path)).size!==nextPins.length){setStatus('Destination already pinned.');return;}setBusy(true);setStatus('');
    try{const next={...prefs,quick:nextPins.map(p=>({...p,label:p.label.trim()}))};if(!await savePrettyPrefs(next))throw Error('Could not save Quick access.');const verified=await loadPrettyPrefs();if(JSON.stringify(verified.quick)!==JSON.stringify(next.quick))throw Error('Saved shortcuts did not match.');onSaved(verified);}
    catch(e:any){setStatus(String(e?.message??e));}finally{setBusy(false);}
  };
  const saveDraft=()=>{if(draft)save(initialIndex===-1?[...pins,draft]:pins.map((p,i)=>i===initialIndex?draft:p));};
  const title=dir?'Choose destination':initialIndex===null?'Reorder quick access':initialIndex===-1?'Add shortcut':'Edit shortcut';
  const labelFor=(p:Pin)=>p.path==='app:calendar'?'Native Calendar':p.path==='app:stars'?'Stars':p.path;
  const button=(key:QuickIcon)=>ICONS.find(icon=>icon.key===key)?.image;
  return <View style={{flex:1,backgroundColor:'#fff'}}>
    <PrettyScreenHeader title={title} left={{label:dir||selecting&&draft?'Back':'Cancel',onPress:dir?()=>setDir(null):selecting&&draft?()=>setSelecting(false):onClose,disabled:busy}} right={dir||selecting?undefined:{label:'Done',onPress:initialIndex===null?()=>save(pins):saveDraft,disabled:busy||!prefs||initialIndex!==null&&!draft}}/>
    <ScrollView style={{flex:1,padding:16}} keyboardShouldPersistTaps="handled">
      {!!status&&<Text style={font}>{status}</Text>}
      {dir?<><View style={{flexDirection:'row',flexWrap:'wrap'}}>{ROOTS.map(r=><Button key={r} title={r.split('/').pop()||r} onPress={()=>setDir(r)}/>)}<Button title="Up" onPress={()=>{if(!ROOTS.includes(dir))setDir(dir.substring(0,dir.lastIndexOf('/')));}}/></View>
        <Text style={font}>{dir}</Text><Button title="Use this folder" onPress={()=>chooseFile(dir,true)}/>
        {entries.map(e=><TouchableOpacity key={e.path} onPress={()=>e.isDir?setDir(e.path):chooseFile(e.path,false)} style={{paddingVertical:10,borderBottomWidth:1,borderColor:'#bbb'}}><Text style={font}>{e.isDir?'› ':''}{e.name}</Text></TouchableOpacity>)}</>:
      initialIndex===null?<>{pins.map((p,i)=><View key={p.path} style={{flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderColor:'#bbb',paddingVertical:4}}>
          <Image source={button(quickIcon(p))} style={{width:24,height:24,marginRight:8}} resizeMode="contain"/><Text numberOfLines={2} style={{...font,flex:1}}>{p.label}</Text>
          <Button title="↑" disabled={i===0||busy} onPress={()=>move(i,-1)}/><Button title="↓" disabled={i===pins.length-1||busy} onPress={()=>move(i,1)}/>
        </View>)}{!pins.length&&<Text style={font}>No shortcuts yet. Tap + on Home to add one.</Text>}</>:
      selecting||!draft?<><Text style={font}>Choose a shortcut destination</Text>
        <Button title="Note, document or folder" disabled={busy} onPress={()=>setDir(ROOTS[0])}/>
        <Button title="Calendar" disabled={busy} onPress={()=>choose({kind:'note-last',path:'app:calendar',label:'Calendar',icon:'calendar'})}/>
        <Button title="Stars" disabled={busy} onPress={()=>choose({kind:'note-last',path:'app:stars',label:'Stars',icon:'stars'})}/>
      </>:<>
        <Text style={font}>Name</Text><TextInput editable={!busy} value={draft.label} onChangeText={label=>setDraft({...draft,label})} style={{...font,borderWidth:1,padding:8,marginVertical:6}}/>
        <Text style={{...font,fontSize:16}}>{labelFor(draft)}</Text><Button title="Change destination" disabled={busy} onPress={()=>setSelecting(true)}/>
        <Text style={font}>Icon</Text><View style={{flexDirection:'row',flexWrap:'wrap'}}>{ICONS.map(icon=><TouchableOpacity key={icon.key} disabled={busy} onPress={()=>setDraft({...draft,icon:icon.key})} accessibilityLabel={icon.label} style={{padding:9,margin:3,borderWidth:quickIcon(draft)===icon.key?2:1,borderColor:'#777'}}><Image source={icon.image} style={{width:28,height:28}} resizeMode="contain"/></TouchableOpacity>)}</View>
        {initialIndex!==null&&initialIndex>=0&&<Button title="Remove shortcut" disabled={busy} onPress={()=>save(pins.filter((_,i)=>i!==initialIndex))}/>}
      </>}
    </ScrollView>
  </View>;
}
