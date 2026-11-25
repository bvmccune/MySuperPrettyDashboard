/** Approved 40 / 20 / 40 arrangement in the former ShortCats section. */
import React,{useEffect,useState} from 'react';
import {Image,NativeModules,Text,TouchableOpacity,View} from 'react-native';
import {AgendaEvent} from './prettyCalendar';
import {availability,minuteLabel,AvailabilityBox} from './prettyAvailability';
import {WeatherResult,weatherCondition,weatherDay,weatherIsDay} from './prettyWeather';
import {WeatherIcon} from './WeatherIcon';
const {DashboardNative}=NativeModules;
export const ARTWORK_DIR='/storage/emulated/0/MyStyle/Plugins/MySuperPrettyDashboard/artwork';
const FONT='GoogleSansFlex';
export function PrettySummaryPanel({events,hasCalendar,calendarCached,weather,now,scale,onSettings,refreshTick}:{
  events:AgendaEvent[];hasCalendar:boolean;calendarCached:boolean;weather:WeatherResult;now:Date;scale:number;onSettings:()=>void;refreshTick:number;
}):React.JSX.Element{
  const [art,setArt]=useState<string[]>([]);
  const [freeArt,setFreeArt]=useState('');
  const [freeArtFailed,setFreeArtFailed]=useState(false);
  const [failedArt,setFailedArt]=useState('');
  useEffect(()=>{
    let live=true;
    Promise.resolve().then(()=>DashboardNative.listDir(ARTWORK_DIR)).then((items:any[])=>{
      if(live){
        const images=(items||[]).filter(e=>!e.isDir&&/\.(png|jpe?g|webp)$/i.test(e.name)&&typeof e.path==='string');
        const reserved=(name:string)=>/^free-state\.(png|jpe?g|webp)$/i.test(name);
        setArt(images.filter(e=>!reserved(e.name)).map(e=>e.path).sort());
        setFreeArt(images.filter(e=>reserved(e.name)).map(e=>e.path).sort()[0]||'');
        setFreeArtFailed(false);setFailedArt('');
      }
    }).catch(()=>{if(live){setArt([]);setFreeArt('');}});
    return()=>{live=false;};
  },[refreshTick]);
  const dayNumber=Math.floor(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/86400000);
  const artwork=art.length?art[((dayNumber%art.length)+art.length)%art.length]:'';
  const states=hasCalendar?availability(events,now):[{kind:'unavailable'},{kind:'unavailable'}] as [AvailabilityBox,AvailabilityBox];
  const [weatherSize,setWeatherSize]=useState({width:0,height:0});
  const snap=weather.snapshot,day=snap?weatherDay(snap,now.getTime()):null;
  const condition:{condition:string;hail?:boolean}=snap?weatherCondition(snap.code,snap.wind):{condition:'unavailable'};
  const expired=!!snap&&now.getTime()-snap.observedAt>2*3600000;
  const font=(size:number,color='#000',bold=false)=>({fontFamily:FONT,fontSize:size*scale,color,fontWeight:bold?'600' as const:'400' as const,includeFontPadding:false,textAlign:'center' as const});
  return <View style={{flex:1,flexDirection:'row',minHeight:0,paddingBottom:3*scale}}>
    <View testID="availability-column" style={{flex:2,minWidth:0,paddingHorizontal:3*scale,justifyContent:'center'}}>
      {states.map((state,i)=>state.kind==='art'?<View key={i} accessibilityLabel="No remaining meetings" style={{flex:1,alignItems:'center',justifyContent:'center'}}>{freeArt&&!freeArtFailed?<Image accessibilityLabel="Free rest of day artwork" source={{uri:'file://'+encodeURI(freeArt)}} resizeMode="contain" onError={()=>setFreeArtFailed(true)} style={{width:'100%',height:'100%'}}/>:<Text style={font(45)}>☺</Text>}</View>:
        <View key={i} style={{flex:1,minHeight:0,marginTop:3*scale,borderRadius:9*scale,borderColor:'#000',borderWidth:1,
          backgroundColor:state.kind==='busy'?'#000':'#fff',alignItems:'center',justifyContent:'center'}}>
          {state.kind==='rest'?<><Text style={font(16,'#000',true)}>FREE</Text><Text style={font(11)}>REST OF DAY</Text></>:
            state.kind==='unavailable'?<Text style={font(13)}>Unavailable</Text>:state.left?<><Text style={font(22,'#fff',true)}>{minuteLabel(state.minutes??0)}</Text><Text style={font(12,'#fff')}>LEFT</Text></>:
            <><Text style={font(12,state.kind==='busy'?'#fff':'#000',true)}>{state.kind.toUpperCase()}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={font(22,state.kind==='busy'?'#fff':'#000',true)}>{minuteLabel(state.minutes??0)}</Text></>}
        </View>)}
      {calendarCached&&<Text style={font(9)}>Cached calendar</Text>}
    </View>
    <TouchableOpacity testID="weather-column" accessibilityRole="button" accessibilityLabel="Weather settings" onPress={onSettings}
      onLayout={e=>{const {width,height}=e.nativeEvent.layout;setWeatherSize(old=>old.width===width&&old.height===height?old:{width,height});}}
      style={{flex:1,minWidth:0,alignItems:'center',justifyContent:'center',paddingHorizontal:1*scale}}>
      <View style={{flex:1,width:'100%',alignItems:'center',justifyContent:'center'}}>
        <WeatherIcon condition={expired?'unavailable':condition.condition} hail={condition.hail} isDay={snap?weatherIsDay(snap,now.getTime()):true} dark={false} size={Math.max(1,Math.min(weatherSize.width-4*scale,weatherSize.height/2-4*scale))}/>
      </View>
      <View style={{flex:1,width:'100%',alignItems:'center',justifyContent:'center'}}>
        <TemperatureGauge size={Math.max(1,Math.min(weatherSize.width-2*scale,weatherSize.height/2-2*scale))}
          current={expired?undefined:snap?.current} low={day?.low} high={day?.high}/>
        {(weather.status==='cached'||expired)&&<Text style={font(9)}>Cached</Text>}
      </View>
    </TouchableOpacity>
    <View testID="artwork-column" style={{flex:2,minWidth:0,padding:3*scale,alignItems:'center',justifyContent:'center'}}>
      {artwork&&failedArt!==artwork?<Image accessibilityLabel="Daily artwork" source={{uri:'file://'+encodeURI(artwork)}}
        onError={()=>setFailedArt(artwork)} resizeMode="contain" style={{width:'100%',height:'100%'}}/>:
        <TouchableOpacity onPress={onSettings} accessibilityLabel="Artwork settings">
          <Text style={font(12,'#555')}>Artwork</Text>
        </TouchableOpacity>}
    </View>
  </View>;
}

