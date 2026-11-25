/** Minimal Pretty Calendar rows.
 * EVENT TITLE                                    START–END  DURATION
 * Content uses the same body type scale as Quick Access and Recent Notes.
 */
import React from 'react';
import {Image,Text,TouchableOpacity,View} from 'react-native';
import {AgendaEvent,eventDuration} from './prettyCalendar';
const FONT='GoogleSansFlex';
export function compactEventTime(ms:number,showPeriod=true):string{
  const d=new Date(ms),hours=d.getHours(),minutes=d.getMinutes();
  return String(hours%12||12)+(minutes?':'+String(minutes).padStart(2,'0'):'')+
    (showPeriod?(hours<12?' am':' pm'):'');
}
export function compactEventRange(event:AgendaEvent):string{
  if(event.all_day)return 'All day';
  const samePeriod=(new Date(event.startMillis).getHours()<12)===(new Date(event.endMillis).getHours()<12);
  return compactEventTime(event.startMillis,!samePeriod)+'–'+compactEventTime(event.endMillis)+
    ' '+eventDuration(event);
}
export function hasTimeConflict(event:AgendaEvent,others:AgendaEvent[]):boolean{
  if(event.all_day)return false;
  return others.some(other=>other!==event&&!other.all_day&&
    other.startMillis<event.endMillis&&other.endMillis>event.startMillis);
}
function Conflict({scale}:{scale:number}){
  return <View accessible accessibilityLabel="Conflicting appointments"
    style={{width:21*scale,height:15*scale,marginRight:4*scale}}>
    <View style={{width:13*scale,height:13*scale,borderRadius:99,
      backgroundColor:'#111',position:'absolute',left:0}}/>
    <View style={{width:13*scale,height:13*scale,borderRadius:99,
      backgroundColor:'#111',position:'absolute',left:7*scale}}/>
  </View>;
}
export function AgendaRow({event,onPress,allEvents=[],scale=1,showSelect=false}:{
  event:AgendaEvent;onPress:()=>void;allEvents?:AgendaEvent[];scale?:number;showSelect?:boolean;
}):React.JSX.Element{
  const overlapping=hasTimeConflict(event,allEvents);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={
    event.summary+'. '+compactEventRange(event)+(overlapping?'. Conflicts with another appointment':'')}
    onPress={onPress} style={{flexDirection:'row',alignItems:'center',
      paddingVertical:5*scale,minHeight:34*scale,borderBottomWidth:.45,
      borderBottomColor:'#d6d6d6'}}>
    <Image source={require('../assets/pretty/calendar-dot.png')} resizeMode="contain"
      style={{width:20*scale,height:20*scale,marginRight:5*scale}}/>
    <Text numberOfLines={3} ellipsizeMode="tail" style={{
      fontFamily:FONT,fontSize:17.2*scale,lineHeight:21*scale,
      fontWeight:'500',color:'#111',flex:1,marginRight:8*scale,
      includeFontPadding:false}}>{event.summary}</Text>
    <View style={{alignItems:'flex-end',maxWidth:130*scale}}>
      <View style={{flexDirection:'row',alignItems:'center'}}>
        {overlapping&&<Conflict scale={scale}/>}
        <Text style={{fontFamily:FONT,fontSize:12.5*scale,
          fontWeight:'400',color:'#444',textAlign:'right',includeFontPadding:false}}>
          {compactEventRange(event)}
        </Text>
      </View>
      {showSelect&&<Text style={{fontFamily:FONT,fontSize:12*scale,color:'#555'}}>Select ›</Text>}
    </View>
  </TouchableOpacity>;
}
export function AgendaDay({day,events,onEvent,scale=1}:{
  day:string;events:AgendaEvent[];onEvent:(event:AgendaEvent)=>void;scale?:number;
}):React.JSX.Element{
  return <View style={{paddingBottom:12*scale}}>
    <Text style={{fontFamily:FONT,fontSize:20*scale,fontWeight:'600',
      color:'#111',marginBottom:5*scale}}>{day}</Text>
    {events.filter(e=>e.all_day).map(e=><AgendaRow key={e.key}
      event={e} allEvents={events} onPress={()=>onEvent(e)} scale={scale}/>)}
    {events.filter(e=>!e.all_day).map(e=><AgendaRow key={e.key}
      event={e} allEvents={events} onPress={()=>onEvent(e)} scale={scale}/>)}
    {!events.length&&<Text style={{fontFamily:FONT,fontSize:16*scale,
      color:'#777'}}>No events</Text>}
  </View>;
}
