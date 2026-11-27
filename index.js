/** SmartyNote — single supported plugin toolbar entry. */
import {AppRegistry, AppState, Image, NativeModules} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {PluginManager,PluginCommAPI,PluginNoteAPI,PluginDocAPI,PluginFileAPI} from 'sn-plugin-lib';
import {instrumentBridge,markOpen} from './src/perf';
import {setRoute} from './src/route';
import {ensureFilePermissions} from './src/permissions';

const {DashboardNative}=NativeModules;
instrumentBridge({PluginFileAPI,PluginCommAPI,PluginNoteAPI,PluginDocAPI});
AppRegistry.registerComponent(appName,()=>App);
PluginManager.init();

// Clear only this plugin's obsolete overlay, including one left by an upgrade.
// Do not restore the retired floating launcher or register capture buttons.
const clearOverlay=()=>DashboardNative?.clearAllBubbles?.().catch(()=>{});
clearOverlay();
ensureFilePermissions().catch(()=>{});
AppState.addEventListener('change',state=>{if(state==='active')DashboardNative?.hideBubble?.().catch(()=>{});});
PluginManager.registerPluginLifeListener({onMsg(msg){if(msg?.state===5)clearOverlay();}});
const TOOLBAR_BTN=100;
PluginManager.registerButton(1,['NOTE','DOC'],{
  id:TOOLBAR_BTN,
  name:'SmartyNote',
  icon:Image.resolveAssetSource(require('./assets/icon.png')).uri,
  showType:1,
});
PluginManager.registerButtonListener({onButtonPress(e){
  if(e&&e.id!==TOOLBAR_BTN)return;
  markOpen('SmartyNote toolbar');
  setRoute('dashboard');
}});
// A first launch goes straight to Home; its Settings button handles connection.
