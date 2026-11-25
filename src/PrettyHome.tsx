/**
 * MySuperPrettyDashboard — Manta home.
 * One non-scrolling screen, two equal-height bands and a shorter bottom band; no floating OS overlay.
 * The visually themed icons are intentional custom artwork.
 *
 * Calendar: owner's existing read-only feed, not native event mirroring.
 * To-do: owner's real Supernote Cloud tasks, never a second task database.
 */
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
  AppState,DeviceEventEmitter,Image,ImageSourcePropType,Modal,NativeModules,
  ScrollView,StyleSheet,Text,TouchableOpacity,View,useWindowDimensions,
} from 'react-native';
import {DashboardConfig,ShortcutItem} from './config';
import {leavePlugin} from './bubble';
import {NativeUIUtils} from 'sn-plugin-lib';
import {findLastSavedNote} from './lastSavedNote';
import {sdRoots} from './storage';
import {launchApp,openFile,openFolder} from './open';
import {readRecentDetailed} from './recent';
import {dayKey,dueBucket} from './relay';
import {loadPrettyPrefs,PrettyPrefs,ACTIONS,PrettyAction,DEFAULT_PRETTY} from './prettyPrefs';
import {readNativeSupernoteTasks} from './prettyCloud';
import {
  AgendaEvent,CalendarResult,CALENDAR_REFRESH_MS,dateKey,dayLabel,
  addCalendarDays,agendaFromFeed,eventTimeRange,eventDuration,
  currentCalendar,loadCalendarCache,refreshCalendar,
} from './prettyCalendar';
import {AgendaRow,hasTimeConflict} from './PrettyAgenda';
import {PrettyNoteCreate} from './PrettyNoteCreate';
import {scanKeywords,KeywordHit} from './scanner';

const {DashboardNative}=NativeModules;
const NOTE_ROOT='/storage/emulated/0/Note';
const FONT='GoogleSansFlex';
const APPS={
  todo:'com.ratta.supernote.task/com.ratta.supernote.task.TaskActivity',
  search:'com.ratta.search/com.ratta.search.MainActivity',
};
const WEEK=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const FILE_RE=/\.(note|pdf|epub|cbz|xps|fb2)$/i;
type IconName =
  | 'quick'|'new-note'|'file'|'files'|'calendar'|'todo'|'list'|'recent'
  | 'search'|'favorites'|'star'|'star-filled'|'book'|'home'|'settings'|'grid'
  | 'last-note'|'charging'|'notebook'|'edit'|'plus'|'refresh'|'back'
  | 'chicken'|'lizard'|'stars'|'dice'|'ramen'|'controller'|'jellyfish'
  | 'plants'|'octopus'|'rocks'|'coffee'|'wifi'|'wifi-off'|'keywords'|'pending'|'stardust'|'battery'|'battery-charging'|'calendar-dot'|'open-notebook'|'cloud-sync';
const IMAGES:Record<IconName,ImageSourcePropType>={
  quick:require('../assets/pretty/quick.png'),
  'new-note':require('../assets/pretty/new-note.png'),
  file:require('../assets/pretty/file.png'),
  files:require('../assets/pretty/files.png'),
  calendar:require('../assets/pretty/calendar.png'),
  todo:require('../assets/pretty/todo.png'),
  list:require('../assets/pretty/list.png'),
  recent:require('../assets/pretty/recent.png'),
  search:require('../assets/pretty/search.png'),
  favorites:require('../assets/pretty/favorites.png'),
  star:require('../assets/pretty/star.png'),
  'star-filled':require('../assets/pretty/star-filled.png'),
  book:require('../assets/pretty/book.png'),
  home:require('../assets/pretty/home.png'),
  settings:require('../assets/pretty/settings.png'),
  grid:require('../assets/pretty/grid.png'),
  'last-note':require('../assets/pretty/last-note.png'),
  charging:require('../assets/pretty/charging.png'),
  notebook:require('../assets/pretty/notebook.png'),
  edit:require('../assets/pretty/edit.png'),
  plus:require('../assets/pretty/plus.png'),
  refresh:require('../assets/pretty/refresh.png'),
  back:require('../assets/pretty/back.png'),
  chicken:require('../assets/pretty/chicken.png'),
  lizard:require('../assets/pretty/lizard.png'),
  stars:require('../assets/pretty/stars.png'),
  dice:require('../assets/pretty/dice.png'),
  ramen:require('../assets/pretty/ramen.png'),
  controller:require('../assets/pretty/controller.png'),
  jellyfish:require('../assets/pretty/jellyfish.png'),
  plants:require('../assets/pretty/plants.png'),
  octopus:require('../assets/pretty/octopus.png'),
  rocks:require('../assets/pretty/rocks.png'),
  coffee:require('../assets/pretty/coffee.png'),
  wifi:require('../assets/pretty/wifi.png'),
  'wifi-off':require('../assets/pretty/wifi-off.png'),
  keywords:require('../assets/pretty/keywords.png'),
  pending:require('../assets/pretty/pending.png'),
  stardust:require('../assets/pretty/stardust.png'),
  battery:require('../assets/pretty/battery.png'),
  'battery-charging':require('../assets/pretty/battery-charging.png'),
  'cloud-sync':require('../assets/pretty/cloud-sync.png'),
  'calendar-dot':require('../assets/pretty/calendar-dot.png'),
  'open-notebook':require('../assets/pretty/open-notebook.png'),
};
type Overlay='favorites'|'recent'|'keywords'|'agenda'|'event'|'new-note'|null;
interface Task {id:string;title:string;due:string|null}
interface CreatedNote {path:string;createdAt:number}
interface FileInfo {mtime?:number;createdAt?:number}
const DATE_COLOR='#555';
const RULE='#aaaaaa';

