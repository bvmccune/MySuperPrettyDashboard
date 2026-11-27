/**
 * SmartyNote — Manta home.
 * One non-scrolling screen, two equal-height bands; no floating OS overlay.
 * The visually themed icons are intentional custom artwork.
 *
 * Calendar: owner's existing read-only feed, not native event mirroring.
 * To-do: owner's real Supernote Cloud tasks, never a second task database.
 */
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
  AppState,DeviceEventEmitter,Image,ImageSourcePropType,Modal,NativeModules,
  ScrollView,StyleSheet,Text,TextInput,TouchableOpacity,View,useWindowDimensions,
} from 'react-native';
import {DashboardConfig,ShortcutItem} from './config';
import {leavePlugin} from './bubble';
import {launchApp,openNativeSettings,openCalendarToday,openFile,openFolder,openVerifiedTaskPage} from './open';
import {readRecentDetailed} from './recent';
import {dayKey,dueBucket} from './relay';
import {loadPrettyPrefs,PrettyPrefs,quickIcon} from './prettyPrefs';
import {readNativeSupernoteTasks,updateNativeTodo,NativeTodo} from './prettyCloud';
import {noteStableFileId,taskPageIndex} from './notepage';
import {resolveTaskNote} from './prettyTaskLink';
import {
  AgendaEvent,CalendarResult,CALENDAR_REFRESH_MS,dateKey,dayLabel,
  addCalendarDays,agendaFromFeed,eventTimeRange,eventDuration,
  currentCalendar,loadCalendarCache,refreshCalendar,
} from './prettyCalendar';
import {AgendaRow,Conflict,HomeAgendaList,hasTimeConflict} from './PrettyAgenda';
import {PrettyNoteCreate} from './PrettyNoteCreate';
import {PrettyScreenHeader} from './PrettyScreen';
import {PrettyFitList} from './PrettyFitList';
import {quickRows,hiddenQuickPins} from './prettyQuickLayout';
import {DESIGN,dashboardFont,DashboardWeight} from './prettyDesign';
import {DottedRule,HeavyRule} from './PrettyDivider';
import {PrettyTaskDatePicker} from './PrettyTaskDatePicker';
import {INK,PAPER,DARK_GRAY,LIGHT_GRAY} from './prettyPalette';
import {scanKeywords,KeywordHit,scanStars,StarNote} from './scanner';
import {PrettyQuickEditor} from './PrettyQuickEditor';
import {BUILD_LABEL} from './prettyBuild';

const {DashboardNative}=NativeModules;
const NOTE_ROOT='/storage/emulated/0/Note';
const FONT='GoogleSansFlex';
const APPS={
  todo:'com.ratta.supernote.task/com.ratta.supernote.task.TaskActivity',
  search:'com.ratta.search/com.ratta.search.MainActivity',
};
const WEEK=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const FILE_RE=/\.(note|pdf|epub|cbz|xps|fb2)$/i;
type IconName='profile'|'new-note'|'file'|'files'|'calendar'|'recent'|'search'|'stars'|'settings'|'charging'|'notebook'|'plus'|'refresh'|'back'|'lizard'|'plants'|'rocks'|'coffee'|'wifi'|'wifi-off'|'keywords'|'battery'|'calendar-dot'|'open-notebook'|'auto-refresh';
const IMAGES:Record<IconName,ImageSourcePropType>={
  'profile':require('../assets/pretty/profile.png'),
  'new-note':require('../assets/pretty/new-note.png'),
  'file':require('../assets/pretty/file.png'),
  'files':require('../assets/pretty/files.png'),
  'calendar':require('../assets/pretty/calendar.png'),
  'recent':require('../assets/pretty/recent.png'),
  'search':require('../assets/pretty/search.png'),
  'stars':require('../assets/pretty/stars.png'),
  'settings':require('../assets/pretty/settings.png'),
  'charging':require('../assets/pretty/charging.png'),
  'notebook':require('../assets/pretty/notebook.png'),
  'plus':require('../assets/pretty/plus.png'),
  'refresh':require('../assets/pretty/refresh.png'),
  'back':require('../assets/pretty/back.png'),
  'lizard':require('../assets/pretty/lizard.png'),
  'plants':require('../assets/pretty/plants.png'),
  'rocks':require('../assets/pretty/rocks.png'),
  'coffee':require('../assets/pretty/coffee.png'),
  'wifi':require('../assets/pretty/wifi.png'),
  'wifi-off':require('../assets/pretty/wifi-off.png'),
  'keywords':require('../assets/pretty/keywords.png'),
  'battery':require('../assets/pretty/battery.png'),
  'calendar-dot':require('../assets/pretty/calendar-dot.png'),
  'open-notebook':require('../assets/pretty/open-notebook.png'),
  'auto-refresh':require('../assets/pretty/auto-refresh.png'),
};
type Overlay='favorites'|'recent'|'stars'|'keywords'|'agenda'|'event'|'new-note'|'quick-edit'|'task-edit'|'task-link-help'|null;
type Task=NativeTodo;
interface CreatedNote {path:string;createdAt:number}
interface FileInfo {mtime?:number;createdAt?:number}
const DATE_COLOR=INK;
const RULE=DARK_GRAY;

