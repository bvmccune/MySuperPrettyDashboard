/** MySuperPrettyDashboard: one-screen Manta home + existing configuration UI. */
import React, {useEffect, useState} from 'react';
import {DeviceEventEmitter, NativeModules, Text, TouchableOpacity, View} from 'react-native';
import {DashboardConfig, loadConfig} from './src/config';
import {PrettyHome} from './src/PrettyHome';
import {getRoute, Route, setRoute} from './src/route';
import {PrettySettings} from './src/PrettySettings';
import {PrettyScreenHeader} from './src/PrettyScreen';
import {markOpen, ready} from './src/perf';

const {DashboardNative} = NativeModules;
function familyFor(path: string): string {
  let h = 0;
  for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) | 0;
  return 'udf' + (h >>> 0).toString(36);
}
function DashboardError({message}:{message:string}):React.JSX.Element {
  return <View style={{flex:1,backgroundColor:'#fff'}}>
    <PrettyScreenHeader title="Dashboard error" left={{label:'Settings',onPress:()=>setRoute('config')}}/>
    <View style={{flex:1,padding:25,justifyContent:'center'}}>
    <Text style={{fontFamily:'GoogleSansFlex',fontSize:25,fontWeight:'600',color:'#111'}}>Dashboard could not load</Text>
    <Text style={{fontFamily:'GoogleSansFlex',fontSize:18,color:'#333',marginVertical:12}}>{message}</Text>
    <TouchableOpacity onPress={()=>setRoute('config')} accessibilityRole="button"
      style={{alignSelf:'flex-start',backgroundColor:'#111',padding:12,borderRadius:6}}>
      <Text style={{fontFamily:'GoogleSansFlex',fontSize:18,color:'#fff'}}>Return to Settings</Text>
    </TouchableOpacity>
    </View>
  </View>;
}
class DashboardBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    return this.state.failed
      ? <DashboardError message="An error occurred while rendering or initializing Home. Return to Settings and try again."/>
      : this.props.children;
  }
}
export default function App(): React.JSX.Element {
  const [route, updateRoute] = useState<Route>(getRoute());
  const [config, updateConfig] = useState<DashboardConfig | null>(null);
  const [nonce, updateNonce] = useState(0);
  const [entry, updateEntry] = useState(0);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('dashboard_route', (r: Route) => {
      setLoadError(false);
      updateRoute(r);
      // The dashboard often stays mounted while another native app is open.
      // A repeated 'dashboard' event must reload its data, even when the
      // route value did not change.
      if (r === 'dashboard') updateEntry(v => v + 1);
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (route !== 'dashboard') return;
    let active = true;
    markOpen('dashboard');
    (async () => {
      const cfg = await loadConfig();
      // Preserve support for an individually configured MyStyle font in all
      // legacy tools; the new home always uses the bundled Google Sans Flex.
      if (cfg.font) {
        try { await DashboardNative?.registerFont?.(cfg.font, familyFor(cfg.font)); } catch { /* optional */ }
      }
      if (active) {
        updateConfig(cfg);
        updateNonce(v => v + 1);
        requestAnimationFrame(() => ready('pretty home'));
      }
    })().catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [route, entry]);
  return route === 'dashboard'
    ? <DashboardBoundary>{loadError
        ? <DashboardError message="Dashboard configuration could not be loaded. Return to Settings and try again."/>
        : <PrettyHome config={config} nonce={nonce} onSettings={() => setRoute('config')}/>}
      </DashboardBoundary>
    : <PrettySettings/>;
}