// Arc made of overlapping round segments; no new native SVG dependency.
export function gaugeFraction(current:number,low:number,high:number){return high>low?Math.max(0,Math.min(1,(current-low)/(high-low))):0.5;}
function TemperatureGauge({size,current,low,high}:{size:number;current?:number;low?:number;high?:number}){
 const valid=typeof current==='number'&&typeof low==='number'&&typeof high==='number';
 const point=(f:number)=>{const a=(145+250*f)*Math.PI/180;return {x:size*(.5+.39*Math.cos(a)),y:size*(.48+.39*Math.sin(a))};};
 const marker=point(valid?gaugeFraction(current!,low!,high!):0);
 const label=(n?:number)=>n===undefined?'—':String(Math.round(n));
 const dot=size*.105;
 return <View accessibilityLabel={'Current '+label(current)+', low '+label(low)+', high '+label(high)} style={{width:size,height:size,position:'relative'}}>
   {Array.from({length:65},(_,i)=>{const p=point(i/64);return <View key={i} style={{position:'absolute',left:p.x-dot/2,top:p.y-dot/2,width:dot,height:dot,borderRadius:dot/2,backgroundColor:'#999'}}/>;})}
   {valid&&<View style={{position:'absolute',left:marker.x-dot*.73,top:marker.y-dot*.73,width:dot*1.46,height:dot*1.46,borderRadius:dot,borderColor:'#fff',borderWidth:Math.max(1,size*.025),backgroundColor:'#000'}}/>}
   <Text adjustsFontSizeToFit numberOfLines={1} style={{position:'absolute',left:size*.15,top:size*.29,width:size*.7,textAlign:'center',fontFamily:FONT,fontSize:size*.34,fontWeight:'600',color:'#000',includeFontPadding:false}}>{label(current)}</Text>
   <Text style={{position:'absolute',left:size*.13,bottom:size*.045,fontFamily:FONT,fontSize:size*.17,color:'#000',includeFontPadding:false}}>{label(low)}</Text>
   <Text style={{position:'absolute',right:size*.13,bottom:size*.045,fontFamily:FONT,fontSize:size*.17,color:'#000',includeFontPadding:false}}>{label(high)}</Text>
 </View>;
}