function Glyph({name,size=27,tintColor}:{
  name:IconName;size?:number;tintColor?:string;
}){
  return <Image source={IMAGES[name]} resizeMode="contain"
    style={{width:size,height:size,tintColor}}/>;
}
function Txt({children,size=17,bold=false,muted=false,lines,style,weight}:{
  children:React.ReactNode;size?:number;bold?:boolean;muted?:boolean;
  lines?:number;style?:any;weight?:DashboardWeight;
}){
  return <Text numberOfLines={lines} ellipsizeMode="tail"
    style={[{fontFamily:weight?dashboardFont(weight):FONT,fontSize:size,fontWeight:weight?'normal':bold?'600':'400',
      color:muted?DATE_COLOR:INK,includeFontPadding:false},style]}>{children}</Text>;
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
function SectionTitle({icon,label,scale,action,actionLabel,extra,actionAccessibilityLabel,calendarAction,aboveAction,extraAccessibilityLabel}:{
  icon:IconName;label:string;scale:number;action?:()=>void;
  actionLabel?:string;extra?:string;actionAccessibilityLabel?:string;calendarAction?:()=>void;aboveAction?:string;extraAccessibilityLabel?:string;
}){
  const circle=CIRCLE*scale,fs=DESIGN.heading*scale;
  return <View style={{height:DESIGN.headingHeight*scale,flexDirection:'row',alignItems:'center',minWidth:0}}>
    <View style={{height:circle,width:circle,alignItems:'center',justifyContent:'center',marginRight:6*scale}}>
      <Glyph name={icon} size={circle*120/113}/>
    </View>
    <Txt size={fs} weight={650} lines={1} style={{flexShrink:1}}>{label}</Txt>
    {!!extra&&<TouchableOpacity accessibilityRole="button" accessibilityLabel={extraAccessibilityLabel??extra+' additional events'}
      onPress={action} style={{paddingHorizontal:4*scale,paddingVertical:8*scale}}>
      <Txt size={DESIGN.overflow*scale} weight={700}>{extra}</Txt>
    </TouchableOpacity>}
    <View style={{flex:1}}/>
    {!!action&&<TouchableOpacity accessibilityRole="button"
      accessibilityLabel={actionAccessibilityLabel??actionLabel+' '+label} onPress={action}
      hitSlop={{top:8,bottom:8,left:7,right:7}} style={{marginLeft:7*scale,alignItems:'flex-end'}}>
      {!!aboveAction&&<Txt size={(aboveAction.includes('+')?DESIGN.overflow:DESIGN.action)*scale} weight={aboveAction.includes('+')?700:600}>{aboveAction}</Txt>}
      <Txt size={DESIGN.action*scale} weight={500}>{actionLabel}</Txt>
    </TouchableOpacity>}
    {!!calendarAction&&<IconTap icon="calendar" label="Calendar" size={23*scale} onPress={calendarAction}/>}
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
  return pieces.length===3?pieces[1]+'/'+pieces[2]:due;
}

export function PrettyHome({config,nonce,onSettings}:{
  config:DashboardConfig|null;nonce:number;onSettings:()=>void;
}):React.JSX.Element{
  const {width,height}=useWindowDimensions();
  const s=Math.max(0.8,Math.min(width/760,height/950,1.27));
  const [prefs,setPrefs]=useState<PrettyPrefs|null>(null);
  const fontBoost=prefs?.size==='extra'?1.15:prefs?.size==='large'?1.08:1;
  const body=DESIGN.body*s*fontBoost;
  const secondary=DESIGN.secondary*s*fontBoost;
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
  const [taskBusy,setTaskBusy]=useState(false);
  const taskMutation=useRef(false);
  const taskReadGeneration=useRef(0);
  const [editingTask,setEditingTask]=useState<Task|null>(null);
  const [linkFailure,setLinkFailure]=useState<Task|null>(null);
  const [editTitle,setEditTitle]=useState('');
  const [editDue,setEditDue]=useState('');
  const [datePickerOpen,setDatePickerOpen]=useState(false);
  const [mutationError,setMutationError]=useState('');
  const [overlay,setOverlay]=useState<Overlay>(null);
  const [selectedEvent,setSelectedEvent]=useState<AgendaEvent|null>(null);
  const [returnToAgenda,setReturnToAgenda]=useState(false);
  const [agendaVisit,setAgendaVisit]=useState(0);
  const [refreshTick,setRefreshTick]=useState(0);
  const [starNotes,setStarNotes]=useState<StarNote[]>([]);
  const [starBusy,setStarBusy]=useState(false);
  const [starStatus,setStarStatus]=useState('');
  const [keywordHits,setKeywordHits]=useState<KeywordHit[]>([]);
  const [keywordBusy,setKeywordBusy]=useState(false);
  const [topH,setTopH]=useState(245*s);
  const [middleH,setMiddleH]=useState(245*s);
  // Keep the empty lists stable while preferences load. Otherwise the file
  // metadata effect sees a new dependency on every render and schedules itself.
  const pinned=useMemo(()=>prefs?.quick??[],[prefs]);
  const shortcutRows=useMemo(()=>quickRows(pinned),[pinned]);
  const favorites=useMemo(()=>prefs?.favorites??[],[prefs]);

  useEffect(()=>{
    let live=true;
    loadPrettyPrefs(config).then(p=>{if(live)setPrefs(p);}).catch(()=>{});
    // A previously installed version may have left its floating bubble visible.
    DashboardNative.hideBubble().catch(()=>{});
    return ()=>{live=false;};
  },[config,nonce]);

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

  const refresh=useCallback(()=>{
    const today=new Date();
    setNow(today);
    DashboardNative.getBattery().then(setBattery).catch(()=>{});
    DashboardNative.getNetworkStatus().then(setNetwork).catch(()=>{});
    refreshCalendar().then(setCalendar).catch(()=>{});
    readRecentDetailed().then(r=>setRecent(r.paths.filter(p=>FILE_RE.test(p)))).catch(()=>{});
    scanCreated().catch(()=>{});
    if(taskMutation.current)return;
    const generation=++taskReadGeneration.current;
    setTaskLoading(true);
    readNativeSupernoteTasks().then(result=>{
      if(generation!==taskReadGeneration.current)return;
      setTasks(result.tasks);
      setTaskError(result.truncated?'Supernote returned an incomplete task list.':'');
    }).catch(e=>{if(generation===taskReadGeneration.current){setTasks([]);setTaskError(String(e?.message||'Supernote To-do unavailable'));}})
      .finally(()=>{if(generation===taskReadGeneration.current)setTaskLoading(false);});
  },[scanCreated]);

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
    const items=[...pinned.map(p=>p.path),...favorites.map(p=>p.path),...recent.slice(0,20)].filter(p=>p.startsWith('/storage/'));
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
  },[pinned,favorites,recent,nonce,refreshTick]);

  useEffect(()=>{
    if(overlay!=='keywords')return;
    let live=true;setKeywordBusy(true);
    scanKeywords([NOTE_ROOT]).then(result=>{if(live)setKeywordHits(result.hits);})
      .catch(()=>{if(live)setKeywordHits([]);})
      .finally(()=>{if(live)setKeywordBusy(false);});
    return()=>{live=false;};
  },[overlay,nonce]);

  useEffect(()=>{
    if(overlay!=='stars')return;
    let live=true;setStarBusy(true);setStarStatus('');setStarNotes([]);
    scanStars([NOTE_ROOT,'/storage/emulated/0/Document'],'off').then(result=>{
      if(live){setStarNotes(result.notes);setStarStatus(result.truncated?'Some notebooks could not be scanned. Use native Search for all formats.':'');}
    }).catch((error:unknown)=>{if(live)setStarStatus('Could not scan stars: '+String(error));})
      .finally(()=>{if(live)setStarBusy(false);});
    return()=>{live=false;};
  },[overlay,nonce]);
  const agenda=useMemo(()=>calendar.snapshot?agendaFromFeed(calendar.snapshot.feed):[],[calendar.snapshot]);
  const events=useMemo(()=>agenda.filter(e=>e.startDay<=selectedDay&&selectedDay<e.endDayExclusive),
    [agenda,selectedDay]);
  const notes=useMemo(()=>createdNotes.filter(n=>dateKey(new Date(n.createdAt))===selectedDay),
    [createdNotes,selectedDay]);
  const mergedNotes=useMemo(()=>{const created=notes.slice(0,3);const shown=new Set(notes.map(n=>n.path));return [...created,...recent.filter(p=>!shown.has(p)).map(path=>({path,createdAt:0}))];},[notes,recent]);
  const activeTasks=useMemo(()=>sortTasks(tasks,now),[tasks,now]);
  const weekStart=mondayOf(now);
  const days=WEEK.map((label,i)=>{
    const date=new Date(weekStart);date.setDate(weekStart.getDate()+i);
    const key=dateKey(date);
    return {label,date,key,today:key===dateKey(now),hasNotes:createdDays.has(key)};
  });
  const mutateTask=async(item:Task,change:{complete?:true;title?:string;due?:string|null})=>{
    if(taskMutation.current)return;taskMutation.current=true;++taskReadGeneration.current;setTaskLoading(false);setTaskBusy(true);setMutationError('');
    try{await updateNativeTodo(item.id,change);const result=await readNativeSupernoteTasks();setTasks(result.tasks);setTaskError(result.truncated?'Supernote returned an incomplete task list.':'');setOverlay(null);}
    catch(e:any){setMutationError(String(e?.message??e));}finally{taskMutation.current=false;setTaskBusy(false);}
  };
  const editTask=(item:Task)=>{setDatePickerOpen(false);setEditingTask(item);setEditTitle(item.title);setEditDue(item.due??'');setMutationError('');setOverlay('task-edit');};
  const openTaskNote=async(item:Task)=>{
    const link=item.link;if(!link||taskMutation.current)return;
    taskMutation.current=true;setTaskBusy(true);setMutationError('');
    try{
      const target=await resolveTaskNote(link,async dir=>DashboardNative.listDir(dir),noteStableFileId,taskPageIndex);
      if(target&&await openVerifiedTaskPage(target.path,target.page))return;
      setLinkFailure(item);setOverlay('task-link-help');
    }catch(e:any){setMutationError(String(e?.message??e));setLinkFailure(item);setOverlay('task-link-help');}
    finally{taskMutation.current=false;setTaskBusy(false);}
  };
  const openEvent=(event:AgendaEvent,fromAgenda=false)=>{
    setSelectedEvent(event);setReturnToAgenda(fromAgenda);setOverlay('event');
  };
  const doOpenPinned=(item:ShortcutItem)=>{
    setOverlay(null);
    if(item.path==='app:calendar')openCalendarToday();
    else if(item.path==='app:stars')setOverlay('stars');
    else if(item.kind==='folder')openFolder(item.path);
    else openFile(item.path,item.kind==='note-page'?item.page:0);
  };
  const close=()=>{setOverlay(null);leavePlugin();};
  const refreshAll=()=>{setRefreshTick(v=>v+1);refresh();};
  const listRule={position:'relative' as const};
  const rowLine=body*DESIGN.rowLine;
  const rowMin=DESIGN.rowMin*s;
  const rowMax=Math.max(rowMin,rowLine*3+2*DESIGN.rowPadY*s);
  const fitKey=width+':'+s+':'+fontBoost;
  const rowStamp=(value:string)=><Txt size={secondary} weight={500} style={{maxWidth:105*s,
    textAlign:'right',flexShrink:0,lineHeight:secondary*1.15}}>{value}</Txt>;
  const rowFile=(path:string,i:number,stamp?:number)=>(
    <TouchableOpacity key={path+i} onPress={()=>{setOverlay(null);openFile(path);}}
      style={{minHeight:rowMin,paddingVertical:DESIGN.rowPadY*s,flexShrink:0,flexDirection:'row',alignItems:'center',paddingHorizontal:4*s,...listRule}}>
      <DottedRule scale={s}/><Glyph name={/\.note$/i.test(path)?'notebook':'file'} size={24*s}/>
      <Txt lines={3} size={body} weight={500} style={{flex:1,minWidth:0,marginHorizontal:DESIGN.iconGap*s,lineHeight:rowLine}}>{fileTitle(path)}</Txt>
      {rowStamp(dateAndTime(stamp))}
    </TouchableOpacity>
  );
  const rowPin=(item:ShortcutItem,i:number)=>(
    <TouchableOpacity key={item.path+i} onPress={()=>doOpenPinned(item)}
      style={{minHeight:rowMin,paddingVertical:DESIGN.rowPadY*s,flexShrink:0,flexDirection:'row',alignItems:'center',paddingHorizontal:4*s,...listRule}}>
      <DottedRule scale={s}/><Glyph name="stars" size={24*s}/>
      <Txt lines={3} size={body} weight={500} style={{flex:1,minWidth:0,marginHorizontal:DESIGN.iconGap*s,lineHeight:rowLine}}>
        {item.label||fileTitle(item.path)}
      </Txt>
      {rowStamp(dateAndTime(fileInfo[item.path]?.mtime))}
    </TouchableOpacity>
  );
  const rowTask=(item:Task,i:number)=>{
    const overdue=dueBucket(item.due,now)==='overdue';
    return <View key={item.id+i} style={{minHeight:rowMin,paddingVertical:DESIGN.rowPadY*s,flexShrink:0,flexDirection:'row',alignItems:'center',paddingHorizontal:DESIGN.rowPadX*s,backgroundColor:i%2===0?LIGHT_GRAY:PAPER,...listRule}}>
      <DottedRule scale={s}/><TouchableOpacity disabled={taskBusy||taskLoading} accessibilityLabel={'Complete '+item.title} onPress={()=>mutateTask(item,{complete:true})} style={{padding:3*s}}>
        <View style={{width:22*s,height:22*s,borderRadius:99,borderWidth:1.7,borderColor:INK}}/>
      </TouchableOpacity>
      <TouchableOpacity disabled={taskBusy||taskLoading} onPress={()=>launchApp(APPS.todo)} onLongPress={()=>editTask(item)} accessibilityLabel={'Open task '+item.title+'; long press to edit'} style={{flex:1,minWidth:0,marginLeft:4*s,marginRight:5*s}}>
        <Txt size={body} weight={500} lines={3} style={{lineHeight:rowLine}}>{item.title}</Txt>
      </TouchableOpacity>
      {!!item.link&&<TouchableOpacity disabled={taskBusy} accessibilityLabel={'Open linked note for '+item.title} onPress={()=>openTaskNote(item)} style={{padding:4*s}}><Glyph name="open-notebook" size={22*s}/></TouchableOpacity>}
      {!!item.due&&<View style={{alignItems:'flex-end',flexShrink:0}}>
        {overdue&&<View style={{backgroundColor:INK,paddingHorizontal:5*s,paddingVertical:2*s,borderRadius:3,marginBottom:3*s}}>
          <Text testID="overdue-label" style={{fontFamily:dashboardFont(700),fontSize:DESIGN.overdue*s,color:PAPER,fontWeight:'normal'}}>OVERDUE</Text>
        </View>}
        <Txt size={secondary} weight={500}>{dueShort(item.due)}</Txt>
      </View>}
    </View>;
  };
  const rowNote=(note:CreatedNote,i:number)=>(
    <TouchableOpacity key={note.path+i} onPress={()=>openFile(note.path)}
      style={{minHeight:rowMin,paddingVertical:DESIGN.rowPadY*s,flexShrink:0,flexDirection:'row',alignItems:'center',paddingHorizontal:4*s,...listRule}}>
      <DottedRule scale={s}/><Glyph name="recent" size={23*s}/>
      <Txt size={body} weight={500} lines={3} style={{marginHorizontal:DESIGN.iconGap*s,flex:1,minWidth:0,lineHeight:rowLine}}>{fileTitle(note.path)}</Txt>
      {rowStamp(clockSmall(note.createdAt).toLowerCase())}
    </TouchableOpacity>
  );
  const headerH=113*s,weekH=93*s;

  return <View style={{flex:1,backgroundColor:PAPER,paddingHorizontal:15*s,
    paddingTop:8*s,paddingBottom:8*s}}>
    <View style={{height:headerH,justifyContent:'center'}}>
      <View style={{height:35*s,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <TouchableOpacity onPress={()=>setSelectedDay(dateKey(new Date()))}
          accessibilityRole="button" accessibilityLabel="Select today" style={{flex:1,zIndex:1}}>
          <Txt size={DESIGN.date*s} weight={600}>{dateLong(now)}</Txt>
        </TouchableOpacity>
        <View pointerEvents="box-none" style={{position:'absolute',left:0,right:0,alignItems:'center',zIndex:2}}>
          <TouchableOpacity onPress={close} accessibilityLabel="Close SmartyNote" style={{flexDirection:'row',alignItems:'baseline',padding:5*s}}><Txt size={DESIGN.brand*s} weight={600}>SmartyNote</Txt><Txt size={10*s} muted style={{marginLeft:5*s}}>{BUILD_LABEL}</Txt></TouchableOpacity>
        </View>
        <View style={{flexDirection:'row',alignItems:'center'}}>
          <IconTap icon="refresh" label="Refresh dashboard" size={23*s} onPress={refreshAll}/>
          <IconTap icon="settings" label="Settings" size={23*s} onPress={onSettings}/>
          <Glyph name={network?.wifi?'wifi':'wifi-off'} size={22*s}/>
          <View style={{marginLeft:7*s,flexDirection:'row',alignItems:'center'}}>
            <Txt size={14*s} style={{marginRight:5*s}}>{battery?.level!=null&&battery.level>=0?battery.level+'%':'—'}</Txt>
            <View style={{width:34*s,height:22*s}}>
              <Image source={IMAGES.battery} resizeMode="contain" style={{width:34*s,height:22*s}}/>
              <View style={{position:'absolute',left:4*s,top:5.5*s,
                width:23*s*Math.max(0,Math.min(100,battery?.level??0))/100,height:11*s,backgroundColor:'#000'}}/>
            </View>
            {!!battery?.charging&&<Glyph name="charging" size={17*s}/>}
          </View>
        </View>
      </View>
      <View style={{flexDirection:'row',alignItems:'center',height:75*s}}>
        <View style={{flex:1,minWidth:0}}><Txt size={DESIGN.clock*s} weight={700}>{timeLong(now)}</Txt></View>
        <View style={{width:1,marginHorizontal:7*s}}/>
        <View style={{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',justifyContent:'flex-end',paddingLeft:4*s}}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Supernote Settings" onPress={openNativeSettings}
          style={{width:67*s,height:67*s,alignItems:'center',justifyContent:'center'}}>
          <Glyph name="profile" size={43.5*s}/>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search" onPress={()=>launchApp(APPS.search)}
          style={{width:67*s,height:67*s,alignItems:'center',justifyContent:'center'}}>
          <Glyph name="search" size={43.5*s}/>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose note name, type, template"
          onPress={()=>setOverlay('new-note')}
          style={{width:67*s,height:67*s,alignItems:'center',justifyContent:'center'}}>
          <Glyph name="new-note" size={43.5*s}/>
        </TouchableOpacity>
        </View>
      </View>
    </View>

    <View style={{height:weekH,flexDirection:'row',borderBottomWidth:1,borderColor:RULE}}>
      {days.map(day=><TouchableOpacity key={day.key} onPress={()=>setSelectedDay(day.key)}
        accessibilityRole="button" accessibilityLabel={'Select '+day.date.toDateString()}
        style={{flex:1,alignItems:'center',justifyContent:'center'}}>
        <Txt size={DESIGN.weekday*s} weight={500} style={{marginBottom:3*s}}>{day.label}</Txt>
        <View style={{width:CIRCLE*s,height:CIRCLE*s,borderRadius:CIRCLE*s/2,
          backgroundColor:day.today?INK:PAPER,
          borderWidth:!day.today&&selectedDay===day.key?1.2:0,borderColor:DARK_GRAY,
          alignItems:'center',justifyContent:'center'}}>
          <Txt size={DESIGN.dateNumber*s} weight={day.today?600:400} style={{color:day.today?PAPER:INK}}>
            {day.date.getDate()}
          </Txt>
        </View>
        <View style={{height:6*s,marginTop:2*s}}>
          {day.hasNotes&&<View style={{height:5*s,width:5*s,borderRadius:99,backgroundColor:INK}}/>}
        </View>
      </TouchableOpacity>)}
    </View>

    <View style={{flex:1,minHeight:0}}>
      <View onLayout={e=>setTopH(e.nativeEvent.layout.height)}
        style={{flex:1,minHeight:0,flexDirection:'row',borderBottomWidth:1,borderColor:RULE}}>
        <View style={[styles.cell,{paddingRight:5*s}]}>
          <HomeAgendaList key={selectedDay+':'+width+':'+fontBoost+':'+(calendar.snapshot?.fetchedAt??0)}
            day={selectedDay} events={events} scale={s} fontBoost={fontBoost} initialHeight={Math.max(0,topH-53*s)}
            header={hidden=><SectionTitle icon="coffee" label={dayLabel(selectedDay)+' Events'}
              extra={hidden>0?'+'+hidden:undefined} scale={s} actionLabel="View all" calendarAction={openCalendarToday}
              actionAccessibilityLabel="View all events" action={()=>{
                setAgendaStart(selectedDay);setAgendaVisit(v=>v+1);setOverlay('agenda');
              }}/>}
            onEvent={event=>openEvent(event)}
            empty={!calendar.snapshot?<TouchableOpacity onPress={onSettings}>
              <Txt size={body} muted>Connect the existing calendar feed in Settings.</Txt>
            </TouchableOpacity>:<Txt size={body} muted>{calendar.status==='cached'?'No events in saved snapshot.':'No events in current feed for this day.'}</Txt>}/>
        </View>
        <View style={[styles.splitter,{marginHorizontal:7*s,marginVertical:9*s}]}/>
        <View style={[styles.cell,{paddingLeft:4*s}]}>
          <SectionTitle icon="plants" label="To-do" scale={s} actionLabel="View all"
            action={()=>launchApp(APPS.todo)}/>
          {!!mutationError&&overlay!=='task-edit'&&<Txt size={secondary}>{mutationError}</Txt>}
          {!!taskError&&tasks.length>0&&<Txt size={secondary}>{taskError}</Txt>}
          <PrettyFitList key={'tasks:'+fitKey} items={activeTasks}
            keyOf={(item,i)=>item.id+':'+i+':'+item.title+':'+item.due}
            renderRow={rowTask} minHeight={rowMin} maxHeight={rowMax} initialHeight={topH-53*s}
            empty={<Txt muted size={body}>{taskLoading?'Loading tasks…':taskError||'No incomplete tasks.'}</Txt>}/>
        </View>
      </View>

      <View onLayout={e=>setMiddleH(e.nativeEvent.layout.height)} style={{flex:1,minHeight:0,flexDirection:'row'}}>
        <View style={[styles.cell,{paddingRight:5*s}]}>
          <PrettyFitList key={'quick:'+fitKey} testID="quick-fit-body" items={shortcutRows}
            keyOf={(row,i)=>'quick-'+i+':'+JSON.stringify(row)}
            initialHeight={Math.max(0,middleH-DESIGN.headingHeight*s)}
            minHeight={DESIGN.quickRow*s}
            maxHeight={Math.max(DESIGN.quickRow*s,rowLine*3+(2*DESIGN.quickPadY+2*DESIGN.quickGap)*s+2)}
            header={hidden=>{
              const count=hiddenQuickPins(shortcutRows,hidden);
              return <SectionTitle icon="rocks" label="Quick access" scale={s}
                extra={count?'+'+count:undefined} extraAccessibilityLabel={count+' additional shortcuts'}
                action={()=>setOverlay('quick-edit')} actionLabel="Edit"/>;
            }}
            renderRow={(row,i)=><View style={{flexDirection:'row',alignItems:'stretch',minHeight:DESIGN.quickRow*s}}>
              {row.map((item,col)=>item===undefined?
                <View key={col} style={{flex:1,minWidth:0,margin:DESIGN.quickGap*s}}/>:
                <TouchableOpacity key={col} accessibilityRole="button" accessibilityLabel={item?'Quick access: '+item.label:'Add Quick access shortcut'}
                  onPress={()=>item?doOpenPinned(item):setOverlay('quick-edit')}
                  style={{flex:1,minWidth:0,margin:DESIGN.quickGap*s,borderWidth:1,borderRadius:7*s,borderColor:INK,
                    flexDirection:'row',alignItems:'center',paddingHorizontal:DESIGN.quickPadX*s,paddingVertical:DESIGN.quickPadY*s}}>
                  {item===null?<Glyph name="plus" size={18*s}/>:<><Glyph name={quickIcon(item)} size={DESIGN.quickIcon*s}/>
                    <Txt size={body} weight={500} lines={3} style={{flex:1,minWidth:0,marginLeft:DESIGN.iconGap*s,lineHeight:rowLine}}>{item.label}</Txt></>}
                </TouchableOpacity>)}
            </View>}
            empty={null}/>

        </View>
        <View style={[styles.splitter,{marginHorizontal:7*s,marginVertical:9*s}]}/>
        <View style={[styles.cell,{paddingLeft:4*s}]}>
          <PrettyFitList key={'merged:'+fitKey+':'+selectedDay} items={mergedNotes}
            keyOf={(item,i)=>item.path+':'+item.createdAt+':'+i}
            header={hidden=>{const visible=mergedNotes.length-hidden;const overflow=notes.length-Math.min(3,notes.length,visible);
              return <SectionTitle icon="lizard" label="Recent notes" scale={s} actionLabel="View all"
                aboveAction={(selectedDay===dateKey(now)?'Today':dayLabel(selectedDay))+(overflow>0?' +'+overflow:'')}
                action={()=>setOverlay('recent')}/>;}}
            renderRow={(item,i)=>item.createdAt?rowNote({path:item.path,createdAt:item.createdAt},i):
              <View>{i===Math.min(3,notes.length)&&i>0&&<HeavyRule scale={s}/>}{rowFile(item.path,i,fileInfo[item.path]?.mtime)}</View>}
            minHeight={rowMin} maxHeight={rowMax} initialHeight={middleH-53*s}
            empty={<Txt size={body} muted>No recent notes.</Txt>}/>
        </View>
      </View>
    </View>

    <Modal transparent={false} animationType="none" visible={overlay!==null}
      onRequestClose={()=>{if(!taskBusy){if(datePickerOpen)setDatePickerOpen(false);else setOverlay(overlay==='event'&&returnToAgenda?'agenda':null);}}}>
      <View style={styles.screen}>
          {overlay==='quick-edit'?<PrettyQuickEditor prefs={prefs} onSaved={next=>{setPrefs(next);setOverlay(null);}} onClose={()=>setOverlay(null)}/>:overlay==='task-link-help'&&linkFailure?<>
            <PrettyScreenHeader title="Linked task" left={{label:'Close',onPress:()=>setOverlay(null)}}/>
            <View style={{padding:20*s,gap:12*s}}><Txt bold>{linkFailure.title}</Txt><Txt>SmartyNote could not verify the linked notebook and page. Use Supernote To-do's own link to open the exact handwritten task.</Txt><TouchableOpacity onPress={()=>{setOverlay(null);launchApp(APPS.todo);}} style={{padding:12*s,borderWidth:1,borderColor:INK}}><Txt bold>Open native To-do</Txt></TouchableOpacity>{!!mutationError&&<Txt>{mutationError}</Txt>}</View>
          </>:overlay==='task-edit'&&editingTask?(datePickerOpen?<PrettyTaskDatePicker value={editDue} onCancel={()=>setDatePickerOpen(false)} onSave={value=>{setEditDue(value);setDatePickerOpen(false);}}/>:<>
            <PrettyScreenHeader title="Edit task" left={{label:'Cancel',onPress:()=>setOverlay(null),disabled:taskBusy}} right={{label:'Save',onPress:()=>mutateTask(editingTask,{...(editTitle.trim()!==editingTask.title?{title:editTitle}:{}),...((editDue.trim()||null)!==editingTask.due?{due:editDue.trim()||null}:{})}),disabled:taskBusy}}/>
            <View style={{padding:20*s,gap:12*s}}><Txt>Task name</Txt><TextInput value={editTitle} onChangeText={setEditTitle} style={{borderWidth:1,padding:10*s,fontSize:body,color:INK}}/><Txt>Due date</Txt><TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose due date" onPress={()=>setDatePickerOpen(true)} disabled={taskBusy} style={{borderWidth:1,borderColor:INK,padding:10*s,flexDirection:'row',alignItems:'center'}}><Glyph name="calendar" size={24*s}/><Txt size={body} style={{marginLeft:8*s}}>{editDue||'No due date'}</Txt></TouchableOpacity>{!!mutationError&&<Txt>{mutationError}</Txt>}{taskBusy&&<Txt>Saving to Supernote…</Txt>}</View>
          </>):overlay==='new-note'?<PrettyNoteCreate onClose={()=>setOverlay(null)}/>:<>
            <PrettyScreenHeader
              title={overlay==='agenda'?'Seven-day agenda':overlay==='event'?'Event details':
                overlay==='stars'?'Stars':overlay==='keywords'?'Keywords':overlay==='favorites'?'Favorites':'Recent notes'}
              left={{label:overlay==='event'&&returnToAgenda?'Back':'Close',
                onPress:()=>setOverlay(overlay==='event'&&returnToAgenda?'agenda':null)}}
              right={overlay==='stars'?{label:'Native search',onPress:()=>{setOverlay(null);launchApp(APPS.search);}}:overlay==='favorites'?{label:'Edit',onPress:()=>{setOverlay(null);onSettings();}}:undefined}/>
            <View style={{flex:1,paddingHorizontal:19*s,paddingTop:15*s,paddingBottom:12*s}}>
            {overlay==='event'&&selectedEvent?
              <ScrollView style={{flex:1}}>
                <View style={{padding:17*s,borderWidth:1,borderColor:DARK_GRAY,
                  borderRadius:0,marginTop:8*s}}>
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
                    <Conflict scale={s}/><Txt size={16*s} style={{marginLeft:7*s}}>Overlaps another appointment</Txt>
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
                  <Txt size={19*s} bold>{dayLabel(agendaStart)} – {dayLabel(addCalendarDays(agendaStart,6))}</Txt>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Today" onPress={()=>{setAgendaStart(dateKey(new Date()));setAgendaVisit(v=>v+1);}}>
                    <Txt size={16*s} bold>Today</Txt>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next seven days" onPress={()=>setAgendaStart(addCalendarDays(agendaStart,7))}
                    style={{paddingHorizontal:10*s}}>
                    <Txt size={23*s}>›</Txt>
                  </TouchableOpacity>
                </View>
                <ScrollView key={agendaVisit+':'+agendaStart} contentContainerStyle={{paddingBottom:24*s}}>
                  <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between'}}>
                    {Array.from({length:7},(_,i)=>addCalendarDays(agendaStart,i)).map(day=>{
                      const dayEvents=agenda.filter(e=>e.startDay<=day&&day<e.endDayExclusive);
                      const allDay=dayEvents.filter(e=>e.all_day),timed=dayEvents.filter(e=>!e.all_day);
                      return <View key={day} style={{width:'49%',padding:8*s,
                        marginBottom:9*s,borderWidth:1,borderColor:DARK_GRAY,borderRadius:0}}>
                        <View style={{paddingBottom:6*s,borderBottomWidth:1,borderColor:RULE,
                            flexDirection:'row',justifyContent:'space-between'}}>
                          <Txt size={DESIGN.heading*s} weight={650}>{dayLabel(day)}</Txt>
                        </View>
                        {allDay.length>0&&<View style={{backgroundColor:LIGHT_GRAY,
                          paddingHorizontal:5*s,marginTop:6*s}}>
                          {allDay.map(e=><AgendaRow key={e.key} event={e} allEvents={dayEvents}
                            scale={s} fontBoost={fontBoost} showSelect onPress={()=>openEvent(e,true)}/>)}
                        </View>}
                        {timed.map(e=><AgendaRow key={e.key} event={e} allEvents={dayEvents}
                          scale={s} fontBoost={fontBoost} showSelect onPress={()=>openEvent(e,true)}/>)}
                        {!dayEvents.length&&<Txt size={14*s} muted style={{marginTop:9*s}}>
                          No events in current feed
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
            overlay==='stars'?
              <ScrollView>
                <Txt size={secondary} muted>Stars in your notebooks. For PDF stars, use Native search and select Star.</Txt>
                {starBusy&&<Txt size={body}>Scanning notebooks…</Txt>}
                {!!starStatus&&<Txt size={body}>{starStatus}</Txt>}
                {!starBusy&&!starStatus&&!starNotes.length&&<Txt size={body} muted>No starred notebook pages found.</Txt>}
                {starNotes.flatMap(note=>note.pages.map(page=><TouchableOpacity key={note.file+':'+page.page} accessibilityLabel={'Open '+fileTitle(note.file)+' page '+page.page}
                  onPress={()=>{setOverlay(null);openFile(note.file,page.page);}} style={{paddingVertical:12*s,borderBottomWidth:1,borderColor:DARK_GRAY,flexDirection:'row',alignItems:'center'}}>
                  <Glyph name="stars" size={24*s}/><View style={{flex:1,marginLeft:8*s}}><Txt size={body} bold>{fileTitle(note.file)}</Txt><Txt size={secondary} muted>Page {page.page} · {page.count} {page.count===1?'star':'stars'}</Txt></View>
                </TouchableOpacity>))}
              </ScrollView>:
            overlay==='keywords'?
              <ScrollView>
                {keywordBusy&&<Txt size={body} muted>Scanning handwritten keywords…</Txt>}
                {!keywordBusy&&!keywordHits.length&&
                  <Txt size={body} muted>No recognized keywords found.</Txt>}
                {keywordHits.map((hit,i)=><TouchableOpacity key={hit.file+i+hit.page}
                  onPress={()=>{setOverlay(null);openFile(hit.file,hit.page);}}
                  style={{paddingVertical:10*s,borderBottomWidth:1,borderColor:DARK_GRAY}}>
                  <Txt size={body} bold>{hit.keyword}</Txt>
                  <Txt size={secondary} muted>{fileTitle(hit.file)} · page {hit.page}</Txt>
                </TouchableOpacity>)}
              </ScrollView>:
            overlay==='favorites'?
              <ScrollView>
                {favorites.length?favorites.map(rowPin):
                  <Txt size={body} muted>No favorites yet. Use Edit to pin files and folders.</Txt>}
              </ScrollView>:
            <ScrollView>{notes.map(rowNote)}{!!notes.length&&<HeavyRule scale={s}/>}{recent.filter(p=>!notes.some(n=>n.path===p)).map((p,i)=>rowFile(p,i,fileInfo[p]?.mtime))}</ScrollView>}
            </View>
          </>}
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  cell:{flex:1,minWidth:0,minHeight:0,overflow:'hidden'},
  splitter:{width:1,backgroundColor:DARK_GRAY},
  screen:{flex:1,backgroundColor:PAPER},
});
