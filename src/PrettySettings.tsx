/**
 * Settings for MySuperPrettyDashboard, not the inherited widget-grid wizard.
 * Native Supernote To-do remains authoritative; this screen only connects it.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Linking, NativeModules, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {DashboardConfig, loadConfig, ShortcutItem} from './config';
import {loadPrettyPrefs, PrettyPrefs, savePrettyPrefs} from './prettyPrefs';
import {
  disconnectSupernote, hasSupernoteLogin, readNativeSupernoteTasks,
  startSupernoteLogin, verifySupernoteLogin, LoginProgress,
} from './prettyCloud';
import {setRoute} from './route';
import {CalendarResult, currentCalendar, loadCalendarCache, refreshCalendar, configureCalendarSource, isCalendarSourceConfigured} from './prettyCalendar';
import {openFile, openFolder} from './open';
import {PrettyScreenHeader, SCREEN_BODY} from './PrettyScreen';
import {WeatherIcon} from './WeatherIcon';
import {WeatherLocation,searchWeatherLocations,refreshWeather,DEFAULT_WEATHER_LOCATION} from './prettyWeather';
import {ARTWORK_DIR} from './PrettySummaryPanel';

const {DashboardNative} = NativeModules;
const BASE = '/storage/emulated/0';
const ROOTS = [BASE + '/Note',BASE + '/Document',BASE + '/MyStyle'];
type FileEntry = {name:string; path:string;isDir:boolean;mtime:number};
const FONT = 'GoogleSansFlex';
function TextLine({children, big=false, faint=false, bold=false}: {children:React.ReactNode;big?:boolean;faint?:boolean;bold?:boolean}) {
  return <Text style={{fontFamily:FONT,fontSize:big?26:SCREEN_BODY,color:faint?'#555':'#111',fontWeight:bold?'600':'400',lineHeight:big?35:29}}>{children}</Text>;
}
function Action({children,onPress,filled=false,small=false,disabled=false}: {children:React.ReactNode;onPress:()=>void;filled?:boolean;small?:boolean;disabled?:boolean}) {
  return <TouchableOpacity onPress={onPress} disabled={disabled}
    style={{paddingVertical:small?7:11,paddingHorizontal:small?10:15,borderRadius:0,borderWidth:1,borderColor:'#777',backgroundColor:filled?'#111':'#fff',opacity:disabled ? 0.5 : 1,alignSelf:'flex-start',marginRight:8,marginVertical:3}}>
    <Text style={{color:filled?'#fff':'#111',fontFamily:FONT,fontSize:small?18:20}}>{children}</Text>
  </TouchableOpacity>;
}
function Divider() {return <View style={{height:1,backgroundColor:'#bbb',marginVertical:13}}/>;}
function Group({title,children}: {title:string;children:React.ReactNode}) {
  return <View style={{marginVertical:7}}>
    <TextLine big bold>{title}</TextLine>
    <View style={{marginTop:8}}>{children}</View>
    <Divider/>
  </View>;
}

export function PrettySettings(): React.JSX.Element {
  const [legacy,setLegacy] = useState<DashboardConfig|null>(null);
  const [prefs,setPrefs] = useState<PrettyPrefs|null>(null);
  const [busy,setBusy] = useState(false);
  const [status,setStatus] = useState('');
  const [connected,setConnected] = useState(false);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [code,setCode] = useState('');
  const [progress,setProgress] = useState<LoginProgress|null>(null);
  const [picker,setPicker] = useState<'quick'|'favorites'|null>(null);
  const [dir,setDir] = useState(ROOTS[0]);
  const [entries,setEntries] = useState<FileEntry[]>([]);
  const [calendarState,setCalendarState] = useState<CalendarResult>(()=>currentCalendar());
  const [calendarConfigured,setCalendarConfigured] = useState(false);
  const [calendarSourceInput,setCalendarSourceInput] = useState('');
  const [locationQuery,setLocationQuery]=useState('');
  const [locations,setLocations]=useState<WeatherLocation[]>([]);
  // Serialize writes: rapid edits must never allow an older save to replace
  // newer settings. Done waits for disk persistence and verifies the read-back.
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true));
  const latestPrefs = useRef<PrettyPrefs|null>(null);

  useEffect(() => {
    let live=true;
    (async()=>{
      const cfg=await loadConfig();
      const next=await loadPrettyPrefs(cfg);
      if(live){setLegacy(cfg);setPrefs(next);latestPrefs.current=next;}
      const ok=await hasSupernoteLogin().catch(()=>false);
      if(live)setConnected(ok);
      const cached=await loadCalendarCache();
      if(live)setCalendarState(cached);
      const configured=await isCalendarSourceConfigured().catch(()=>false);
      if(live)setCalendarConfigured(configured);
    })().catch(e=>{if(live)setStatus(String(e?.message??e));});
    return()=>{live=false;};
  },[]);
  useEffect(() => {
    if(!picker)return;
    let live=true;
    DashboardNative.listDir(dir).then((items:FileEntry[])=>{
      if(live)setEntries((items||[]).filter(item=>item.isDir || /\.(note|pdf|epub|cbz|xps|fb2)$/i.test(item.name)).sort((a,b)=>Number(b.isDir)-Number(a.isDir)||a.name.localeCompare(b.name)));
    }).catch(()=>{if(live)setEntries([]);});
    return()=>{live=false;};
  },[dir,picker]);

  const save = (next:PrettyPrefs) => {
    latestPrefs.current=next;
    setPrefs(next);
    saveQueue.current=saveQueue.current.catch(()=>false).then(async()=>{
      const ok=await savePrettyPrefs(next);
      if(!ok)setStatus('Could not save settings. Check file permissions.');
      return ok;
    });
  };
  const saveAndExit = async () => {
    if(busy)return;
    setBusy(true);setStatus('Saving and verifying settings…');
    let stage='Settings save';
    try{
      const ok=await saveQueue.current;
      if(!ok)throw new Error('Saving failed. Settings have not been confirmed on disk.');
      const check=await loadPrettyPrefs(legacy);
      if(JSON.stringify(check)!==JSON.stringify(latestPrefs.current))
        throw new Error('Saved settings differ from your selections. Please try again.');
      stage='Opening dashboard';
      setRoute('dashboard');
    }catch(e:any){setStatus(stage+' failed: '+String(e?.message??e));}
    finally{setBusy(false);}
  };
  const pin = (path:string,isDir:boolean) => {
    if(!prefs || !picker)return;
    const key=picker;
    const items=prefs[key];
    if(items.some(p=>p.path===path)){setStatus('Already pinned.');return;}
    const label=path.split('/').pop()?.replace(/\.(note|pdf|epub)$/i,'')||path;
    const item:ShortcutItem=isDir?{kind:'folder',label,path}:{kind:'note-last',label,path};
    save({...prefs,[key]:[...items,item].slice(0,30)});
    setStatus('Added '+label+'.');
    setPicker(null);
  };
  // Uses the SAME tested open functions as the home screen. Opening an item
  // directly from Settings lets users verify a pin before they rely on it.
  const openPin = (item: ShortcutItem) => {
    if (item.kind === 'folder') openFolder(item.path);
    else openFile(item.path, item.kind === 'note-page' ? item.page : 0);
  };
  const removePin = (key:'quick'|'favorites', index:number) => {
    if(!prefs)return;
    save({...prefs,[key]:prefs[key].filter((_,i)=>i!==index)});
  };
  const movePin = (key:'quick'|'favorites',index:number,dirDelta:number) => {
    if(!prefs)return;
    const copy=[...prefs[key]],at=index+dirDelta;
    if(at<0||at>=copy.length)return;
    const item=copy.splice(index,1)[0];
    copy.splice(at,0,item);
    save({...prefs,[key]:copy});
  };
  const attempt = async(fn:()=>Promise<void>)=>{
    if(busy)return;setBusy(true);setStatus('');
    try {await fn();}
    catch(e:any){setStatus(String(e?.message??e));}
    finally {setBusy(false);}
  };
  const signIn = ()=>attempt(async()=>{
    const r=await startSupernoteLogin(email,password);
    setPassword('');
    if(r.kind==='verify'){setProgress(r);setStatus('Supernote emailed a verification code. Enter it below.');}
    else {setProgress(null);setConnected(true);setStatus('Connected. The dashboard will read your existing Supernote To-do tasks.');}
  });
  const verify = ()=>attempt(async()=>{
    if(!progress||progress.kind!=='verify')return;
    await verifySupernoteLogin(email,code,progress.key,progress.timestamp);
    setCode('');setProgress(null);setConnected(true);
    setStatus('Connected. The dashboard will read your existing Supernote To-do tasks.');
  });
  const saveCalendarSource = ()=>attempt(async()=>{
    await configureCalendarSource(calendarSourceInput);
    setCalendarConfigured(true);setCalendarSourceInput('');
    const result=await refreshCalendar();
    setCalendarState(result);
    setStatus(result.error
      ? 'Feed URL saved locally. Calendar request: '+result.error
      : 'Calendar feed saved and retrieved.');
  });
  const syncCalendar = ()=>attempt(async()=>{
    const result=await refreshCalendar();
    setCalendarState(result);
    setStatus(result.error
      ? 'Calendar refresh failed. '+result.error+(result.snapshot?' Last saved copy kept.':'')
      : 'Calendar feed retrieved. '+result.snapshot?.feed.events.length+' event records.');
  });
  const testSync = ()=>attempt(async()=>{
    const tasks=await readNativeSupernoteTasks();
    setStatus('Supernote Cloud returned '+tasks.tasks.length+' incomplete task'+(tasks.tasks.length===1?'':'s')+(tasks.truncated?' (list truncated)':'')+'.');
  });
  const disconnect = ()=>attempt(async()=>{
    await disconnectSupernote();setConnected(false);setProgress(null);
    setStatus('Disconnected. No To-do task copy is stored in this dashboard.');
  });

  if(!prefs||!legacy)return <View style={styles.screen}>
    <PrettyScreenHeader title="Settings"/>
    <View style={styles.root}><TextLine>{status||'Loading MySuperPrettyDashboard settings…'}</TextLine></View>
  </View>;
  if(picker)return (
    <View style={styles.screen}>
      <PrettyScreenHeader title={picker==='quick'?'Quick access':'Favorites'}
        left={{label:'Back',onPress:()=>setPicker(null)}}/>
      <View style={styles.root}>
      <View style={{flexDirection:'row',flexWrap:'wrap',marginBottom:10}}>
        {ROOTS.map(root=><Action key={root} small onPress={()=>setDir(root)}>{root.split('/').pop()}</Action>)}
        <Action small onPress={()=>{const p=dir.split('/');if(p.length>4)setDir(p.slice(0,-1).join('/'));}}>Up one folder</Action>
      </View>
      <TextLine faint>{dir}</TextLine>
      <View style={{flexDirection:'row',marginVertical:9}}>
        <Action small filled onPress={()=>pin(dir,true)}>Pin this folder</Action>
      </View>
      <ScrollView style={{flex:1}}>
        {entries.map(e=><TouchableOpacity key={e.path} style={styles.pickRow} onPress={()=>e.isDir?setDir(e.path):pin(e.path,false)}>
          <TextLine>{e.isDir?'▱ ':'▤ '}{e.name}{e.isDir?'  ›':'  +'}</TextLine>
        </TouchableOpacity>)}
        {!entries.length && <TextLine faint>No available files here.</TextLine>}
      </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <PrettyScreenHeader title="Settings"
        left={{label:'Close',onPress:saveAndExit,disabled:busy}}
        right={{label:'Done',onPress:saveAndExit,disabled:busy,accessibilityLabel:'Done · Save and return'}}/>
      <View style={styles.root}>
      <ScrollView style={{flex:1}} keyboardShouldPersistTaps="handled">
        <Group title="Pretty Calendar · read-only events">
          <TextLine faint>Uses your existing TRMNL Pretty Calendar Cloudflare feed directly. No additional calendars, accounts, sign-ins or native Calendar event records are created.</TextLine>
          <TextLine faint>One-time setup: paste your existing Cloudflare Worker /calendar URL. It will be stored encrypted on this Manta, not in the public GitHub repository.</TextLine>
          {calendarConfigured&&<TextLine>Calendar feed address saved privately</TextLine>}
          <TextInput style={styles.input} placeholder={calendarConfigured?'Replace feed URL (optional)':'https://your-worker.workers.dev/calendar'}
            autoCapitalize="none" autoCorrect={false} keyboardType="url"
            value={calendarSourceInput} onChangeText={setCalendarSourceInput}/>
          <Action disabled={busy||!calendarSourceInput.trim()} onPress={saveCalendarSource}>
            {calendarConfigured?'Update source URL':'Connect existing Pretty Calendar feed'}
          </Action>
          <TextLine faint>Dashboard refreshes the snapshot on opening, on request, and every five minutes while active. Failed or offline requests retain the last successful snapshot in the plugin's private app storage.</TextLine>
          <TextLine>Status: {calendarState.status==='fresh'?'Current':calendarState.status==='empty'?'Source has no events':calendarState.status==='cached'?'Saved offline snapshot':calendarState.status==='loading'?'Loading':'Unavailable'}</TextLine>
          {calendarState.snapshot&&<>
            <TextLine faint>Last retrieved: {new Date(calendarState.snapshot.fetchedAt).toLocaleString('en-US')}</TextLine>
            {calendarState.snapshot.feed.updated_at!=null&&
              <TextLine faint>Source updated: {String(calendarState.snapshot.feed.updated_at)}</TextLine>}
            {calendarState.snapshot.feed.polled_at!=null&&
              <TextLine faint>Source polled: {String(calendarState.snapshot.feed.polled_at)}</TextLine>}
          </>}
          {calendarState.error&&<TextLine faint>Last request: {calendarState.error}</TextLine>}
          <Action filled disabled={busy} onPress={syncCalendar}>Refresh Pretty Calendar now</Action>
          <TextLine faint>Privacy: Confirm your employer permits this existing calendar feed. Anyone with access to the endpoint may be able to retrieve the work event titles if it is not protected by authentication.</TextLine>
        </Group>
        <Group title="Weather and availability">
          <TextLine>Weather location: {prefs.weatherLocation?.name??DEFAULT_WEATHER_LOCATION.name}</TextLine>
          <TextLine faint>Open-Meteo · current temperature and local daily high/low in °F. Sun and moon artwork follows sunrise and sunset at the selected city. No GPS required.</TextLine>
          <TextInput style={styles.input} value={locationQuery} onChangeText={setLocationQuery} placeholder="City or ZIP code"/>
          <Action disabled={busy} onPress={()=>attempt(async()=>{const results=await searchWeatherLocations(locationQuery);setLocations(results);setStatus(results.length?'Choose the matching city.':'No cities found.');})}>Find location</Action>
          {locations.map((location,i)=><Action key={i} small disabled={busy} onPress={()=>{if(!prefs)return;save({...prefs,weatherLocation:location});setLocations([]);setLocationQuery('');setStatus('Weather location saved: '+location.name);}}>{location.name}</Action>)}
          <Action disabled={busy} onPress={()=>attempt(async()=>{const result=await refreshWeather(prefs.weatherLocation??DEFAULT_WEATHER_LOCATION,true);setStatus(result.error?'Weather refresh: '+result.error:'Weather updated.');})}>Refresh weather now</Action>
          <TextLine faint>Availability shows the current and next calendar states for today, using timed events only. It does not use working hours.</TextLine>
          <TextLine bold>Rotating artwork</TextLine>
          <TextLine faint>Copy your PNG, JPEG or WebP illustrations into MyStyle/Plugins/MySuperPrettyDashboard/artwork. One illustration is selected per day. With a single file, it stays fixed.</TextLine>
          <Action disabled={busy} onPress={()=>attempt(async()=>{await DashboardNative.writeFile(ARTWORK_DIR+'/.keep','');setStatus('Artwork folder is ready. Copy your possum image there.');})}>Create artwork folder</Action>
          <TouchableOpacity accessibilityRole="link" onPress={()=>Linking.openURL('https://open-meteo.com/').catch(()=>setStatus('Weather data: https://open-meteo.com/'))}><Text style={{fontFamily:FONT,fontSize:18,color:'#111',textDecorationLine:'underline'}}>Weather data by Open-Meteo (CC BY 4.0)</Text></TouchableOpacity>
        </Group>
        <Group title="Supernote To-do · your existing list">
          <TextLine faint>This reads your actual Supernote To-do items through Supernote Cloud. It does not create a second list. Ensure To-do cloud sync is enabled on the device.</TextLine>
          <TextLine faint>The connection uses Supernote's unofficial cloud API. The account password and verification code are never saved; the session is encrypted on this device. Supernote sessions expire after approximately 30 days.</TextLine>
          {connected?(
            <View style={{marginTop:9}}>
              <TextLine>Connected to Supernote To-do</TextLine>
              <View style={{flexDirection:'row',flexWrap:'wrap'}}>
                <Action filled disabled={busy} onPress={testSync}>Test sync</Action>
                <Action disabled={busy} onPress={disconnect}>Disconnect</Action>
              </View>
            </View>
          ):(
            <>
              <TextInput style={styles.input} placeholder="Supernote account email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail}/>
              {!progress&&<TextInput style={styles.input} placeholder="Supernote account password" secureTextEntry value={password} onChangeText={setPassword}/>}
              {progress?.kind==='verify'?(
                <View>
                  <TextInput style={styles.input} placeholder="Verification code from Supernote email" autoCapitalize="characters" value={code} onChangeText={setCode}/>
                  <Action filled disabled={busy} onPress={verify}>Verify and connect</Action>
                  <Action disabled={busy} onPress={()=>setProgress(null)}>Start again</Action>
                </View>
              ):<Action filled disabled={busy} onPress={signIn}>Connect Supernote To-do</Action>}
            </>
          )}
        </Group>
        <Group title="Quick access · pinned notebooks and files">
          <TextLine faint>These are dashboard-managed links independent of native Supernote Quick Access. Home shows as many as can fit; Edit here changes their order. Each link opens the existing file or folder.</TextLine>
          {prefs.quick.map((item,i)=>(
            <View style={styles.entry} key={item.path}>
              <View style={{flex:1}}><TextLine>{item.label}</TextLine><TextLine faint>{item.path}</TextLine></View>
              <Action small onPress={()=>openPin(item)}>Test open</Action>
              <Action small onPress={()=>movePin('quick',i,-1)}>↑</Action>
              <Action small onPress={()=>movePin('quick',i,1)}>↓</Action>
              <Action small onPress={()=>removePin('quick',i)}>Remove</Action>
            </View>
          ))}
          <Action filled onPress={()=>{setDir(ROOTS[0]);setPicker('quick');}}>+ Pin a notebook, document, or folder</Action>
        </Group>
        <Group title="Favorites · your dashboard links">
          <TextLine faint>These favorites are separate from Supernote's built-in starred Files. Add the notebooks, PDFs, or folders you want to find quickly; open them here in Settings. Changes save automatically; Done verifies the save.</TextLine>
          {prefs.favorites.length===0&&<TextLine faint>No favorites yet. Add one below to populate the Favorites screen.</TextLine>}
          {prefs.favorites.map((item,i)=>(
            <View style={styles.entry} key={item.path}>
              <View style={{flex:1}}>
                <TextLine>{item.label}</TextLine>
                <TextLine faint>{item.path}</TextLine>
              </View>
              <Action small onPress={()=>openPin(item)}>Open</Action>
              <Action small onPress={()=>movePin('favorites',i,-1)}>↑</Action>
              <Action small onPress={()=>movePin('favorites',i,1)}>↓</Action>
              <Action small onPress={()=>removePin('favorites',i)}>Remove</Action>
            </View>
          ))}
          <Action filled onPress={()=>{setDir(ROOTS[0]);setPicker('favorites');}}>+ Add a favorite notebook, document, or folder</Action>
        </Group>
        <Group title="Display">
          <TextLine faint>Google Sans Flex. Standard is the preferred Manta text size; Large and Extra large are accessibility alternatives. The first two content bands have equal height; the illustration and Quick access band is shorter.</TextLine>
          <View style={{flexDirection:'row',flexWrap:'wrap',marginVertical:6}}>
            {(['normal','large','extra'] as const).map(sz=><Action key={sz} small filled={prefs.size===sz} onPress={()=>save({...prefs,size:sz})}>{sz==='normal'?'Standard':sz==='large'?'Large':'Extra large'}</Action>)}
          </View>
        </Group>
        <Group title="Dashboard navigation">
          <TextLine faint>No floating button will appear over Supernote. The Stardust star in the lower-right section closes the dashboard, returning to the note beneath it. Calendar resets to today and opens the dashboard's read-only agenda; no native Calendar event records are created.</TextLine>
          <TextLine faint>For launching the dashboard elsewhere, add the Plugins tool to your native notebook toolbar. A direct sidebar gesture or dedicated plugin Quick Access entry is not publicly documented.</TextLine>
        </Group>
        <Group title="Attribution">
          <View style={{flexDirection:'row',alignItems:'center'}}>
            <WeatherIcon condition="sunny" dark={false} size={36}/>
            <View style={{flex:1}}>
              <TextLine>Weather Iconic — Konrad Michalik and contributors</TextLine>
              <TouchableOpacity accessibilityRole="link" onPress={()=>Linking.openURL('https://github.com/jackd248/weather-iconic/').catch(()=>setStatus('Weather Iconic: https://github.com/jackd248/weather-iconic/'))}>
                <Text style={{fontFamily:FONT,fontSize:18,color:'#111',textDecorationLine:'underline'}}>https://github.com/jackd248/weather-iconic/</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="link" onPress={()=>Linking.openURL('https://creativecommons.org/licenses/by-sa/3.0/us/').catch(()=>setStatus('License: https://creativecommons.org/licenses/by-sa/3.0/us/'))}>
                <Text style={{fontFamily:FONT,fontSize:18,color:'#111',textDecorationLine:'underline'}}>CC BY-SA 3.0 US — monochrome raster adaptations</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Group>
        <TextLine faint>MySuperPrettyDashboard · Supernote plugin. Calendar events use the separate read-only Pretty Calendar feed. Search, Calendar, and To-do remain available from Home. Your original SuperDashboard settings remain separate.</TextLine>
      </ScrollView>
      {!!status&&<View style={styles.status}><View style={{flex:1}}><TextLine>{status}</TextLine></View><Action small onPress={()=>setStatus('')}>Dismiss</Action></View>}
      </View>
    </View>
  );
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#fff',paddingHorizontal:25,paddingTop:15,paddingBottom:13},
  screen:{flex:1,backgroundColor:'#fff'},
  input:{borderWidth:1,borderColor:'#999',borderRadius:0,backgroundColor:'#fff',fontFamily:FONT,fontSize:21,color:'#111',paddingHorizontal:12,paddingVertical:11,marginVertical:7,minWidth:320},
  entry:{flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#ddd',paddingVertical:5},
  pickRow:{paddingVertical:12,paddingHorizontal:5,borderBottomWidth:1,borderColor:'#ddd'},
  status:{flexDirection:'row',alignItems:'center',borderTopWidth:1,borderColor:'#888',paddingVertical:9,justifyContent:'space-between'},
});
