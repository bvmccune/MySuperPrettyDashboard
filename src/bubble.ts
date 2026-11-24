/**
 * The user chose not to have any persistent floating launcher.
 * Closing the dashboard always returns to the underlying Supernote note.
 * This is independent of inherited SuperDashboard overlay settings.
 */
import {AppState, NativeModules} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';
const {DashboardNative} = NativeModules;
let viewGen=0;
AppState.addEventListener('change',state=>{if(state==='active')viewGen++;});
export async function showBubbleFromConfig():Promise<boolean>{
  try {await DashboardNative.hideBubble();return true;}catch{return false;}
}
export async function leavePlugin():Promise<void>{
  const generation=viewGen;
  await showBubbleFromConfig();
  if(AppState.currentState!=='active')return;
  setTimeout(()=>{
    if(generation===viewGen&&AppState.currentState==='active')
      PluginManager.closePluginView();
  },150);
}
