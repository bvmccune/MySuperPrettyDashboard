/** Approved 40 / 20 / 40 arrangement in the former ShortCats section. */
import React,{useState} from 'react';
import {Image,Text,TouchableOpacity,View} from 'react-native';
import {AgendaEvent} from './prettyCalendar';
import {availability,minuteLabel,AvailabilityBox} from './prettyAvailability';
import {WeatherResult,weatherCondition,weatherDay,weatherIsDay} from './prettyWeather';
import {WeatherIcon} from './WeatherIcon';
import {rockyPhrase} from './prettyRocky';
const FONT='GoogleSansFlex';
export function PrettySummaryPanel({events,hasCalendar,calendarCached,weather,now,scale,onSettings}:{
  events:AgendaEvent[];hasCalendar:boolean;calendarCached:boolean;weather:WeatherResult;now:Date;scale:number;onSettings:()=>void;
}):React.JSX.Element{
  const states=hasCalendar?availability(events,now):[{kind:'unavailable'},{kind:'unavailable'}] as [AvailabilityBox,AvailabilityBox];
  const [weatherSize,setWeatherSize]=useState({width:0,height:0});
  const snap=weather.snapshot,day=snap?weatherDay(snap,now.getTime()):null;
  const condition:{condition:string;hail?:boolean}=snap?weatherCondition(snap.code,snap.wind):{condition:'unavailable'};
  const expired=!!snap&&now.getTime()-snap.observedAt>2*3600000;
  const stale=weather.status==='cached'||expired;
  const font=(size:number,color='#000',bold=false)=>({fontFamily:FONT,fontSize:size*scale,color,fontWeight:bold?'600' as const:'400' as const,includeFontPadding:false,textAlign:'center' as const});
  return <View style={{flex:1,flexDirection:'row',minHeight:0,paddingBottom:3*scale}}>
    <View testID="availability-column" style={{flex:2,minWidth:0,paddingHorizontal:3*scale,justifyContent:'center'}}>
      {states.map((state,i)=>state.kind==='art'?<RockySign key={i} scale={scale}/>:
        <View key={i} testID={'availability-'+state.kind} style={{flex:1,minHeight:0,marginTop:3*scale,borderRadius:9*scale,borderColor:'#000',borderWidth:1,
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
        {weatherSize.width>0&&weatherSize.height>0&&<WeatherIcon condition={expired?'unavailable':condition.condition} hail={condition.hail} isDay={snap?weatherIsDay(snap,now.getTime()):true} dark={false} size={Math.max(1,Math.min(weatherSize.width-4*scale,weatherSize.height/2-4*scale))}/>}
      </View>
      <View style={{flex:1,width:'100%',alignItems:'center',justifyContent:'center'}}>
        <TemperatureGauge size={Math.max(1,Math.min(weatherSize.width-2*scale,weatherSize.height/2-2*scale-(stale?12*scale:0)))}
          current={expired?undefined:snap?.current} low={expired?undefined:day?.low} high={expired?undefined:day?.high}/>
        {stale&&<Text style={font(9)}>Cached</Text>}
      </View>
    </TouchableOpacity>
    <View testID="artwork-column" style={{flex:2,minWidth:0,padding:3*scale,alignItems:'center',justifyContent:'center'}}>
      <Image accessibilityLabel="I am good kitty — possum artwork by Lindsay Scanlan" source={require('../assets/artwork/possum.jpg')} resizeMode="contain" style={{width:'100%',height:'100%'}}/>
    </View>
  </View>;
}

/** Original image sign occupies x=33..208 and y=7..89 of the square.
 * Keep text inside its clear interior; Rocky uses two of the three height units.
 * A random phrase is chosen when this state becomes visible, not on a timer. */
export function RockySign({scale}:{scale:number}){
  const [bounds,setBounds]=useState({width:0,height:0});
  const [phrase]=useState(()=>rockyPhrase());
  const width=Math.max(0,Math.min(bounds.width-4*scale,(bounds.height-2*scale)*1.18));
  const height=width/1.18;
  return <View testID="rocky-free-art" onLayout={e=>{const {width,height}=e.nativeEvent.layout;setBounds(old=>old.width===width&&old.height===height?old:{width,height});}} style={{flex:2,minHeight:0,alignItems:'center',justifyContent:'center'}}>
    {width>0&&<View testID="rocky-sign" style={{width,height,position:'relative'}}>
      <Image accessibilityLabel="Rocky holding a blank sign" source={require('../assets/pretty/rocky-sign.png')} resizeMode="stretch" style={{width:'100%',height:'100%'}}/>
      <View pointerEvents="none" style={{position:'absolute',left:'17%',top:'5%',width:'66%',height:'28%',alignItems:'center',justifyContent:'center'}}>
        <Text testID="rocky-phrase" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5} style={{fontFamily:FONT,fontWeight:'600',fontSize:Math.min(width*.105,height*.14),textAlign:'center',color:'#000',includeFontPadding:false}}>{phrase}</Text>
      </View>
    </View>}
  </View>;
}

/** Analytic circular geometry shared with assets/artwork/temperature-gauge.svg.
 * A single continuous arc is rasterized at build time; no tracing, overlapping
 * dots, native SVG dependency, or runtime image tint. Values remain live. */
export function gaugeFraction(current:number,low:number,high:number){
 return high>low?Math.max(0,Math.min(1,(current-low)/(high-low))):0.5;
}
export function gaugePoint(fraction:number){
 const angle=(145+250*Math.max(0,Math.min(1,fraction)))*Math.PI/180;
 return {x:.5+.40*Math.cos(angle),y:.50+.40*Math.sin(angle)};
}
export function TemperatureGauge({size,current,low,high}:{size:number;current?:number;low?:number;high?:number}){
 const valid=Number.isFinite(current)&&Number.isFinite(low)&&Number.isFinite(high);
 const marker=gaugePoint(valid?gaugeFraction(current!,low!,high!):0);
 const label=(n?:number)=>Number.isFinite(n)?String(Math.round(n!)):'—';
 const dot=size*.115;
 const baseText={fontFamily:FONT,color:'#000000',textAlign:'center' as const,includeFontPadding:false};
 if(size<=1)return <View/>;
 return <View testID="temperature-gauge" accessible accessibilityLabel={'Current '+label(current)+', low '+label(low)+', high '+label(high)} style={{width:size,height:size,position:'relative'}}>
   <Image source={require('../assets/pretty/temperature-gauge.png')} resizeMode="contain" style={{width:size,height:size}}/>
   {valid&&<View testID="temperature-marker" style={{position:'absolute',left:marker.x*size-dot/2,top:marker.y*size-dot/2,width:dot,height:dot,borderRadius:dot/2,borderColor:'#FFFFFF',borderWidth:size*.018,backgroundColor:'#000000'}}/>}
   <View style={{position:'absolute',left:size*.20,top:size*.28,width:size*.60,height:size*.39,alignItems:'center',justifyContent:'center'}}>
     <Text adjustsFontSizeToFit numberOfLines={1} style={{...baseText,fontSize:size*.40,fontWeight:'600'}}>{label(current)}</Text>
   </View>
   <Text numberOfLines={1} adjustsFontSizeToFit style={{...baseText,position:'absolute',left:size*.13,top:size*.76,width:size*.28,fontSize:size*.21,fontWeight:'600'}}>{label(low)}</Text>
   <Text numberOfLines={1} adjustsFontSizeToFit style={{...baseText,position:'absolute',right:size*.13,top:size*.76,width:size*.28,fontSize:size*.21,fontWeight:'600'}}>{label(high)}</Text>
 </View>;
}
