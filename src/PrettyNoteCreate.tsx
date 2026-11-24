/**
 * Explicit note creation choices. This is our own chooser (the public
 * Supernote SDK exposes createNote, not a "show native new-note dialog" API).
 * It uses documented getNoteSystemTemplates and createNote calls.
 */
import React,{useEffect,useState} from 'react';
import {NativeModules,ScrollView,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {PluginCommAPI,PluginFileAPI} from 'sn-plugin-lib';
import {openFile} from './open';
const {DashboardNative}=NativeModules;
const BASE='/storage/emulated/0/Note';
const FONT='GoogleSansFlex';
interface Template {name:string;vUri:string}
function Choice({text,selected,onPress}:{text:string;selected:boolean;onPress:()=>void}){
  return <TouchableOpacity onPress={onPress} accessibilityRole="button"
    style={{paddingHorizontal:15,paddingVertical:9,marginRight:9,marginTop:6,borderWidth:1.1,
      borderColor:selected?'#111':'#999',backgroundColor:selected?'#e8e8e8':'#fff',borderRadius:6}}>
    <Text style={{fontFamily:FONT,fontSize:17,fontWeight:selected?'600':'400',color:'#111'}}>{text}</Text>
  </TouchableOpacity>;
}
export function PrettyNoteCreate({onClose}:{onClose:()=>void}):React.JSX.Element{
  const [name,setName]=useState('');
  const [mode,setMode]=useState<0|1>(1);
  const [templates,setTemplates]=useState<Template[]>([]);
  const [selected,setSelected]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    let active=true;
    (async()=>{
      const raw:any=await PluginCommAPI.getNoteSystemTemplates();
      const items:Template[]=Array.isArray(raw)?raw.filter((v:any)=>
        typeof v?.name==='string'&&typeof v?.vUri==='string')
        .map((v:any)=>({name:v.name,vUri:v.vUri})):[];
      if(active){setTemplates(items);if(items.length)setSelected(items[0].vUri);}
    })().catch(()=>{if(active)setMessage('Supernote did not return its built-in templates.');});
    return ()=>{active=false;};
  },[]);
  const create=async()=>{
    const title=name.trim();
    if(!title){setMessage('Enter a notebook name.');return;}
    if(/[\/\\:*?"<>|]/.test(title)||title==='.'||title==='..'){
      setMessage('Please choose a name without / \\ : * ? " < > |');return;
    }
    if(!selected){setMessage('Select a template before creating a note.');return;}
    setBusy(true);setMessage('');
    try{
      const path=BASE+'/'+title+'.note';
      // Never overwrite an existing note accidentally.
      const listed:any[]=await DashboardNative.listDir(BASE);
      if(Array.isArray(listed)&&listed.some((entry:any)=>entry.path===path)){
        throw new Error('A note already exists with that name. Choose a different name.');
      }
      const chosen=templates.find(t=>t.vUri===selected);
      if(!chosen)throw new Error('Selected template is unavailable.');
      const candidates=[chosen.name,chosen.vUri].filter(Boolean);
      let last='Supernote refused to create the note.';
      let created=false;
      for(const template of candidates){
        try {
          const result:any=await PluginFileAPI.createNote({
            notePath:path,template,mode,isPortrait:true,
          });
          if(result?.success===true&&result?.result!==false){
            created=true;break;
          }
          last=String(result?.error?.message||last);
        }catch(e:any){last=String(e?.message||e);}
      }
      if(!created)throw new Error(last);
      onClose();
      await openFile(path);
    }catch(e:any){setMessage(String(e?.message||e));}
    finally{setBusy(false);}
  };
  const text=(size:number,weight:'400'|'600'='400')=>({fontFamily:FONT,fontSize:size,fontWeight:weight,color:'#111'} as const);
  return <View style={{flex:1}}>
    <Text style={[text(29,'600'),{marginBottom:6}]}>Create a new note</Text>
    <Text style={[text(15),{color:'#666',marginBottom:15}]}>
      Choose the notebook name, type and Supernote template before creating it.
    </Text>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:25}}>
      <Text style={text(19,'600')}>Notebook name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Enter a notebook name"
        autoCorrect={false} maxLength={110} style={{fontFamily:FONT,fontSize:21,
          paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderColor:'#999',
          color:'#111',marginVertical:8,borderRadius:5}}/>
      <Text style={[text(19,'600'),{marginTop:10}]}>Note type</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap'}}>
        <Choice text="Real-time recognition" selected={mode===1} onPress={()=>setMode(1)}/>
        <Choice text="Standard" selected={mode===0} onPress={()=>setMode(0)}/>
      </View>
      <Text style={[text(19,'600'),{marginTop:18}]}>Template</Text>
      <Text style={[text(14),{color:'#666'}]}>Built-in templates supplied by your Supernote firmware</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',marginTop:5}}>
        {templates.map(t=><Choice key={t.vUri} text={t.name}
          selected={t.vUri===selected} onPress={()=>setSelected(t.vUri)}/>)}
      </View>
      {!templates.length&&<Text style={[text(16),{marginTop:10}]}>
        No system templates were returned. Please open native New Note instead.
      </Text>}
      {!!message&&<Text style={[text(17),{color:'#333',marginTop:12}]}>{message}</Text>}
      <View style={{flexDirection:'row',alignItems:'center',marginTop:18}}>
        <Choice text="Cancel" selected={false} onPress={onClose}/>
        <TouchableOpacity disabled={busy||!templates.length} onPress={create}
          style={{backgroundColor:'#111',borderRadius:6,paddingVertical:12,paddingHorizontal:22,
            marginTop:6,opacity:busy||!templates.length?0.4:1}}>
          <Text style={{fontFamily:FONT,fontWeight:'600',fontSize:19,color:'#fff'}}>
            {busy?'Creating…':'Create note'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  </View>;
}
