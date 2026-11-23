/**
 * Pretty Dashboard-specific preferences.
 * Distinct from inherited SuperDashboard zones, so the original configuration
 * remains migratable without exposing its unrelated widget-grid controls.
 */
import {NativeModules} from 'react-native';
import {ShortcutItem, DashboardConfig} from './config';

const {DashboardNative} = NativeModules;
const PREFS = '/storage/emulated/0/MyStyle/Plugins/MySuperPrettyDashboard/pretty-prefs.json';

export type PrettyAction = 'calendar' | 'files' | 'favorites' | 'search' | 'stars'
  | 'last-note' | 'todo' | 'new-note' | 'quick-access';
export type BubbleSpot = 'top-left' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-right';
export type PrettySize = 'normal' | 'large' | 'extra';

export interface PrettyPrefs {
  quick: ShortcutItem[];
  favorites: ShortcutItem[];
  shortcuts: PrettyAction[];
  size: PrettySize;
  bubbleSpot: BubbleSpot;
  starPreview: 'image' | 'text';
  noteMode: 0 | 1;
}
export const ACTIONS: {key: PrettyAction; name: string; icon: string}[] = [
  {key:'calendar', name:'Calendar', icon:'calendar'},
  {key:'files', name:'Files', icon:'files'},
  {key:'favorites', name:'Favorites', icon:'favorites'},
  {key:'search', name:'Search', icon:'search'},
  {key:'stars', name:'Stars', icon:'star'},
  {key:'last-note', name:'Last opened note', icon:'last-note'},
  {key:'todo', name:'To-do', icon:'todo'},
  {key:'new-note', name:'New note', icon:'new-note'},
  {key:'quick-access', name:'Quick access', icon:'quick'},
];
export const DEFAULT_PRETTY: PrettyPrefs = {
  quick: [],
  favorites: [],
  shortcuts: ['calendar','files','favorites','search','stars','last-note'],
  size: 'large',
  bubbleSpot: 'middle-right',
  starPreview: 'image',
  noteMode: 1,
};

function validPin(raw: any): raw is ShortcutItem {
  return raw && typeof raw.path === 'string' && raw.path.startsWith('/storage/') &&
    typeof raw.label === 'string' && ['folder','note-last','note-page'].includes(raw.kind);
}
export function normalPretty(raw: any): PrettyPrefs {
  const allowed = new Set(ACTIONS.map(a => a.key));
  const shortcuts: PrettyAction[] = Array.isArray(raw?.shortcuts)
    ? raw.shortcuts.filter((a: any): a is PrettyAction => allowed.has(a)).slice(0,6)
    : DEFAULT_PRETTY.shortcuts.slice();
  while(shortcuts.length < 6) shortcuts.push(DEFAULT_PRETTY.shortcuts[shortcuts.length]);
  const spots: BubbleSpot[] = ['top-left','top-right','middle-left','middle-right','bottom-left','bottom-right'];
  return {
    quick: (Array.isArray(raw?.quick) ? raw.quick.filter(validPin) : []).slice(0,30),
    favorites: (Array.isArray(raw?.favorites) ? raw.favorites.filter(validPin) : []).slice(0,30),
    shortcuts,
    size: ['normal','large','extra'].includes(raw?.size) ? raw.size : 'large',
    bubbleSpot: spots.includes(raw?.bubbleSpot) ? raw.bubbleSpot : 'middle-right',
    starPreview: raw?.starPreview === 'text' ? 'text' : 'image',
    noteMode: raw?.noteMode === 0 ? 0 : 1,
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