function Glyph({name,size=27,tintColor}:{
  name:IconName;size?:number;tintColor?:string;
}){
  return <Image source={IMAGES[name]} resizeMode="contain"
    style={{width:size,height:size,tintColor}}/>;
}
function Txt({children,size=17,bold=false,muted=false,lines,style}:{
  children:React.ReactNode;size?:number;bold?:boolean;muted?:boolean;
  lines?:number;style?:any;
}){
  return <Text numberOfLines={lines} ellipsizeMode="tail"
    style={[{fontFamily:FONT,fontSize:size,fontWeight:bold?'600':'400',
      color:muted?DATE_COLOR:'#111',includeFontPadding:false},style]}>{children}</Text>;
}
function IconTap({icon,label,onPress,size=27}:{
  icon:IconName;label:string;onPress:()=>void;size?:number;
}){
  return <TouchableOpacity onPress={onPress} accessibilityRole="button"
    accessibilityLabel={label} hitSlop={{top:10,bottom:10,left:10,right:10}}
    style={{height:size+12,width:size+13,alignItems:'center',justifyContent:'center'}}>
    <Glyph name={icon} size={size}/>
  </TouchableOpacity>;
}
const CIRCLE=48;
function SectionTitle({icon,label,scale,action,actionLabel,extra}:{
  icon:IconName;label:string;scale:number;action?:()=>void;
  actionLabel?:string;extra?:string;
}){
  const circle=CIRCLE*scale,fs=21*scale;
  return <View style={{height:53*scale,flexDirection:'row',alignItems:'center',minWidth:0}}>
    <View style={{height:circle,width:circle,alignItems:'center',justifyContent:'center',marginRight:6*scale}}>
      <Glyph name={icon} size={circle*120/113}/>
    </View>
    <Txt size={fs} bold lines={1} style={{flexShrink:1}}>{label}</Txt>
    {!!extra&&<Txt size={13*scale} bold style={{marginLeft:4*scale}}>{extra}</Txt>}
    <View style={{flex:1}}/>
    {!!action&&<TouchableOpacity accessibilityRole="button"
      accessibilityLabel={actionLabel+' '+label} onPress={action}
      hitSlop={{top:8,bottom:8,left:7,right:7}} style={{marginLeft:7*scale}}>
      <Txt size={12.8*scale} muted>{actionLabel}</Txt>
    </TouchableOpacity>}
  </View>;
}
function keyOf(d:Date){return dayKey(d);}
function mondayOf(d:Date){
  const v=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  v.setDate(v.getDate()-((v.getDay()+6)%7));return v;
}
function fileTitle(path:string){
  return path.split('/').pop()?.replace(/\.(note|pdf|epub|cbz|xps|fb2)$/i,'')||path;
}
function dateSmall(time?:number){
  if(!time||!Number.isFinite(time))return '';
  const d=new Date(time);return (d.getMonth()+1)+'/'+d.getDate();
}
function clockSmall(time?:number){
  if(!time||!Number.isFinite(time))return '';
  return new Date(time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
}
function dateAndTime(time?:number){return time?dateSmall(time)+' '+clockSmall(time).toLowerCase():'';}
function dateLong(now:Date){
  return now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
}
function timeLong(now:Date){
  return now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}).replace(/\u202f/g,' ');
}
function sortTasks(data:Task[],now:Date):Task[]{
  const rank:Record<string,number>={overdue:0,today:1,tomorrow:2,week:3,later:4,none:5};
  return [...data].sort((a,b)=>
    rank[dueBucket(a.due,now)]-rank[dueBucket(b.due,now)]||
    (a.due??'9999').localeCompare(b.due??'9999')||a.title.localeCompare(b.title));
}
function dueShort(due:string):string{
  const pieces=due.slice(0,10).split('-');
  return pieces.length===3?Number(pieces[1])+'/'+Number(pieces[2]):due;
}
function overlapIcon(scale:number){
  return <View style={{height:14*scale,width:21*scale,marginRight:5*scale,justifyContent:'center'}}>
    <View style={{height:12*scale,width:12*scale,borderWidth:1.5,
      backgroundColor:'#111',borderColor:'#111',borderRadius:100,position:'absolute',left:0}}/>
    <View style={{height:12*scale,width:12*scale,borderWidth:1.5,
      backgroundColor:'#111',borderColor:'#111',borderRadius:100,position:'absolute',left:7*scale}}/>
  </View>;
}

