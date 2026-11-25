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
        <TemperatureGauge size={Math.max(1,Math.min(weatherSize.width-2*scale,weatherSize.height/2-2*scale))}
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
