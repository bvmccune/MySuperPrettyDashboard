import React from 'react';
import {View} from 'react-native';
import {INK,DARK_GRAY} from './prettyPalette';
import {DESIGN} from './prettyDesign';
/** Native-style fine dotted row rule. Use a full border to avoid Android's
 * unsupported dotted single-edge borders; the very shallow box is the rule. */
export function DottedRule({scale=1}:{scale?:number}){
  return <View pointerEvents="none" testID="light-dotted-divider" style={{
    position:'absolute',top:0,left:0,right:0,height:DESIGN.lightDivider*scale,
    borderWidth:DESIGN.lightDivider*scale/2,borderColor:DARK_GRAY,borderStyle:'dotted',
  }}/>;
}
export function HeavyRule({scale=1}:{scale?:number}){
  return <View testID="heavy-divider" style={{height:DESIGN.heavyDivider*scale,backgroundColor:INK}}/>;
}
