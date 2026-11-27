import React,{useState} from 'react';
import {ScrollView,Text,TouchableOpacity,View} from 'react-native';
import {PrettyScreenHeader,SCREEN_FONT,SCREEN_BODY} from './PrettyScreen';
import {dateKey,addCalendarDays} from './prettyCalendar';
import {INK,PAPER,DARK_GRAY} from './prettyPalette';

export function monthCells(year:number,month:number):string[]{
  const first=dateKey(new Date(year,month,1));
  const offset=(new Date(year,month,1).getDay()+6)%7;
  return Array.from({length:42},(_,i)=>addCalendarDays(first,i-offset));
}
export function PrettyTaskDatePicker({value,onCancel,onSave,today=dateKey(new Date())}:{
  value:string;onCancel:()=>void;onSave:(value:string)=>void;today?:string;
}){
  const initial=/^\d{4}-\d{2}-\d{2}$/.test(value)?value:today;
  const [selection,setSelection]=useState(value);
  const [month,setMonth]=useState(()=>new Date(initial+'T12:00:00'));
  const year=month.getFullYear(),m=month.getMonth(),cells=monthCells(year,m);
  const move=(step:number)=>setMonth(new Date(year,m+step,1));
  const txt={fontFamily:SCREEN_FONT,fontSize:SCREEN_BODY,color:INK};
  const action=(label:string,fn:()=>void)=><TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={fn} style={{padding:14}}><Text style={txt}>{label}</Text></TouchableOpacity>;
  return <View style={{flex:1,backgroundColor:PAPER}}>
    <PrettyScreenHeader title="Due date" left={{label:'Cancel',onPress:onCancel}} right={{label:'Save',onPress:()=>onSave(selection)}}/>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:DARK_GRAY}}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous month" onPress={()=>move(-1)} style={{padding:16}}><Text style={txt}>‹</Text></TouchableOpacity>
        <Text style={{...txt,fontWeight:'600'}}>{month.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next month" onPress={()=>move(1)} style={{padding:16}}><Text style={txt}>›</Text></TouchableOpacity>
      </View>
      <View style={{flexDirection:'row'}}>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><View key={d} style={{flex:1,alignItems:'center',paddingVertical:12}}><Text style={{...txt,fontSize:16}}>{d}</Text></View>)}</View>
      {Array.from({length:6},(_,r)=><View key={r} style={{flexDirection:'row'}}>{cells.slice(r*7,r*7+7).map(key=>{
        const current=Number(key.slice(5,7))===m+1,selected=selection===key,isToday=key===today;
        return <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={key} accessibilityState={{selected,disabled:!current}} disabled={!current}
          onPress={()=>setSelection(key)} style={{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:9,opacity:current?1:.35}}>
          <View style={{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:selected?INK:PAPER,borderWidth:isToday&&!selected?1.5:0,borderColor:INK}}>
            <Text style={{...txt,color:selected?PAPER:INK,fontWeight:selected?'600':'400'}}>{Number(key.slice(8))}</Text>
          </View>
        </TouchableOpacity>;
      })}</View>)}
      <View style={{flexDirection:'row',justifyContent:'space-between',borderTopWidth:1,borderColor:DARK_GRAY,marginTop:12}}>
        {action('No due date',()=>setSelection(''))}
        {action('Today',()=>{setMonth(new Date(today+'T12:00:00'));setSelection(today);})}
      </View>
      <Text style={txt}>{selection?'Selected: '+selection:'No due date selected'}</Text>
    </ScrollView>
  </View>;
}
