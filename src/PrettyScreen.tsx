/** Shared Supernote-style secondary screen chrome. */
import React from 'react';
import {Text,TouchableOpacity,View} from 'react-native';
export const SCREEN_FONT='GoogleSansFlex';
export const SCREEN_BODY=21;
type HeaderAction={label:string;onPress:()=>void;disabled?:boolean;accessibilityLabel?:string};
export function PrettyScreenHeader({title,left,right}:{title:string;left?:HeaderAction;right?:HeaderAction}):React.JSX.Element{
  const action=(a:HeaderAction|undefined,side:'left'|'right')=>
    <View style={{width:'24%',justifyContent:'center',alignItems:side==='left'?'flex-start':'flex-end'}}>
      {a&&<TouchableOpacity accessibilityRole="button" accessibilityLabel={a.accessibilityLabel??a.label}
        accessibilityState={{disabled:!!a.disabled}} disabled={a.disabled} onPress={a.onPress}
        style={{paddingHorizontal:18,paddingVertical:15,opacity:a.disabled ? 0.5 : 1}}>
        <Text style={{fontFamily:SCREEN_FONT,fontSize:19,fontWeight:'500',color:'#fff'}}>{a.label}</Text>
      </TouchableOpacity>}
    </View>;
  return <View style={{backgroundColor:'#000',minHeight:56,flexDirection:'row',alignItems:'center',width:'100%'}}>
    {action(left,'left')}
    <Text numberOfLines={2} style={{flex:1,textAlign:'center',fontFamily:SCREEN_FONT,fontSize:22,
      fontWeight:'600',color:'#fff',paddingVertical:10}}>{title}</Text>
    {action(right,'right')}
  </View>;
}
