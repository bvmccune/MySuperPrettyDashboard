/**
 * Pretty Dashboard-specific preferences.
 * Distinct from inherited SuperDashboard zones, so the original configuration
 * remains migratable without exposing its unrelated widget-grid controls.
 */
import {NativeModules} from 'react-native';
import {ShortcutItem, DashboardConfig} from './config';

const {DashboardNative} = NativeModules;
const PREFS = '/storage/emulated/0/MyStyle/Plugins/MySuperPrettyDashboard/pretty-prefs.json';

export type PrettyAction = 'calendar' | 'files' | 'favorites' | 'search' | 'keywords'
  | 'todo' | 'new-note' | 'quick-access' | 'refresh' | 'settings';
export type BubbleSpot = 'top-left' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-right';
export type PrettySize = 'normal' | 'large' | 'extra';

export const QUICK_ICONS=['files','stars','keywords','recent','refresh','calendar-dot','auto-refresh','calendar','new-note','notebook','open-notebook'] as const;
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
  shortcuts: PrettyAction[];
  size: PrettySize;
}
export const ACTIONS: {key: PrettyAction; name: string; icon: string}[] = [
  {key:'calendar', name:'Calendar', icon:'calendar'},
  {key:'files', name:'Notes folder', icon:'files'},
  {key:'favorites', name:'Favorites', icon:'favorites'},
  {key:'search', name:'Search', icon:'search'},
  {key:'keywords', name:'Keywords', icon:'keywords'},
  {key:'todo', name:'To-do', icon:'todo'},
  {key:'new-note', name:'New note', icon:'new-note'},
  {key:'quick-access', name:'Quick access', icon:'quick'},
  {key:'refresh',name:'Refresh dashboard',icon:'refresh'},
  {key:'settings',name:'Settings',icon:'settings'},
];
export const DEFAULT_PRETTY: PrettyPrefs = {
  quick: [],
  favorites: [],
  shortcuts: ['refresh','settings','calendar','search'],
  size: 'normal',
};

function validPin(raw: any): raw is ShortcutItem {
  return raw && typeof raw.path === 'string' && (raw.path.startsWith('/storage/') || raw.path==='app:calendar' || raw.path==='app:stars') &&
    typeof raw.label === 'string' && ['folder','note-last','note-page'].includes(raw.kind);
}
export function normalPretty(raw: any): PrettyPrefs {
  const allowed = new Set(ACTIONS.map(a => a.key));
  // The previous six-button layout migrates once to the mockup's four actions.
  // Preserve four-button choices thereafter; keep Settings reachable.
  const shortcuts: PrettyAction[] = Array.isArray(raw?.shortcuts) && raw.shortcuts.length<=4
    ? raw.shortcuts.filter((a: any): a is PrettyAction => allowed.has(a)).slice(0,4)
    : DEFAULT_PRETTY.shortcuts.slice();
  for (const key of DEFAULT_PRETTY.shortcuts) {
    if (shortcuts.length >= 4) break;
    if (!shortcuts.includes(key)) shortcuts.push(key);
  }
  if (!shortcuts.includes('settings') && !shortcuts.includes('quick-access'))
    shortcuts[1]='settings';
  return {
    quick: (Array.isArray(raw?.quick) ? raw.quick.filter(validPin).map(normalizeQuick) : []).slice(0,30),
    favorites: (Array.isArray(raw?.favorites) ? raw.favorites.filter((p:any)=>validPin(p)&&p.path.startsWith('/storage/')) : []).slice(0,30),
    shortcuts,
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
