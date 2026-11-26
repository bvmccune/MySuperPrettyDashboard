import React,{useState} from 'react';
import {View} from 'react-native';
import {fitAgendaRows} from './PrettyAgenda';

/** Fit a prefix of whole rows using the real width and rendered heights.
 * A bounded invisible copy measures the same row layout; no partially visible
 * row is admitted. The visible list remains non-scrolling.
 */
export function PrettyFitList<T>({items,keyOf,renderRow,minHeight,maxHeight,initialHeight,empty,header,maxRows}:{
  items:T[];keyOf:(item:T,index:number)=>string;renderRow:(item:T,index:number)=>React.ReactNode;
  minHeight:number;maxHeight:number;initialHeight:number;empty:React.ReactNode;header?:(hidden:number)=>React.ReactNode;maxRows?:number;
}):React.JSX.Element{
  const [available,setAvailable]=useState<number|null>(null);
  const [measured,setMeasured]=useState<Record<string,number>>({});
  const room=Math.max(0,available??initialHeight);
  const candidates=items.slice(0,Math.min(maxRows??Infinity,Math.floor(room/Math.max(1,minHeight))+1));
  const count=fitAgendaRows(candidates.map((item,i)=>measured[keyOf(item,i)]??maxHeight),room);
  return <View style={{flex:1,minHeight:0}}>{header?.(items.length-count)}<View style={{flex:1,minHeight:0,overflow:'hidden'}}
    onLayout={e=>setAvailable(old=>old===e.nativeEvent.layout.height?old:e.nativeEvent.layout.height)}>
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants"
      style={{position:'absolute',top:0,left:0,right:0,opacity:0}}>
      {candidates.map((item,i)=>{const key=keyOf(item,i);return <View key={key} collapsable={false}
        testID={'fit-measure-'+key} onLayout={e=>{
          const height=e.nativeEvent.layout.height;
          setMeasured(old=>old[key]===height?old:{...old,[key]:height});
        }}>{renderRow(item,i)}</View>;})}
    </View>
    {items.length?candidates.slice(0,count).map((item,i)=><View key={keyOf(item,i)} style={{flexShrink:0}}>
      {renderRow(item,i)}</View>):empty}
  </View></View>;
}
