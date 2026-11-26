import React,{useEffect,useState} from 'react';
import {Image,NativeModules,ScrollView,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {ShortcutItem} from './config';
import {PrettyPrefs,savePrettyPrefs,loadPrettyPrefs} from './prettyPrefs';
import {PrettyScreenHeader} from './PrettyScreen';
type Pin=ShortcutItem & {icon?:string};
type Entry={path:string;name:string;isDir:boolean};
const ROOT='/storage/emulated/0';
const ROOTS=[ROOT+'/Note',ROOT+'/Document',ROOT+'/MyStyle'];
const ICONS=[
  {key:'star-filled',label:'Star',image:require('../assets/pretty/star-filled.png')},
  {key:'files',label:'Folder',image:require('../assets/pretty/files.png')},
  {key:'notebook',label:'Note',image:require('../assets/pretty/notebook.png')},
  {key:'calendar',label:'Calendar',image:require('../assets/pretty/calendar.png')},
];
const font={fontFamily:'GoogleSansFlex',fontSize:20,color:'#111'};
function Button({title,onPress,disabled=false}:{title:string;onPress:()=>void;disabled?:boolean}){
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={{padding:10,borderWidth:1,borderColor:'#777',margin:4,opacity:disabled?.5:1}}><Text style={font}>{title}</Text></TouchableOpacity>;
}
export function PrettyQuickEditor({prefs,onSaved,onClose}:{prefs:PrettyPrefs|null;onSaved:(next:PrettyPrefs)=>void;onClose:()=>void}){
  const [pins,setPins]=useState<Pin[]>(()=>prefs?.quick??[]);
  const [dir,setDir]=useState<string|null>(null);
  const [entries,setEntries]=useState<Entry[]>([]);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{if(!dir)return;let active=true;setEntries([]);
    NativeModules.DashboardNative.listDir(dir).then((rows:Entry[])=>{if(active)setEntries(rows.filter(e=>e.isDir||/\.(note|pdf|epub|cbz|xps|fb2)$/i.test(e.name)).sort((a,b)=>Number(b.isDir)-Number(a.isDir)||a.name.localeCompare(b.name)));}).catch((e:unknown)=>{if(active)setStatus(String(e));});
    return()=>{active=false;};
  },[dir]);
  const update=(i:number,change:Partial<Pin>)=>setPins(old=>old.map((p,j)=>j===i?{...p,...change} as Pin:p));
  const move=(i:number,delta:number)=>setPins(old=>{const j=i+delta;if(j<0||j>=old.length)return old;const next=[...old];[next[i],next[j]]=[next[j],next[i]];return next;});
  const add=(pin:Pin)=>{if(pins.length>=30){setStatus('Maximum 30 stored links.');return;}if(pins.some(p=>p.path===pin.path)){setStatus('Already pinned.');return;}setPins(old=>[...old,pin]);setDir(null);setStatus('');};
  const addFile=(path:string,isDir:boolean)=>add({kind:isDir?'folder':'note-last',path,label:path.split('/').pop()?.replace(/\.(note|pdf|epub)$/i,'')||path,icon:isDir?'files':'notebook'});
  const save=async()=>{if(!prefs||busy)return;if(pins.some(p=>!p.label.trim())){setStatus('Every link needs a name.');return;}setBusy(true);setStatus('');
    try{const next={...prefs,quick:pins.map(p=>({...p,label:p.label.trim()}))};if(!await savePrettyPrefs(next))throw Error('Could not save Quick access.');const verified=await loadPrettyPrefs();if(JSON.stringify(verified.quick)!==JSON.stringify(next.quick))throw Error('Saved shortcuts did not match.');onSaved(verified);}
    catch(e:any){setStatus(String(e?.message??e));}finally{setBusy(false);}
  };
  return <View style={{flex:1,backgroundColor:'#fff'}}>
    <PrettyScreenHeader title={dir?'Choose destination':'Quick access'} left={{label:dir?'Back':'Cancel',onPress:dir?()=>setDir(null):onClose,disabled:busy}} right={dir?undefined:{label:'Done',onPress:save,disabled:busy||!prefs}}/>
    <ScrollView style={{flex:1,padding:16}} keyboardShouldPersistTaps="handled">
      {!!status&&<Text style={font}>{status}</Text>}
      {dir?<><View style={{flexDirection:'row',flexWrap:'wrap'}}>{ROOTS.map(r=><Button key={r} title={r.split('/').pop()||r} onPress={()=>setDir(r)}/>)}<Button title="Up" onPress={()=>{if(!ROOTS.includes(dir))setDir(dir.substring(0,dir.lastIndexOf('/')));}}/></View>
        <Text style={font}>{dir}</Text><Button title="Use this folder" onPress={()=>addFile(dir,true)}/>
        {entries.map(e=><TouchableOpacity key={e.path} onPress={()=>e.isDir?setDir(e.path):addFile(e.path,false)} style={{paddingVertical:14,borderBottomWidth:1,borderColor:'#bbb'}}><Text style={font}>{e.isDir?'› ':''}{e.name}</Text></TouchableOpacity>)}</>:
      <><Text style={font}>The first six links appear on the dashboard. Reorder to choose which six. Existing additional links remain saved here.</Text>
        {pins.map((p,i)=><View key={i+':'+p.path} style={{borderBottomWidth:1,borderColor:'#888',paddingVertical:14}}>
          <TextInput editable={!busy} value={p.label} onChangeText={label=>update(i,{label})} style={{...font,borderWidth:1,padding:10}}/>
          <Text style={{...font,fontSize:14}}>{p.path==='app:calendar'?'Native Calendar':p.path}</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap'}}>{ICONS.map(icon=><TouchableOpacity key={icon.key} onPress={()=>update(i,{icon:icon.key})} accessibilityLabel={icon.label} style={{padding:9,margin:3,borderWidth:(p.icon??(p.path==='app:calendar'?'calendar':p.kind==='folder'?'files':'star-filled'))===icon.key?2:1,borderColor:'#777'}}><Image source={icon.image} style={{width:24,height:24}} resizeMode="contain"/></TouchableOpacity>)}</View>
          <View style={{flexDirection:'row',flexWrap:'wrap'}}><Button title="Up" disabled={i===0||busy} onPress={()=>move(i,-1)}/><Button title="Down" disabled={i===pins.length-1||busy} onPress={()=>move(i,1)}/><Button title="Remove" disabled={busy} onPress={()=>setPins(old=>old.filter((_,j)=>j!==i))}/></View>
        </View>)}
        <Button title="Add note, document or folder" disabled={busy} onPress={()=>setDir(ROOTS[0])}/>
        <Button title="Add Calendar" disabled={busy} onPress={()=>add({kind:'note-last',path:'app:calendar',label:'Calendar',icon:'calendar'})}/>
      </>}
    </ScrollView>
  </View>;
}
