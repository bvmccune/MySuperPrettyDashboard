/** Reusable, read-only Pretty Calendar agenda row.
 *
 * Approved compact information hierarchy:
 *   EVENT NAME                        START–END · DURATION
 * No event descriptions, locations or attendee information.
 * Each row is a single tappable surface, with title allowed two lines.
 */
import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {AgendaEvent, eventDuration} from './prettyCalendar';

const FONT='GoogleSansFlex';
export function compactEventTime(ms:number):string{
  const d=new Date(ms),hours=d.getHours(),mins=d.getMinutes();
  return String(hours%12||12)+(mins?':'+String(mins).padStart(2,'0'):'')+(hours<12?'a':'p');
}
export function compactEventRange(e:AgendaEvent):string{
  if(e.all_day)return 'All day';
  return compactEventTime(e.startMillis)+'–'+compactEventTime(e.endMillis)+
    ' · '+eventDuration(e);
}
export function AgendaRow({event,onPress,scale=1}:{
  event:AgendaEvent;onPress:()=>void;scale?:number;
}):React.JSX.Element {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={
      event.summary+'. '+compactEventRange(event)}
      onPress={onPress} style={{flexDirection:'row',alignItems:'center',
        paddingVertical:5*scale, minHeight:30*scale,borderBottomWidth:0.5,
        borderBottomColor:'#d7d7d7'}}>
      <Text numberOfLines={2} ellipsizeMode="tail"
        style={{fontFamily:FONT,fontSize:16*scale,lineHeight:19*scale,
          color:'#111',flex:1,includeFontPadding:false,marginRight:9*scale,
          fontWeight:'500'}}>
        {event.summary}
      </Text>
      <Text numberOfLines={1} ellipsizeMode="tail"
        style={{fontFamily:FONT,fontSize:11.7*scale,color:'#454545',
          textAlign:'right',minWidth:144*scale,maxWidth:166*scale,
          includeFontPadding:false,fontWeight:'500'}}>
        {compactEventRange(event)}
      </Text>
    </TouchableOpacity>
  );
}

export function AgendaDay({day,events,onEvent,onDayPress,scale=1}:{
  day:string;events:AgendaEvent[];onEvent:(event:AgendaEvent)=>void;onDayPress?:()=>void;scale?:number;
}):React.JSX.Element {
  return <View style={{paddingBottom:14*scale}}>
    <TouchableOpacity disabled={!onDayPress} onPress={onDayPress} accessibilityRole="button"
      accessibilityLabel={'Select '+day+' in dashboard'}
      style={{flexDirection:'row',alignItems:'center',marginBottom:6*scale}}>
      <Text style={{fontFamily:FONT,fontSize:18*scale,fontWeight:'600',color:'#111'}}>
        {day}
      </Text>
      {onDayPress&&<Text style={{fontFamily:FONT,fontSize:13*scale,color:'#555',marginLeft:8*scale}}>
        Select ›
      </Text>}
    </TouchableOpacity>
    {events.length?events.map(event=><AgendaRow key={event.key}
      event={event} onPress={()=>onEvent(event)} scale={scale}/>):
      <Text style={{fontFamily:FONT,fontSize:14*scale,color:'#777'}}>
        No events
      </Text>}
  </View>;
}
