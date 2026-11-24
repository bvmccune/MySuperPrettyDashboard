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
  | 'last-note' | 'todo' | 'new-note' | 'quick-access';
export type BubbleSpot = 'top-left' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-right';
export type PrettySize = 'normal' | 'large' | 'extra';

export interface PrettyPrefs {
  quick: ShortcutItem[];
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
  {key:'last-note', name:'Last opened note', icon:'last-note'},
  {key:'todo', name:'To-do', icon:'todo'},
  {key:'new-note', name:'New note', icon:'new-note'},
  {key:'quick-access', name:'Quick access', icon:'quick'},
];
export const DEFAULT_PRETTY: PrettyPrefs = {
  quick: [],
  favorites: [],
  shortcuts: ['calendar','files','favorites','search','keywords','last-note'],
  size: 'normal',
};

function validPin(raw: any): raw is ShortcutItem {
  return raw && typeof raw.path === 'string' && raw.path.startsWith('/storage/') &&
    typeof raw.label === 'string' && ['folder','note-last','note-page'].includes(raw.kind);
}
export function normalPretty(raw: any): PrettyPrefs {
  const allowed = new Set(ACTIONS.map(a => a.key));
  const shortcuts: PrettyAction[] = Array.isArray(raw?.shortcuts)
    ? raw.shortcuts.map((x:any)=>x==='stars'?'keywords':x)
        .filter((a: any): a is PrettyAction => allowed.has(a)).slice(0,6)
    : DEFAULT_PRETTY.shortcuts.slice();
  for (const key of DEFAULT_PRETTY.shortcuts) {
    if (shortcuts.length >= 6) break;
    if (!shortcuts.includes(key)) shortcuts.push(key);
  }
  return {
    quick: (Array.isArray(raw?.quick) ? raw.quick.filter(validPin) : []).slice(0,30),
    favorites: (Array.isArray(raw?.favorites) ? raw.favorites.filter(validPin) : []).slice(0,30),
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
  return {...DEFAULT_PRETTY, quick: old.filter(validPin)};
}
export async function savePrettyPrefs(next: PrettyPrefs): Promise<boolean> {
  try {
    await DashboardNative.writeFile(PREFS, JSON.stringify(normalPretty(next), null, 2));
    return true;
  } catch { return false; }
}
