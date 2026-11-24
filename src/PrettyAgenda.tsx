/** Minimal Pretty Calendar rows.
 * EVENT TITLE                                    START–END  DURATION
 * Content uses the same body type scale as Quick Access and Recent Notes.
 */
import React from 'react';
import {Text,TouchableOpacity,View} from 'react-native';
import {AgendaEvent,eventDuration} from './prettyCalendar';
const FONT='GoogleSansFlex';
export function compactEventTime(ms:number):string{
  const d=new Date(ms),hours=d.getHours(),minutes=d.getMinutes();
  return String(hours%12||12)+(minutes?':'+String(minutes).padStart(2,'0'):'')+
    (hours<12?'a':'p');
}
export function compactEventRange(event:AgendaEvent):string{
  if(event.all_day)return 'All day';
  return compactEventTime(event.startMillis)+'–'+compactEventTime(event.endMillis)+
    ' · '+eventDuration(event);
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
      borderWidth:1.5,borderColor:'#111',position:'absolute',left:0}}/>
    <View style={{width:13*scale,height:13*scale,borderRadius:99,
      borderWidth:1.5,borderColor:'#111',position:'absolute',left:7*scale}}/>
  </View>;
}
export function AgendaRow({event,onPress,allEvents=[],scale=1}:{
  event:AgendaEvent;onPress:()=>void;allEvents?:AgendaEvent[];scale?:number;
}):React.JSX.Element{
  const overlapping=hasTimeConflict(event,allEvents);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={
    event.summary+'. '+compactEventRange(event)+(overlapping?'. Conflicts with another appointment':'')}
    onPress={onPress} style={{flexDirection:'row',alignItems:'center',
      paddingVertical:5*scale,minHeight:34*scale,borderBottomWidth:.45,
      borderBottomColor:'#d6d6d6'}}>
    {overlapping&&<Conflict scale={scale}/>}
    <Text numberOfLines={2} ellipsizeMode="tail" style={{
      fontFamily:FONT,fontSize:17.2*scale,lineHeight:21*scale,
      fontWeight:'500',color:'#111',flex:1,marginRight:8*scale,
      includeFontPadding:false}}>{event.summary}</Text>
    <Text numberOfLines={1} style={{fontFamily:FONT,fontSize:15*scale,
      fontWeight:'500',color:'#444',textAlign:'right',
      maxWidth:168*scale,includeFontPadding:false}}>
      {compactEventRange(event)}
    </Text>
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
