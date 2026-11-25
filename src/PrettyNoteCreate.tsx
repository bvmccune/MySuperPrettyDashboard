/**
 * Explicit note creation choices. This is our own chooser (the public
 * Supernote SDK exposes createNote, not a "show native new-note dialog" API).
 * It uses documented getNoteSystemTemplates and createNote calls.
 */
import React,{useEffect,useState} from 'react';
import {NativeModules,ScrollView,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {PluginCommAPI,PluginFileAPI} from 'sn-plugin-lib';
import {openFile} from './open';
import {PrettyScreenHeader, SCREEN_BODY} from './PrettyScreen';
const {DashboardNative}=NativeModules;
const BASE='/storage/emulated/0/Note';
const FONT='GoogleSansFlex';
interface Template {name:string;vUri:string}
const LABELS:Record<string,string>={
  white:'White','8mm_ruled_line':'8 mm ruled line','9mm_ruled_line':'9 mm ruled line',
  '10mm_ruled_line':'10 mm ruled line','5mm_grid':'5 mm grid','5mm_engineering_grid':'5 mm engineering grid',
  '10mm_grid':'10 mm grid','5mm_dots':'5 mm dots','9mm_cnt':'9 mm Cornell','10mm_cnt':'10 mm Cornell',
  arabic_line_ruling:'Arabic lined ruling',college_ruled:'College ruled',wide_ruled:'Wide ruled',
  four_quadrant_method:'Four quadrant method',four_wire:'Four wire',french_seyes_ruling:'French Séyès ruling',
  hand_sketch_diary:'Hand sketch diary',letter_format:'Letter format',list_format:'List',
  meeting_notes:'Meeting notes',nine_palace_lattice:'Nine palace lattice',reading_note:'Reading note',
  sheet_format:'Sheet format',staff:'Staff',task_list:'Task list',tian_zige:'Tian Zi Ge',
  daily_calendar:'Daily calendar',weekly_calendar:'Weekly calendar'
};
export const templateKey=(name:string)=>name.replace(/^style_/i,'').toLowerCase();
export function templateLabel(name:string):string{
  const key=templateKey(name);
  return LABELS[key]??key.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
}
export function defaultNoteName(d=new Date()):string{
  const pad=(n:number)=>String(n).padStart(2,'0');
  return String(d.getFullYear())+pad(d.getMonth()+1)+pad(d.getDate())+'_'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds());
}
function Radio({text,selected,onPress}:{text:string;selected:boolean;onPress:()=>void}){
  return <TouchableOpacity accessibilityRole="radio" accessibilityState={{selected}}
    onPress={onPress} style={{flexDirection:'row',alignItems:'center',paddingVertical:10,paddingRight:24}}>
    <View style={{width:28,height:28,borderWidth:2,borderColor:'#111',borderRadius:14,
      alignItems:'center',justifyContent:'center',marginRight:12}}>
      {selected&&<View style={{width:15,height:15,borderRadius:8,backgroundColor:'#111'}}/>}
    </View>
    <Text style={{fontFamily:FONT,fontSize:SCREEN_BODY,color:'#111'}}>{text}</Text>
  </TouchableOpacity>;
}
function Rule(){return <View style={{height:1,backgroundColor:'#aaa',marginVertical:20}}/>;}
/** Schematic, not firmware bitmaps: do not invent previews for unfamiliar styles. */
function TemplatePreview({kind,portrait}:{kind:string;portrait:boolean}){
  const list=kind==='list_format'||kind==='arabic_line_ruling';
  const tasks=kind==='task_list';
  const grid=kind.includes('grid')||kind==='nine_palace_lattice'||kind==='tian_zige';
  const ruled=list||tasks||grid||kind.includes('ruled')||kind.includes('ruling')||kind.includes('line')||kind.endsWith('_cnt');
  const split=kind==='four_quadrant_method';
  const dots=kind.includes('dots');
  const known=kind==='white'||ruled||split||dots;
  return <View style={{width:'100%',aspectRatio:portrait?0.75:1.33,borderWidth:2,borderColor:'#111',backgroundColor:'#fff',overflow:'hidden'}}>
    {ruled&&Array.from({length:10},(_,i)=><View key={i} style={{position:'absolute',
      top:((i+1)*8)+'%' as any,left:tasks?'16%':'0%',right:'0%',height:1,backgroundColor:'#222'}}/>)}
    {tasks&&Array.from({length:10},(_,i)=><View key={i} style={{position:'absolute',
      top:((i+1)*8-3)+'%' as any,left:'5%',width:'6%',aspectRatio:1,borderWidth:1,borderColor:'#111'}}/>)}
    {list&&<View style={{position:'absolute',top:0,bottom:0,left:kind==='list_format'?'26%':'76%',width:1,backgroundColor:'#111'}}/>}
    {grid&&Array.from({length:7},(_,i)=><View key={i} style={{position:'absolute',
      left:((i+1)*12)+'%' as any,top:0,bottom:0,width:1,backgroundColor:'#222'}}/>)}
    {split&&<><View style={{position:'absolute',top:'50%',left:0,right:0,height:1,backgroundColor:'#111'}}/>
      <View style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,backgroundColor:'#111'}}/></>}
    {dots&&Array.from({length:8},(_,i)=>Array.from({length:6},(_,j)=><View key={i+':'+j}
      style={{position:'absolute',top:((i+1)*10)+'%' as any,left:((j+1)*14)+'%' as any,width:2,height:2,backgroundColor:'#666'}}/>))}
    {!known&&<View style={{flex:1,alignItems:'center',justifyContent:'center',padding:4}}>
      <Text style={{fontFamily:FONT,fontSize:13,textAlign:'center',color:'#666'}}>Preview unavailable</Text>
    </View>}
  </View>;
}
export function PrettyNoteCreate({onClose}:{onClose:()=>void}):React.JSX.Element{
  const [name,setName]=useState(()=>defaultNoteName());
  const [mode,setMode]=useState<0|1>(1);
  const [portrait,setPortrait]=useState(true);
  const [viewAll,setViewAll]=useState(false);
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
      if(active){setTemplates(items);if(items.length)setSelected((items.find(t=>templateKey(t.name)==='white')??items[0]).vUri);}
    })().catch(()=>{if(active)setMessage('Supernote did not return its built-in templates.');});
    return ()=>{active=false;};
  },[]);
  const create=async()=>{
    if(busy)return;
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
            notePath:path,template,mode,isPortrait:portrait,
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
  const preferred=['white','list_format','arabic_line_ruling','task_list'];
  const first=preferred.map(key=>templates.find(t=>templateKey(t.name)===key)).filter((t):t is Template=>!!t);
  const chosen=templates.find(t=>t.vUri===selected);
  const featured=[...first,...templates.filter(t=>!first.includes(t))].slice(0,4);
  if(chosen&&!featured.includes(chosen))featured[featured.length?featured.length-1:0]=chosen;
  const choose=(t:Template)=>{setSelected(t.vUri);setViewAll(false);};
  const tiles=(items:Template[])=>(
    <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'flex-start'}}>
      {items.map(t=><TouchableOpacity key={t.vUri} accessibilityRole="button"
        accessibilityLabel={templateLabel(t.name)} accessibilityState={{selected:t.vUri===selected}}
        onPress={()=>choose(t)} style={{width:'25%',alignItems:'center',paddingHorizontal:12,paddingBottom:18}}>
        <View style={{width:'100%',maxWidth:170,borderWidth:2,borderColor:t.vUri===selected?'#111':'#fff',padding:4}}>
          <TemplatePreview kind={templateKey(t.name)} portrait={portrait}/>
        </View>
        <Text style={[text(17),{textAlign:'center',marginTop:5}]}>{templateLabel(t.name)}</Text>
      </TouchableOpacity>)}
    </View>);
  return <View style={{flex:1,backgroundColor:'#fff'}}>
    <PrettyScreenHeader title={viewAll?'Templates':'New Note'}
      left={{label:viewAll?'Back':'Cancel',onPress:viewAll?()=>setViewAll(false):onClose,disabled:busy}}
      right={viewAll?undefined:{label:busy?'Creating…':'Create',onPress:create,disabled:busy||!selected||!templates.length}}/>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24,paddingBottom:30}}>
      {!viewAll&&<>
        <Text style={text(22,'600')}>Name</Text>
        <TextInput accessibilityLabel="Notebook name" value={name} onChangeText={setName} placeholder="Enter a notebook name"
          autoCorrect={false} maxLength={110} style={{fontFamily:FONT,fontSize:SCREEN_BODY,
            paddingHorizontal:14,paddingVertical:12,borderWidth:1,borderColor:'#777',color:'#111',marginTop:10}}/>
        <Rule/>
        <Text style={text(22,'600')}>Type</Text>
        <Radio text="Standard" selected={mode===0} onPress={()=>setMode(0)}/>
        <Radio text="Real-Time Recognition" selected={mode===1} onPress={()=>setMode(1)}/>
        <Text style={[text(17),{color:'#555',marginLeft:40}]}>Supports searching handwriting and faster exporting to TXT and DOCX, but increases power consumption.</Text>
        <Rule/>
      </>}
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <Text style={text(22,'600')}>{viewAll?'Built-in templates':'Templates'}</Text>
        {!viewAll&&<TouchableOpacity accessibilityRole="button" onPress={()=>setViewAll(true)} style={{padding:10}}>
          <Text style={text(18,'600')}>View All ›</Text>
        </TouchableOpacity>}
      </View>
      <View style={{flexDirection:'row',marginBottom:12}}>
        <Radio text="Vertical" selected={portrait} onPress={()=>setPortrait(true)}/>
        <Radio text="Horizontal" selected={!portrait} onPress={()=>setPortrait(false)}/>
      </View>
      {tiles(viewAll?templates:featured)}
      {!!templates.length&&<Text style={[text(15),{color:'#666'}]}>Illustrative previews of built-in templates. The original firmware template is used when creating a note.</Text>}
      {!templates.length&&<Text style={text(18)}>No system templates were returned. Please use native New Note if they remain unavailable.</Text>}
      {!!message&&<Text accessibilityRole="alert" style={[text(18),{marginTop:16}]}>{message}</Text>}
    </ScrollView>
  </View>;
}
