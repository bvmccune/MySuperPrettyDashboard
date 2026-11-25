/** Approved 40 / 20 / 40 arrangement in the former ShortCats section. */
import React,{useEffect,useState} from 'react';
import {Image,NativeModules,Text,TouchableOpacity,View} from 'react-native';
import {AgendaEvent} from './prettyCalendar';
import {availability,minuteLabel,WorkHours} from './prettyAvailability';
import {WeatherResult,weatherCondition,weatherDay,weatherIsDay} from './prettyWeather';
import {WeatherIcon} from './WeatherIcon';
const {DashboardNative}=NativeModules;
export const ARTWORK_DIR='/storage/emulated/0/MyStyle/Plugins/MySuperPrettyDashboard/artwork';
const FONT='GoogleSansFlex';
export function PrettySummaryPanel({events,selectedDay,hasCalendar,hours,weather,now,scale,onSettings,refreshTick}:{
  events:AgendaEvent[];selectedDay:string;hasCalendar:boolean;hours:WorkHours;weather:WeatherResult;now:Date;scale:number;onSettings:()=>void;refreshTick:number;
}):React.JSX.Element{
  const [art,setArt]=useState<string[]>([]);
  const [failedArt,setFailedArt]=useState('');
  useEffect(()=>{
    let live=true;
    Promise.resolve().then(()=>DashboardNative.listDir(ARTWORK_DIR)).then((items:any[])=>{
      if(live){setArt((items||[]).filter(e=>!e.isDir&&/\.(png|jpe?g|webp)$/i.test(e.name)&&typeof e.path==='string').map(e=>e.path).sort());setFailedArt('');}
    }).catch(()=>{if(live)setArt([]);});
    return()=>{live=false;};
  },[refreshTick]);
  const dayNumber=Math.floor(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/86400000);
  const artwork=art.length?art[((dayNumber%art.length)+art.length)%art.length]:'';
  const totals=availability(selectedDay,events,hours,now);
  const snap=weather.snapshot,day=snap?weatherDay(snap,now.getTime()):null;
  const condition:{condition:string;hail?:boolean}=snap?weatherCondition(snap.code,snap.wind):{condition:'unavailable'};
  const expired=!!snap&&now.getTime()-snap.observedAt>2*3600000;
  const temp=(n:number|undefined)=>typeof n==='number'?Math.round(n)+'°':'—';
  const font=(size:number,color='#000',bold=false)=>({fontFamily:FONT,fontSize:size*scale,color,fontWeight:bold?'600' as const:'400' as const,includeFontPadding:false,textAlign:'center' as const});
  return <View style={{flex:1,flexDirection:'row',minHeight:0,paddingBottom:3*scale}}>
    <View testID="availability-column" style={{flex:2,minWidth:0,paddingHorizontal:3*scale,justifyContent:'center'}}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={font(10)}>{totals.remaining?'Remaining today':'Selected day'}</Text>
      {(['free','busy'] as const).map((kind,i)=><View key={kind} style={{flex:1,minHeight:0,marginTop:3*scale,borderColor:'#000',borderWidth:1,
        backgroundColor:i?'#000':'#fff',alignItems:'center',justifyContent:'center'}}>
        <Text style={font(12,i?'#fff':'#000',true)}>{kind==='free'?'FREE':'BUSY'}</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={font(19,i?'#fff':'#000',true)}>{hasCalendar?minuteLabel(totals[kind]):'—'}</Text>
      </View>)}
    </View>
    <TouchableOpacity testID="weather-column" accessibilityRole="button" accessibilityLabel="Weather settings" onPress={onSettings}
      style={{flex:1,minWidth:0,alignItems:'center',justifyContent:'center',paddingHorizontal:1*scale}}>
      <WeatherIcon condition={expired?'unavailable':condition.condition} hail={condition.hail} isDay={snap?weatherIsDay(snap,now.getTime()):true} dark={false} size={44*scale}/>
      <Text adjustsFontSizeToFit numberOfLines={1} style={font(24,'#000',true)}>{expired?'—':temp(snap?.current)}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={font(11)}>H {temp(day?.high)}  L {temp(day?.low)}</Text>
      {(weather.status==='cached'||expired)&&<Text style={font(9)}>Cached</Text>}
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
