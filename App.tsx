/** MySuperPrettyDashboard: one-screen Manta home + existing configuration UI. */
import React, {useEffect, useState} from 'react';
import {DeviceEventEmitter, NativeModules} from 'react-native';
import {DashboardConfig, loadConfig} from './src/config';
import {PrettyHome} from './src/PrettyHome';
import {getRoute, Route, setRoute} from './src/route';
import {SettingsScreen} from './src/settings';
import {markOpen, ready} from './src/perf';

const {DashboardNative} = NativeModules;
function familyFor(path: string): string {
  let h = 0;
  for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) | 0;
  return 'udf' + (h >>> 0).toString(36);
}
export default function App(): React.JSX.Element {
  const [route, updateRoute] = useState<Route>(getRoute());
  const [config, updateConfig] = useState<DashboardConfig | null>(null);
  const [nonce, updateNonce] = useState(0);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('dashboard_route', (r: Route) => updateRoute(r));
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
    })().catch(() => {});
    return () => { active = false; };
  }, [route]);
  return route === 'dashboard'
    ? <PrettyHome config={config} nonce={nonce} onSettings={() => setRoute('config')}/>
    : <SettingsScreen/>;
}
