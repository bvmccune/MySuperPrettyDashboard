/**
 * Pretty Dashboard-specific preferences.
 * Distinct from inherited SuperDashboard zones, so the original configuration
 * remains migratable without exposing its unrelated widget-grid controls.
 */
import {NativeModules} from 'react-native';
import {ShortcutItem, DashboardConfig} from './config';

const {DashboardNative} = NativeModules;
const PREFS = '/storage/emulated/0/MyStyle/Plugins/MySuperPrettyDashboard/pretty-prefs.json';

export type PrettySize = 'normal' | 'large' | 'extra';

export const QUICK_ICONS=['files','stars','stars-filled','keywords','recent','refresh','calendar-dot','auto-refresh','calendar','new-note','notebook','open-notebook'] as const;
export type QuickIcon=typeof QUICK_ICONS[number];
export type QuickPin=ShortcutItem & {icon?:QuickIcon};
export function quickIcon(item:QuickPin):QuickIcon{
  return QUICK_ICONS.includes(item.icon as QuickIcon)?item.icon!:
    item.path==='app:calendar'?'calendar':item.path==='app:stars'?'stars':item.kind==='folder'?'files':'notebook';
}
function normalizeQuick(item:ShortcutItem):QuickPin{
  const pin=item as QuickPin;
  return {...pin,icon:quickIcon(pin)};
}
export interface PrettyPrefs {
  quick: QuickPin[];
  favorites: ShortcutItem[];
  size: PrettySize;
}
export const DEFAULT_PRETTY: PrettyPrefs = {
  quick: [],
  favorites: [],
  size: 'normal',
};

function validPin(raw: any): raw is ShortcutItem {
  return raw && typeof raw.path === 'string' && (raw.path.startsWith('/storage/') || raw.path==='app:calendar' || raw.path==='app:stars') &&
    typeof raw.label === 'string' && ['folder','note-last','note-page'].includes(raw.kind);
}
export function normalPretty(raw: any): PrettyPrefs {
  return {
    quick: (Array.isArray(raw?.quick) ? raw.quick.filter(validPin).map(normalizeQuick) : []).slice(0,30),
    favorites: (Array.isArray(raw?.favorites) ? raw.favorites.filter((p:any)=>validPin(p)&&p.path.startsWith('/storage/')) : []).slice(0,30),
    size: ['normal','large','extra'].includes(raw?.size) ? raw.size : 'normal',
  };
}
export async function loadPrettyPrefs(legacy?: DashboardConfig | null): Promise<PrettyPrefs> {
  try {
    const raw: string = await DashboardNative.readTextFile(PREFS);
    if (raw && raw.trim()) return normalPretty(JSON.parse(raw));
  } catch { /* first run / absent file */ }
  const old = legacy?.zones.filter(z => z.type === 'shortcuts')
    .flatMap(z => z.type === 'shortcuts' ? z.items : []) ?? [];
  return {...DEFAULT_PRETTY, quick: old.filter(validPin).map(normalizeQuick)};
}
export async function savePrettyPrefs(next: PrettyPrefs): Promise<boolean> {
  try {
    await DashboardNative.writeFile(PREFS, JSON.stringify(normalPretty(next), null, 2));
    return true;
  } catch { return false; }
}
