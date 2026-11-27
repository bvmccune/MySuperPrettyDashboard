/**
 * Tiny router shared between index.js (entry points) and App.tsx (rendering).
 *   - 'config'    → opened from Home Settings
 *   - 'dashboard' → opened by the SmartyNote toolbar button
 */
import {DeviceEventEmitter} from 'react-native';

export type Route = 'config' | 'dashboard';

let current: Route = 'dashboard';

export function setRoute(r: Route) {
  current = r;
  DeviceEventEmitter.emit('dashboard_route', r);
}

export function getRoute(): Route {
  return current;
}
