/** Shared calendar presentation for Home and the expanded agenda.
 * All times, durations, conflict flags and overflow counts use the same rules.
 */
import React,{useState} from 'react';
import {Image,Text,TouchableOpacity,View} from 'react-native';
import {AgendaEvent,compactEventRange,eventTimeRange,eventDuration} from './prettyCalendar';
import {INK,PAPER,DARK_GRAY,LIGHT_GRAY} from './prettyPalette';
export {compactEventRange,compactEventTime} from './prettyCalendar';
const FONT='GoogleSansFlex';
export function hasTimeConflict(event:AgendaEvent,others:AgendaEvent[]):boolean{
  if(event.all_day||event.endMillis<=event.startMillis)return false;
  return others.some(other=>other.key!==event.key&&!other.all_day&&
    other.endMillis>other.startMillis&&other.startMillis<event.endMillis&&other.endMillis>event.startMillis);
}
export function Conflict({scale=1}:{scale?:number}){
  return <View accessible accessibilityLabel="Conflicting appointments"
    style={{width:19*scale,height:13*scale,marginLeft:4*scale,justifyContent:'center',flexShrink:0}}>
    <View style={{width:12*scale,height:12*scale,borderRadius:99,
      backgroundColor:INK,position:'absolute',left:0}}/>
    <View style={{width:12*scale,height:12*scale,borderRadius:99,
      backgroundColor:INK,position:'absolute',left:6*scale}}/>
  </View>;
}
export function AgendaRow({event,onPress,allEvents=[],scale=1,fontBoost=1,showSelect=false}:{
  event:AgendaEvent;onPress:()=>void;allEvents?:AgendaEvent[];scale?:number;fontBoost?:number;showSelect?:boolean;
}):React.JSX.Element{
  const overlapping=hasTimeConflict(event,allEvents);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={
    event.summary+'. '+compactEventRange(event)+(overlapping?'. Conflicts with another appointment':'')+
    (showSelect?'. Select for event details':'')}
    onPress={onPress} style={{flexDirection:'row',alignItems:'center',flexShrink:0,
      paddingVertical:5*scale,paddingHorizontal:2*scale,minHeight:34*scale,borderBottomWidth:.6,
      borderBottomColor:DARK_GRAY,backgroundColor:event.all_day?LIGHT_GRAY:PAPER}}>
    <Image source={require('../assets/pretty/calendar-dot.png')} resizeMode="contain"
      style={{width:20*scale,height:20*scale,marginRight:5*scale}}/>
    <Text numberOfLines={showSelect?undefined:3} ellipsizeMode="tail" style={{
      fontFamily:FONT,fontSize:17.3*scale*fontBoost,lineHeight:21*scale*fontBoost,
      fontWeight:'500',color:INK,flex:1,minWidth:0,marginRight:6*scale,
      includeFontPadding:false}}>{event.summary}</Text>
    <View style={{alignItems:'flex-end',width:'34%',maxWidth:128*scale*fontBoost,flexShrink:0}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',flexWrap:'wrap'}}>
        <Text style={{fontFamily:FONT,fontSize:13*scale*fontBoost,lineHeight:16*scale*fontBoost,
          color:INK,textAlign:'right',maxWidth:'100%',flexShrink:1,includeFontPadding:false}}>
          {eventTimeRange(event)}
        </Text>
        {!event.all_day&&event.startMillis!==event.endMillis&&<Text style={{fontFamily:FONT,fontSize:13*scale*fontBoost,
          lineHeight:16*scale*fontBoost,color:INK,textAlign:'right',marginLeft:4*scale,includeFontPadding:false}}>
          {eventDuration(event).replace(/ /g,'\u00a0')}
        </Text>}
        {overlapping&&<Conflict scale={scale}/>}
      </View>
      {showSelect&&<Text style={{fontFamily:FONT,fontSize:12*scale*fontBoost,color:INK}}>Select ›</Text>}
    </View>
  </TouchableOpacity>;
}
/** Count the chronological prefix that actually fits, without partial rows. */
export function fitAgendaRows(heights:number[],available:number):number{
  let used=0,count=0;
  for(const height of heights){
    if(!Number.isFinite(height)||height<=0||used+height>available+0.01)break;
    used+=height;count++;
  }
  return count;
}
/** Measure the same rows at the actual column width. Invisible measurement
 * rows cannot be tapped, and the visible list never includes clipped rows.
 * Only a bounded prefix can fit, so even a huge feed is cheap to measure.
 */
export function HomeAgendaList({events,scale,fontBoost,initialHeight,header,onEvent,empty}:{
  events:AgendaEvent[];scale:number;fontBoost:number;initialHeight:number;
  header:(hidden:number)=>React.ReactNode;onEvent:(e:AgendaEvent)=>void;empty:React.ReactNode;
}):React.JSX.Element{
  const [available,setAvailable]=useState<number|null>(null);
  const [measured,setMeasured]=useState<Record<string,number>>({});
  const room=Math.max(0,available??initialHeight);
  const candidates=events.slice(0,Math.floor(room/(34*scale))+1);
  const maxRow=(Math.max(3*21,4*16)*fontBoost+12)*scale;
  const count=fitAgendaRows(candidates.map(e=>measured[e.key]??maxRow),room);
  return <View style={{flex:1,minHeight:0}}>
    {header(events.length-count)}
    <View testID="home-agenda-body" style={{flex:1,minHeight:0,overflow:'hidden'}}
      onLayout={e=>setAvailable(old=>old===e.nativeEvent.layout.height?old:e.nativeEvent.layout.height)}>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants"
        style={{position:'absolute',top:0,left:0,right:0,opacity:0}}>
        {candidates.map(e=><View key={e.key} testID={'measure-event-'+e.key} collapsable={false}
          onLayout={ev=>{const height=ev.nativeEvent.layout.height;
            setMeasured(old=>old[e.key]===height?old:{...old,[e.key]:height});
          }}>
          <AgendaRow event={e} allEvents={events} scale={scale} fontBoost={fontBoost} onPress={()=>{}}/>
        </View>)}
      </View>
      {events.length?candidates.slice(0,count).map(e=><AgendaRow key={e.key} event={e} allEvents={events}
        scale={scale} fontBoost={fontBoost} onPress={()=>onEvent(e)}/>):empty}
    </View>
  </View>;
}
export function AgendaDay({day,events,onEvent,scale=1}:{day:string;events:AgendaEvent[];
  onEvent:(event:AgendaEvent)=>void;scale?:number}):React.JSX.Element{
  return <View style={{paddingBottom:12*scale}}>
    <Text style={{fontFamily:FONT,fontSize:20*scale,fontWeight:'600',color:INK,marginBottom:5*scale}}>{day}</Text>
    {events.map(e=><AgendaRow key={e.key} event={e} allEvents={events} onPress={()=>onEvent(e)} scale={scale}/>)}
    {!events.length&&<Text style={{fontFamily:FONT,fontSize:16*scale,color:INK}}>No events in current feed</Text>}
  </View>;
}