export function PrettyHome({config,nonce,onSettings}:{
  config:DashboardConfig|null;nonce:number;onSettings:()=>void;
}):React.JSX.Element{
  const {width,height}=useWindowDimensions();
  const s=Math.max(0.8,Math.min(width/760,height/950,1.27));
  const [prefs,setPrefs]=useState<PrettyPrefs|null>(null);
  const fontBoost=prefs?.size==='extra'?1.15:prefs?.size==='large'?1.08:1;
  const body=17.3*s*fontBoost;
  const secondary=13*s*fontBoost;
  const [now,setNow]=useState(()=>new Date());
  const [selectedDay,setSelectedDay]=useState(()=>dateKey(new Date()));
  const [agendaStart,setAgendaStart]=useState(()=>dateKey(new Date()));
  const [battery,setBattery]=useState<{level:number;charging:boolean}|null>(null);
  const [network,setNetwork]=useState<{wifi:boolean}|null>(null);
  const [recent,setRecent]=useState<string[]>([]);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [taskError,setTaskError]=useState('');
  const [taskLoading,setTaskLoading]=useState(false);
  const [fileInfo,setFileInfo]=useState<Record<string,FileInfo>>({});
  const [createdNotes,setCreatedNotes]=useState<CreatedNote[]>([]);
  const [createdDays,setCreatedDays]=useState<Set<string>>(new Set());
  const [calendar,setCalendar]=useState<CalendarResult>(()=>currentCalendar());
  const [overlay,setOverlay]=useState<Overlay>(null);
  const [selectedEvent,setSelectedEvent]=useState<AgendaEvent|null>(null);
  const [returnToAgenda,setReturnToAgenda]=useState(false);
  const [agendaVisit,setAgendaVisit]=useState(0);
  const [keywordHits,setKeywordHits]=useState<KeywordHit[]>([]);
  const [keywordBusy,setKeywordBusy]=useState(false);
  const [topH,setTopH]=useState(245*s);
  const [syncNonce,setSyncNonce]=useState(0);
  const openingSavedNote=useRef(false);
  const [middleH,setMiddleH]=useState(245*s);
  const [bottomH,setBottomH]=useState(190*s);
  // Keep the empty lists stable while preferences load. Otherwise the file
  // metadata effect sees a new dependency on every render and schedules itself.
  const pinned=useMemo(()=>prefs?.quick??[],[prefs]);
  const favorites=useMemo(()=>prefs?.favorites??[],[prefs]);

  useEffect(()=>{
    let live=true;
    loadPrettyPrefs(config).then(p=>{if(live)setPrefs(p);}).catch(()=>{});
    // A previously installed version may have left its floating bubble visible.
    DashboardNative.hideBubble().catch(()=>{});
    return ()=>{live=false;};
  },[config,nonce,syncNonce]);

  const scanCreated=useCallback(async()=>{
    const queue=[NOTE_ROOT],seen=new Set<string>(),notes:CreatedNote[]=[];
    while(queue.length&&seen.size<250){
      const dir=queue.shift()!;
      if(seen.has(dir))continue;
      seen.add(dir);
      try{
        const list:Array<{path:string;name:string;isDir:boolean;createdAt?:number}>
          =await DashboardNative.listDir(dir);
        for(const item of list||[]){
          if(item.isDir&&!item.name.startsWith('.'))queue.push(item.path);
          else if(/\.note$/i.test(item.name)&&typeof item.createdAt==='number'&&
            Number.isFinite(item.createdAt)&&item.createdAt>0)
            notes.push({path:item.path,createdAt:item.createdAt});
        }
      }catch{}
    }
    notes.sort((a,b)=>b.createdAt-a.createdAt);
    setCreatedNotes(notes);
    setCreatedDays(new Set(notes.map(n=>dateKey(new Date(n.createdAt)))));
  },[]);

  const refresh=useCallback((force=false)=>{
    const today=new Date();
    setNow(today);
    DashboardNative.getBattery().then(setBattery).catch(()=>{});
    DashboardNative.getNetworkStatus().then(setNetwork).catch(()=>{});
    refreshCalendar().then(setCalendar).catch(()=>{});
    readRecentDetailed(force===true).then(r=>setRecent(r.paths.filter(p=>FILE_RE.test(p)))).catch(()=>{});
    scanCreated().catch(()=>{});
    setTaskLoading(true);
    readNativeSupernoteTasks().then(result=>{
      setTasks(result.tasks.map(t=>({id:t.id,title:t.title,due:t.due})));
      setTaskError(result.truncated?'Supernote returned an incomplete task list.':'');
    }).catch(e=>{setTasks([]);setTaskError(String(e?.message||'Supernote To-do unavailable'));})
      .finally(()=>setTaskLoading(false));
  },[scanCreated]);
  const refreshAll=()=>{setSyncNonce(v=>v+1);refresh(true);};

  useEffect(()=>{
    let live=true;
    loadCalendarCache().then(saved=>{if(live)setCalendar(saved);}).catch(()=>{});
    return()=>{live=false;};
  },[]);
  useEffect(()=>{
    refresh();setSelectedDay(dateKey(new Date()));
    const minute=setInterval(()=>{
      setNow(new Date());
      DashboardNative.getBattery().then(setBattery).catch(()=>{});
      DashboardNative.getNetworkStatus().then(setNetwork).catch(()=>{});
    },60000);
    const calendarTimer=setInterval(()=>{
      if(AppState.currentState==='active')refreshCalendar().then(setCalendar).catch(()=>{});
    },CALENDAR_REFRESH_MS);
    const wake=AppState.addEventListener('change',state=>{
      if(state==='active')refresh();
    });
    const sub=DeviceEventEmitter.addListener('dashboard_refresh_all',refresh);
    return()=>{clearInterval(minute);clearInterval(calendarTimer);wake.remove();sub.remove();};
  },[refresh,nonce]);

  useEffect(()=>{
    const items=[...pinned.map(p=>p.path),...favorites.map(p=>p.path),...recent.slice(0,20)];
    const dirs=[...new Set(items.map(p=>p.substring(0,p.lastIndexOf('/'))))];
    let live=true;
    Promise.all(dirs.map(async d=>{
      try{return (await DashboardNative.listDir(d)) as Array<{path:string;mtime:number;createdAt?:number}>;}
      catch{return [];}
    })).then(groups=>{
      if(!live)return;
      const next:Record<string,FileInfo>={};
      groups.flat().forEach(e=>next[e.path]={mtime:e.mtime,createdAt:e.createdAt});
      setFileInfo(next);
    }).catch(()=>{});
    return()=>{live=false;};
  },[pinned,favorites,recent,nonce,syncNonce]);

  useEffect(()=>{
    if(overlay!=='keywords')return;
    let live=true;setKeywordBusy(true);
    scanKeywords([NOTE_ROOT]).then(result=>{if(live)setKeywordHits(result.hits);})
      .catch(()=>{if(live)setKeywordHits([]);})
      .finally(()=>{if(live)setKeywordBusy(false);});
    return()=>{live=false;};
  },[overlay,nonce]);

  const agenda=useMemo(()=>calendar.snapshot?agendaFromFeed(calendar.snapshot.feed):[],[calendar.snapshot]);
  const events=useMemo(()=>agenda.filter(e=>e.startDay<=selectedDay&&selectedDay<e.endDayExclusive),
    [agenda,selectedDay]);
  const notes=useMemo(()=>createdNotes.filter(n=>dateKey(new Date(n.createdAt))===selectedDay),
    [createdNotes,selectedDay]);
  const activeTasks=useMemo(()=>sortTasks(tasks,now).slice(0,5),[tasks,now]);
  const weekStart=mondayOf(now);
  const days=WEEK.map((label,i)=>{
    const date=new Date(weekStart);date.setDate(weekStart.getDate()+i);
    const key=dateKey(date);
    return {label,date,key,today:key===dateKey(now),hasNotes:createdDays.has(key)};
  });
  const openTodayAgenda=()=>{
    const today=dateKey(new Date());
    setNow(new Date());setAgendaStart(today);setAgendaVisit(v=>v+1);setOverlay('agenda');
  };
  const openEvent=(event:AgendaEvent,fromAgenda=false)=>{
    setSelectedEvent(event);setReturnToAgenda(fromAgenda);setOverlay('event');
  };
  const doOpenPinned=(item:ShortcutItem)=>{
    setOverlay(null);
    if(item.kind==='folder')openFolder(item.path);
    else openFile(item.path,item.kind==='note-page'?item.page:0);
  };
  const close=()=>{setOverlay(null);leavePlugin();};
  const openLastSaved=async()=>{
    if(openingSavedNote.current)return;
    openingSavedNote.current=true;
    try{
      const roots=await sdRoots();
      const path=await findLastSavedNote((dir)=>DashboardNative.listDir(dir),roots);
      if(!path)throw new Error('No saved note was found.');
      await openFile(path);
    }catch(e:any){
      try{await NativeUIUtils.showRattaDialog(String(e?.message||'Could not find the last saved note.'),'','OK',false);}catch{}
    }finally{openingSavedNote.current=false;}
  };
  const actions:Record<PrettyAction,()=>void>={
    calendar:openTodayAgenda,
    files:()=>openFolder(NOTE_ROOT),
    favorites:()=>setOverlay('favorites'),
    search:()=>launchApp(APPS.search),
    keywords:()=>setOverlay('keywords'),
    'last-note':close,
    todo:()=>launchApp(APPS.todo),
    'new-note':()=>setOverlay('new-note'),
    'quick-access':()=>onSettings(),
    refresh:()=>refresh(),settings:onSettings,
    'cloud-sync':refreshAll,'last-saved-note':()=>{void openLastSaved();},
  };
  const shortcuts=(prefs?.shortcuts??DEFAULT_PRETTY.shortcuts).slice(0,6)
    .map((id,i)=>{
      const item=ACTIONS.find(a=>a.key===id);
      return {key:i,name:item?.name||id,icon:(item?.icon||'grid') as IconName,
        onPress:actions[id as PrettyAction]};
    });
  const textHeight=40*s;
  const quickMax=Math.max(0,Math.floor((bottomH-54*s)/textHeight));
  const notesMax=Math.max(0,Math.floor((middleH-54*s)/(38*s)));
  // Reserve actual space for wrapped long labels, rather than assuming each row is one line.
  const fitRows=(titles:string[],available:number,base:number,chars:number)=>{
    let count=0,used=0;
    for(const title of titles){
      const lines=Math.min(3,Math.max(1,Math.ceil(title.length/chars)));
      const row=Math.max(base,(lines*20+8)*s);
      if(used+row>available)break;
      used+=row;count++;
    }
    return count;
  };
  const eventChars=Math.max(12,Math.floor((width/2-154*s)/(body*.57)));
  const taskChars=Math.max(12,Math.floor((width/2-104*s)/(body*.57)));
  const taskMax=fitRows(activeTasks.map(t=>t.title),Math.max(0,topH-54*s),38*s,taskChars);
  const eventsMax=fitRows(events.map(e=>e.summary),Math.max(0,topH-54*s),34*s,eventChars);
  const listRule={borderBottomWidth:.6,borderBottomColor:'#bbb'};

  const rowFile=(path:string,i:number,stamp?:number)=>(
    <TouchableOpacity key={path+i} onPress={()=>{setOverlay(null);openFile(path);}}
      style={{height:38*s,flexDirection:'row',alignItems:'center',paddingHorizontal:4*s,...listRule}}>
      <Glyph name={/\.note$/i.test(path)?'notebook':'file'} size={24*s}/>
      <Txt lines={2} size={body} style={{flex:1,marginHorizontal:7*s}}>{fileTitle(path)}</Txt>
      <Txt size={secondary} muted>{dateAndTime(stamp)}</Txt>
    </TouchableOpacity>
  );
  const rowPin=(item:ShortcutItem,i:number)=>(
    <TouchableOpacity key={item.path+i} onPress={()=>doOpenPinned(item)}
      style={{height:textHeight,flexDirection:'row',alignItems:'center',paddingHorizontal:4*s,...listRule}}>
      <Glyph name="star-filled" size={24*s}/>
      <Txt lines={2} size={body} style={{flex:1,marginHorizontal:7*s}}>
        {item.label||fileTitle(item.path)}
      </Txt>
      <Txt size={secondary} muted>{dateAndTime(fileInfo[item.path]?.mtime)}</Txt>
    </TouchableOpacity>
  );
  const rowTask=(item:Task,i:number)=>{
    const overdue=dueBucket(item.due,now)==='overdue';
    return <TouchableOpacity key={item.id+i} onPress={()=>launchApp(APPS.todo)}
      accessibilityRole="button" accessibilityLabel={'Open To-do: '+item.title}
      style={{minHeight:38*s,paddingVertical:4*s,flexDirection:'row',alignItems:'center',paddingHorizontal:5*s,backgroundColor:i%2===0?'#ececec':'#fff',...listRule}}>
      <Glyph name="pending" size={23*s}/>
      <Txt size={body} lines={3} style={{flex:1,marginLeft:7*s,marginRight:5*s,lineHeight:20*s}}>
        {item.title}
      </Txt>
      {overdue?<View style={{backgroundColor:'#111',paddingHorizontal:5*s,
        paddingVertical:3*s,borderRadius:3}}>
        <Text style={{fontFamily:FONT,fontSize:10.5*s,color:'#fff',fontWeight:'700'}}>Overdue</Text>
      </View>:item.due?<Txt size={secondary} muted>{dueShort(item.due)}</Txt>:null}
    </TouchableOpacity>;
  };
  const rowNote=(note:CreatedNote,i:number)=>(
    <TouchableOpacity key={note.path+i} onPress={()=>openFile(note.path)}
      style={{height:38*s,flexDirection:'row',alignItems:'center',paddingHorizontal:4*s,...listRule}}>
      <Glyph name="notebook" size={23*s}/>
      <Txt size={body} lines={2} style={{marginLeft:7*s,flex:1}}>{fileTitle(note.path)}</Txt>
      <Txt size={secondary} muted style={{marginLeft:5*s}}>{clockSmall(note.createdAt).toLowerCase()}</Txt>
    </TouchableOpacity>
  );
  const headerH=113*s,weekH=93*s;

  return <View style={{flex:1,backgroundColor:'#fff',paddingHorizontal:15*s,
    paddingTop:8*s,paddingBottom:8*s}}>
    <View style={{height:headerH,justifyContent:'center'}}>
      <View style={{height:35*s,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <TouchableOpacity onPress={()=>setSelectedDay(dateKey(new Date()))}
          accessibilityRole="button" accessibilityLabel="Select today" style={{flex:1,zIndex:1}}>
          <Txt size={17*s} bold>{dateLong(now)}</Txt>
        </TouchableOpacity>
        <View pointerEvents="none" style={{position:'absolute',left:0,right:0,alignItems:'center'}}>
          <Txt size={19*s} bold>SmartyNote</Txt>
        </View>
        <View style={{flexDirection:'row',alignItems:'center'}}>
          <Glyph name={network?.wifi?'wifi':'wifi-off'} size={22*s}/>
          <View style={{marginHorizontal:7*s,flexDirection:'row',alignItems:'center'}}>
            {battery?.level!=null&&battery.level>=0?
              <View style={{width:(battery.charging?50:34)*s,height:22*s}}>
                <Image accessibilityLabel={battery.charging?'Charging battery':'Battery'}
                  source={IMAGES[battery.charging?'battery-charging':'battery']}
                  resizeMode="contain" style={{width:(battery.charging?50:34)*s,height:22*s}}/>
                <View style={{position:'absolute',left:4*s,top:5.5*s,
                  width:23*s*Math.max(0,Math.min(100,battery.level))/100,height:11*s,backgroundColor:'#000'}}/>
              </View>:<View style={{flexDirection:'row',alignItems:'center'}}>
                <Image source={IMAGES.battery} resizeMode="contain" style={{width:34*s,height:22*s}}/>
                {!!battery?.charging&&<Glyph name="charging" size={17*s}/>}
              </View>}
            <Txt size={14*s} style={{marginLeft:5*s}}>
              {battery?.level!=null&&battery.level>=0?battery.level+'%':'—'}
            </Txt>
          </View>
 
        </View>
      </View>
      <View style={{flexDirection:'row',alignItems:'center',height:75*s}}>
        <Txt size={58*s} bold style={{flex:1}}>{timeLong(now)}</Txt>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose note name, type, template"
          onPress={()=>setOverlay('new-note')}
          style={{width:67*s,height:67*s,alignItems:'center',justifyContent:'center'}}>
          <Glyph name="new-note" size={58*s}/>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Return to the note"
          onPress={close} style={{width:CIRCLE*s,height:CIRCLE*s,
          alignItems:'center',justifyContent:'center',marginLeft:7*s,marginRight:4*s}}>
          <Glyph name="stardust" size={CIRCLE*s*120/113}/>
        </TouchableOpacity>
      </View>
    </View>

    <View style={{height:weekH,flexDirection:'row',borderBottomWidth:1,borderColor:RULE}}>
      {days.map(day=><TouchableOpacity key={day.key} onPress={()=>setSelectedDay(day.key)}
        accessibilityRole="button" accessibilityLabel={'Select '+day.date.toDateString()}
        style={{flex:1,alignItems:'center',justifyContent:'center'}}>
        <Txt size={16.5*s} style={{marginBottom:3*s}}>{day.label}</Txt>
        <View style={{width:CIRCLE*s,height:CIRCLE*s,borderRadius:CIRCLE*s/2,
          backgroundColor:day.today?'#111':'#fff',
          borderWidth:!day.today&&selectedDay===day.key?1.2:0,borderColor:'#555',
          alignItems:'center',justifyContent:'center'}}>
          <Txt size={25*s} bold={day.today} style={{color:day.today?'#fff':'#111'}}>
            {day.date.getDate()}
          </Txt>
        </View>
        <View style={{height:6*s,marginTop:2*s}}>
          {day.hasNotes&&<View style={{height:5*s,width:5*s,borderRadius:99,backgroundColor:'#111'}}/>}
        </View>
      </TouchableOpacity>)}
    </View>

    <View style={{flex:1,minHeight:0}}>
      <View onLayout={e=>setTopH(e.nativeEvent.layout.height)}
        style={{flex:1,minHeight:0,flexDirection:'row',borderBottomWidth:1,borderColor:RULE}}>
        <View style={[styles.cell,{paddingRight:5*s}]}>
          <SectionTitle icon="lizard" label={dayLabel(selectedDay)+' Events'}
            extra={events.length>eventsMax?'+'+(events.length-eventsMax):undefined}
            scale={s} actionLabel="View all" action={()=>{
              setAgendaStart(selectedDay);setAgendaVisit(v=>v+1);setOverlay('agenda');
            }}/>
          {!calendar.snapshot?<TouchableOpacity onPress={onSettings}>
            <Txt size={body} muted>Connect the existing calendar feed in Settings.</Txt>
          </TouchableOpacity>:events.length?
            events.slice(0,eventsMax).map(event=><AgendaRow key={event.key} event={event}
              allEvents={events} scale={s} onPress={()=>openEvent(event)}/>)
          :<Txt size={body} muted>{calendar.status==='cached'?'No events in saved snapshot.':'No events on this day.'}</Txt>}
        </View>
        <View style={[styles.splitter,{marginHorizontal:7*s,marginVertical:9*s}]}/>
        <View style={[styles.cell,{paddingLeft:4*s}]}>
          <SectionTitle icon="plants" label="To-do" scale={s} actionLabel="View all"
            action={()=>launchApp(APPS.todo)}/>
          {activeTasks.length?activeTasks.slice(0,taskMax).map(rowTask):<Txt muted size={body}>
            {taskLoading?'Loading tasks…':taskError||'No incomplete tasks.'}
          </Txt>}
        </View>
      </View>

      <View onLayout={e=>setMiddleH(e.nativeEvent.layout.height)}
        style={{flex:1,minHeight:0,flexDirection:'row',borderBottomWidth:1,borderColor:RULE}}>
        <View style={[styles.cell,{paddingRight:5*s}]}>
          <SectionTitle icon="coffee" label={dayLabel(selectedDay)+' Notes'} scale={s}/>
          {notes.length?notes.slice(0,notesMax).map(rowNote):
            <Txt size={body} muted>No notes created on this day.</Txt>}
        </View>
        <View style={[styles.splitter,{marginHorizontal:7*s,marginVertical:9*s}]}/>
        <View style={[styles.cell,{paddingLeft:4*s}]}>
          <SectionTitle icon="rocks" label="Recent notes" scale={s} actionLabel="View all"
            action={()=>setOverlay('recent')}/>
          {recent.length?recent.slice(0,notesMax).map((path,i)=>rowFile(path,i,fileInfo[path]?.mtime)):
            <Txt size={body} muted>No recent notes.</Txt>}
        </View>
      </View>

      <View onLayout={e=>setBottomH(e.nativeEvent.layout.height)}
        style={{flex:.78,minHeight:0,flexDirection:'row'}}>
        <View style={[styles.cell,{paddingRight:5*s}]}>
          <SectionTitle icon="jellyfish" label="Quick access" scale={s} action={onSettings} actionLabel="Edit"/>
          {pinned.length?pinned.slice(0,quickMax).map(rowPin):
            <TouchableOpacity onPress={onSettings}><Txt muted size={body}>Edit to pin notes and folders.</Txt></TouchableOpacity>}
        </View>
        <View style={[styles.splitter,{marginHorizontal:7*s,marginVertical:9*s}]}/>
        <View style={[styles.cell,{paddingLeft:4*s}]}>
          <SectionTitle icon="chicken" label="ShortCats" scale={s} actionLabel="Edit" action={onSettings}/>
          <View style={{flex:1,flexDirection:'row',minHeight:0}}>
            <View style={{flex:1,flexDirection:'row',flexWrap:'wrap',alignContent:'stretch',paddingBottom:4*s}}>
              {shortcuts.map(item=><View key={item.key} style={{width:'50%',height:'33.333%',padding:2*s}}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={item.name} onPress={item.onPress}
                  style={{flex:1,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#111',borderRadius:6*s}}>
                  <Glyph name={item.icon} size={Math.max(18*s,Math.min(32*s,(bottomH-54*s)/3-6*s))}/>
                </TouchableOpacity>
              </View>)}
            </View>
            <View style={{width:.6,backgroundColor:'#aaa',marginHorizontal:5*s,marginVertical:4*s}}/>
            <View style={{flex:1.05,alignItems:'center',justifyContent:'center',minWidth:0}}>
              <Image accessibilityLabel="Temporary illustration of the cats" source={require('../assets/pretty/cats-placeholder.png')}
                resizeMode="contain" style={{width:'100%',height:'100%'}}/>
            </View>
          </View>
        </View>
      </View>
    </View>

    <Modal transparent animationType="none" visible={overlay!==null}
      onRequestClose={()=>setOverlay(overlay==='event'&&returnToAgenda?'agenda':null)}>
      <View style={styles.shade}>
        <View style={[styles.sheet,{margin:19*s,padding:19*s,
          flex:overlay==='event'?undefined:1,
          height:overlay==='event'?Math.min(530*s,height-100*s):undefined}]}>
          {overlay!=='new-note'&&<View style={{flexDirection:'row',alignItems:'center',marginBottom:13*s}}>
            <IconTap icon="back" label="Back" size={25*s}
              onPress={()=>setOverlay(overlay==='event'&&returnToAgenda?'agenda':null)}/>
            <Txt size={26*s} bold style={{marginLeft:9*s,flex:1}}>
              {overlay==='agenda'?'Calendar · seven-day agenda':
                overlay==='event'?'Event details':
                overlay==='keywords'?'Keywords':
                overlay==='favorites'?'Favorites':'Recent notes'}
            </Txt>
            {overlay==='favorites'&&<TouchableOpacity onPress={()=>{setOverlay(null);onSettings();}}>
              <Txt size={14*s} muted>Edit</Txt>
            </TouchableOpacity>}
          </View>}
          {overlay==='new-note'?<PrettyNoteCreate onClose={()=>setOverlay(null)}/>:
            overlay==='event'&&selectedEvent?
              <ScrollView style={{flex:1}}>
                <View style={{padding:17*s,borderWidth:1,borderColor:'#aaa',
                  borderRadius:8*s,marginTop:8*s}}>
                  <Txt size={14*s} muted>Read-only calendar event</Txt>
                  <Txt size={30*s} bold style={{marginTop:10*s,marginBottom:18*s}}>
                    {selectedEvent.summary}
                  </Txt>
                  <View style={{height:1,backgroundColor:RULE,marginBottom:18*s}}/>
                  <View style={{flexDirection:'row',flexWrap:'wrap'}}>
                    <View style={{width:'50%',paddingRight:12*s,marginBottom:18*s}}>
                      <Txt size={15*s} muted>Date</Txt>
                      <Txt size={21*s} bold>
                        {dayLabel(selectedEvent.startDay)}
                        {addCalendarDays(selectedEvent.endDayExclusive,-1)!==selectedEvent.startDay
                          ?' – '+dayLabel(addCalendarDays(selectedEvent.endDayExclusive,-1)):''}
                      </Txt>
                    </View>
                    <View style={{width:'50%',marginBottom:18*s}}>
                      <Txt size={15*s} muted>{selectedEvent.all_day?'Schedule':'Time'}</Txt>
                      <Txt size={21*s} bold>{selectedEvent.all_day?'All day':eventTimeRange(selectedEvent)}</Txt>
                    </View>
                    <View style={{width:'50%',marginBottom:8*s}}>
                      <Txt size={15*s} muted>Duration</Txt>
                      <Txt size={21*s} bold>{eventDuration(selectedEvent)}</Txt>
                    </View>
                    <View style={{width:'50%',marginBottom:8*s}}>
                      <Txt size={15*s} muted>Calendar</Txt>
                      <Txt size={21*s} bold>{selectedEvent.calendar}</Txt>
                    </View>
                  </View>
                  {hasTimeConflict(selectedEvent,agenda)&&<View style={{flexDirection:'row',
                    alignItems:'center',marginTop:15*s}}>
                    {overlapIcon(s)}<Txt size={16*s}>Overlaps another appointment</Txt>
                  </View>}
                </View>
                <Txt muted size={14*s} style={{marginTop:16*s}}>
                  Changes are read from your existing Pretty Calendar. No events are copied into the native Calendar.
                </Txt>
              </ScrollView>:
            overlay==='agenda'?
              <View style={{flex:1}}>
                <View style={{flexDirection:'row',alignItems:'center',
                  justifyContent:'space-between',marginBottom:10*s}}>
                  <IconTap icon="back" label="Previous seven days" size={22*s}
                    onPress={()=>setAgendaStart(addCalendarDays(agendaStart,-7))}/>
                  <Txt size={17*s} bold>{dayLabel(agendaStart)} – {dayLabel(addCalendarDays(agendaStart,6))}</Txt>
                  <TouchableOpacity onPress={()=>{setAgendaStart(dateKey(new Date()));setAgendaVisit(v=>v+1);}}>
                    <Txt size={16*s} bold>Today</Txt>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=>setAgendaStart(addCalendarDays(agendaStart,7))}
                    style={{paddingHorizontal:10*s}}>
                    <Txt size={23*s}>›</Txt>
                  </TouchableOpacity>
                </View>
                <ScrollView key={agendaVisit+':'+agendaStart} contentContainerStyle={{paddingBottom:24*s}}>
                  <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between'}}>
                    {Array.from({length:7},(_,i)=>addCalendarDays(agendaStart,i)).map(day=>{
                      const dayEvents=agenda.filter(e=>e.startDay<=day&&day<e.endDayExclusive);
                      const allDay=dayEvents.filter(e=>e.all_day),timed=dayEvents.filter(e=>!e.all_day);
                      const coverageStart=agenda.length?agenda.map(e=>e.startDay).sort()[0]:null;
                      const coverageEnd=agenda.length?agenda.map(e=>e.endDayExclusive).sort().slice(-1)[0]:null;
                      const outside=!!coverageStart&&!!coverageEnd&&(day<coverageStart||day>=coverageEnd);
                      return <View key={day} style={{width:'49%',padding:11*s,
                        marginBottom:11*s,borderWidth:1,borderColor:'#bbb',borderRadius:7*s}}>
                        <View style={{paddingBottom:6*s,borderBottomWidth:1,borderColor:RULE,
                            flexDirection:'row',justifyContent:'space-between'}}>
                          <Txt size={21*s} bold>{dayLabel(day)}</Txt>
                        </View>
                        {allDay.length>0&&<View style={{backgroundColor:'#e8e8e8',
                          paddingHorizontal:5*s,marginTop:6*s}}>
                          {allDay.map(e=><AgendaRow key={e.key} event={e} allEvents={dayEvents}
                            scale={s*.9} showSelect onPress={()=>openEvent(e,true)}/>)}
                        </View>}
                        {timed.map(e=><AgendaRow key={e.key} event={e} allEvents={dayEvents}
                          scale={s*.9} showSelect onPress={()=>openEvent(e,true)}/>)}
                        {!dayEvents.length&&<Txt size={14*s} muted style={{marginTop:9*s}}>
                          {outside?'Outside the feed’s available dates':'No events'}
                        </Txt>}
                      </View>;
                    })}
                  </View>
                  {calendar.snapshot&&<>
                    <Txt size={13*s} muted>
                      Last retrieved: {new Date(calendar.snapshot.fetchedAt).toLocaleString('en-US')}
                    </Txt>
                    {calendar.error&&<Txt size={13*s} muted>{calendar.error}</Txt>}
                  </>}
                </ScrollView>
              </View>:
            overlay==='keywords'?
              <ScrollView>
                {keywordBusy&&<Txt size={body} muted>Scanning handwritten keywords…</Txt>}
                {!keywordBusy&&!keywordHits.length&&
                  <Txt size={body} muted>No recognized keywords found.</Txt>}
                {keywordHits.map((hit,i)=><TouchableOpacity key={hit.file+i+hit.page}
                  onPress={()=>{setOverlay(null);openFile(hit.file,hit.page);}}
                  style={{paddingVertical:10*s,borderBottomWidth:1,borderColor:'#ddd'}}>
                  <Txt size={body} bold>{hit.keyword}</Txt>
                  <Txt size={secondary} muted>{fileTitle(hit.file)} · page {hit.page}</Txt>
                </TouchableOpacity>)}
              </ScrollView>:
            overlay==='favorites'?
              <ScrollView>
                {favorites.length?favorites.map(rowPin):
                  <Txt size={body} muted>No favorites yet. Use Edit to pin files and folders.</Txt>}
              </ScrollView>:
            <ScrollView>{recent.map((p,i)=>rowFile(p,i,fileInfo[p]?.mtime))}</ScrollView>}
        </View>
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  cell:{flex:1,minWidth:0,minHeight:0,overflow:'hidden'},
  splitter:{width:1,backgroundColor:'#888'},
  shade:{flex:1,backgroundColor:'#00000055',justifyContent:'center'},
  sheet:{flex:1,backgroundColor:'#fff',borderColor:'#aaa',borderWidth:1,borderRadius:8},
});
