/** Shared calendar presentation for Home and the expanded agenda.
 * All times, durations, conflict flags and overflow counts use the same rules.
 */
import React,{useState} from 'react';
import {Image,Text,TouchableOpacity,View} from 'react-native';
import {AgendaEvent,compactEventRange,eventTimeRange,eventDuration,addCalendarDays} from './prettyCalendar';
import {INK,PAPER,DARK_GRAY,LIGHT_GRAY} from './prettyPalette';
export {compactEventRange,compactEventTime} from './prettyCalendar';
const FONT='GoogleSansFlex';
export function hasTimeConflict(event:AgendaEvent,others:AgendaEvent[]):boolean{
  if(event.all_day||event.endMillis<=event.startMillis)return false;
  return others.some(other=>other.key!==event.key&&!other.all_day&&
    other.endMillis>other.startMillis&&other.startMillis<event.endMillis&&other.endMillis>event.startMillis);
}
/** Match the original Pretty Calendar TRMNL shared.liquid:
 * 12px circles, -2px adjacent margin, 23x13px right-aligned container. */
export const CONFLICT_MARKER={diameter:12,overlap:2,width:23,height:13} as const;
export function Conflict({scale=1}:{scale?:number}){
  const {diameter,overlap,width,height}=CONFLICT_MARKER;
  return <View accessible accessibilityLabel="Conflicting appointments"
    style={{width:width*scale,height:height*scale,marginLeft:4*scale,flexDirection:'row',alignItems:'center',justifyContent:'flex-end',flexShrink:0}}>
    <View testID="conflict-dot-first" style={{width:diameter*scale,height:diameter*scale,borderRadius:999,backgroundColor:'#000',flexShrink:0}}/>
    <View testID="conflict-dot-second" style={{width:diameter*scale,height:diameter*scale,borderRadius:999,backgroundColor:'#000',marginLeft:-overlap*scale,flexShrink:0}}/>
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
      paddingVertical:5*scale,paddingHorizontal:2*scale,minHeight:34*scale,borderTopWidth:.6,
      borderTopColor:DARK_GRAY,backgroundColor:event.all_day?LIGHT_GRAY:PAPER}}>
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
export function HomeAgendaList({events,scale,fontBoost,initialHeight,header,onEvent,empty,day}:{
  events:AgendaEvent[];scale:number;fontBoost:number;initialHeight:number;
  day?:string;header:(hidden:number)=>React.ReactNode;onEvent:(e:AgendaEvent)=>void;empty:React.ReactNode;
}):React.JSX.Element{
  const [available,setAvailable]=useState<number|null>(null);
  const [measured,setMeasured]=useState<Record<string,number>>({});
  const room=Math.max(0,available??initialHeight);
  const candidates=events.slice(0,Math.floor(room/(34*scale))+1);
  const maxRow=(Math.max(3*21,4*16)*fontBoost+12)*scale;
  const count=fitAgendaRows(candidates.map(e=>measured[e.key]??maxRow),room);
  return <View style={{flex:1,minHeight:0}}>
    {header(events.length-count)}
    <View style={{flex:1,minHeight:0,flexDirection:'row'}}>
    {!!day&&<ScheduleRail day={day} events={events} scale={scale}/>}
    <View testID="home-agenda-body" style={{flex:1,minWidth:0,minHeight:0,overflow:'hidden'}}
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
    </View></View>
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

/** Wall-clock schedule for selected local day. Clip overnight events to day bounds. */
export function scheduleBounds(day:string,events:AgendaEvent[]){
  const midnight=new Date(day+'T00:00:00').getTime();
  const next=new Date(addCalendarDays(day,1)+'T00:00:00').getTime();
  const morning=new Date(day+'T08:00:00').getTime(),evening=new Date(day+'T18:00:00').getTime();
  const intervals=events.filter(e=>!e.all_day&&e.endMillis>e.startMillis)
    .map(e=>({start:Math.max(midnight,e.startMillis),end:Math.min(next,e.endMillis)}))
    .filter(e=>e.end>e.start).sort((a,b)=>a.start-b.start);
  const start=Math.min(morning,...intervals.map(e=>e.start));
  const end=Math.max(evening,...intervals.map(e=>e.end));
  const merged:{start:number;end:number}[]=[];
  for(const x of intervals){
    const last=merged[merged.length-1];
    if(last&&x.start<=last.end)last.end=Math.max(last.end,x.end);
    else merged.push({...x});
  }
  // Sweep each distinct event boundary so conflicts retain their actual duration.
  const edges=[...new Set(intervals.flatMap(x=>[x.start,x.end]))].sort((a,b)=>a-b);
  const overlaps:{start:number;end:number}[]=[];
  const dividers:number[]=[];
  for(let i=0;i<edges.length;i++){
    const t=edges[i],nextEdge=edges[i+1];
    const before=intervals.filter(x=>x.start<t&&x.end>=t);
    const after=intervals.filter(x=>x.start<=t&&x.end>t);
    // A touching pair is not a conflict. Mark the exact shared boundary.
    if(before.length===1&&after.length===1&&before[0]!==after[0])dividers.push(t);
    if(nextEdge!==undefined&&after.length>=2){
      const last=overlaps[overlaps.length-1];
      if(last&&last.end===t)last.end=nextEdge;
      else overlaps.push({start:t,end:nextEdge});
    }
  }
  return {start,end,merged,overlaps,dividers};
}
function ScheduleRail({day,events,scale}:{day:string;events:AgendaEvent[];scale:number}){
  const {start,end,merged,overlaps,dividers}=scheduleBounds(day,events);
  const [railHeight,setRailHeight]=useState(0);
  const width=10*scale;
  const pct=(t:number)=>((t-start)/(end-start)*100)+'%' as `${number}%`;
  const label=(t:number)=>new Date(t).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}).replace(':00','').toLowerCase();
  return <View accessible accessibilityLabel={'Schedule '+label(start)+' to '+label(end)}
    style={{width:31*scale,alignItems:'center',paddingVertical:3*scale,marginRight:4*scale}}>
    <Text style={{fontFamily:FONT,fontSize:9*scale,color:INK}}>{label(start)}</Text>
    <View onLayout={e=>setRailHeight(e.nativeEvent.layout.height)}
      style={{flex:1,width,borderWidth:1,borderColor:INK,overflow:'hidden',marginVertical:3*scale,backgroundColor:PAPER}}>
      {merged.map((e,i)=><View key={'busy'+i} style={{position:'absolute',left:0,right:0,
        top:pct(e.start),height:pct(start+e.end-e.start),backgroundColor:INK}}/>)}
      {overlaps.map((e,i)=>{
        const h=railHeight*(e.end-e.start)/(end-start);
        const step=5*scale;
        return <View key={'conflict'+i} accessible accessibilityLabel="Overlapping events"
          style={{position:'absolute',left:0,right:0,top:pct(e.start),height:pct(start+e.end-e.start),overflow:'hidden',backgroundColor:INK}}>
          {Array.from({length:Math.ceil(h/step)+4},(_,j)=><View key={j} style={{position:'absolute',
            left:-width/2,top:(j-1)*step,width:width*2,height:1.4*scale,
            backgroundColor:PAPER,transform:[{rotate:'-45deg'}]}}/>)}
        </View>;
      })}
      {dividers.map(t=><View key={'boundary'+t} style={{position:'absolute',left:0,right:0,
        top:pct(t),height:1.5*scale,backgroundColor:PAPER,transform:[{translateY:-.75*scale}]}}/>)}
    </View>
    <Text style={{fontFamily:FONT,fontSize:9*scale,color:INK}}>{label(end)}</Text>
  </View>;
}
