/**
 * MySuperPrettyDashboard v1 home.
 *
 * Built from the owner's November 23 Manta drawing, not the legacy widget grid.
 * One screen: no home scrolling. The three View all flows use a SECONDARY screen.
 *
 * Read-only Supernote tasks: Relay export if present; otherwise local Dashboard
 * To-do clips. Never fabricate native tasks or claim that a clip is a native task.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  DeviceEventEmitter, Image, ImageSourcePropType, Modal, NativeModules,
  ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import {PluginFileAPI, PluginCommAPI, NativeUIUtils} from 'sn-plugin-lib';

import {DashboardConfig, ShortcutItem} from './config';
import {leavePlugin} from './bubble';
import {launchApp, openFile, openFolder} from './open';
import {readRecentDetailed, RecentMode} from './recent';
import {dayKey, dueBucket, dueLabel} from './relay';
import {loadPrettyPrefs, PrettyPrefs, ACTIONS, PrettyAction} from './prettyPrefs';
import {readNativeSupernoteTasks} from './prettyCloud';
import {scanStars, StarNote} from './scanner';

const {DashboardNative} = NativeModules;
const NOTE_ROOT = '/storage/emulated/0/Note';
const FONT = 'GoogleSansFlex';

// Source art is generated deterministically by scripts/generate_pretty_assets.py,
// using small monochrome line paths based on the native Supernote UI reference.
type IconName =
  | 'quick' | 'new-note' | 'file' | 'files' | 'calendar' | 'todo' | 'list' | 'recent'
  | 'search' | 'favorites' | 'star' | 'book' | 'home' | 'settings' | 'grid' | 'last-note' | 'charging' | 'notebook'
  | 'edit' | 'plus' | 'refresh' | 'back'
  | 'lizard' | 'stars' | 'dice' | 'ramen' | 'controller' | 'jellyfish'
  | 'plants' | 'octopus' | 'rocks' | 'coffee';

const images: Record<IconName, ImageSourcePropType> = {
  quick: require('../assets/pretty/quick.png'),
  'new-note': require('../assets/pretty/new-note.png'),
  file: require('../assets/pretty/file.png'),
  files: require('../assets/pretty/files.png'),
  calendar: require('../assets/pretty/calendar.png'),
  todo: require('../assets/pretty/todo.png'),
  list: require('../assets/pretty/list.png'),
  recent: require('../assets/pretty/recent.png'),
  search: require('../assets/pretty/search.png'),
  favorites: require('../assets/pretty/favorites.png'),
  star: require('../assets/pretty/star.png'),
  book: require('../assets/pretty/book.png'),
  'last-note': require('../assets/pretty/last-note.png'),
  notebook: require('../assets/pretty/notebook.png'),
  charging: require('../assets/pretty/charging.png'),
  home: require('../assets/pretty/home.png'),
  settings: require('../assets/pretty/settings.png'),
  grid: require('../assets/pretty/grid.png'),
  edit: require('../assets/pretty/edit.png'),
  plus: require('../assets/pretty/plus.png'),
  refresh: require('../assets/pretty/refresh.png'),
  back: require('../assets/pretty/back.png'),
  lizard: require('../assets/pretty/lizard.png'),
  stars: require('../assets/pretty/stars.png'),
  dice: require('../assets/pretty/dice.png'),
  ramen: require('../assets/pretty/ramen.png'),
  controller: require('../assets/pretty/controller.png'),
  jellyfish: require('../assets/pretty/jellyfish.png'),
  plants: require('../assets/pretty/plants.png'),
  octopus: require('../assets/pretty/octopus.png'),
  rocks: require('../assets/pretty/rocks.png'),
  coffee: require('../assets/pretty/coffee.png'),
};

function Icon({name, size = 24, faded = false}: {name: IconName; size?: number; faded?: boolean}) {
  return <Image source={images[name]} resizeMode="contain" style={{width: size, height: size, opacity: faded ? 0.52 : 1}} />;
}

const APPS = {
  todo: 'com.ratta.supernote.task/com.ratta.supernote.task.TaskActivity',
  calendar: 'com.ratta.supernote.calendar/com.ratta.supernote.calendar.MainActivity',
  files: 'com.ratta.supernote.inbox/com.ratta.supernote.inbox.InBoxMainActivity',
  search: 'com.ratta.search/com.ratta.search.MainActivity',
};
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FOOTER: IconName[] = ['lizard', 'stars', 'dice', 'ramen', 'controller', 'jellyfish', 'plants', 'octopus', 'rocks', 'coffee'];
const FILE_RE = /\.(note|pdf|epub|cbz|xps|fb2)$/i;

type TasksSource = 'native' | 'none';
type DashboardTask = {id: string; title: string; due: string | null; source: 'native'};
type Overlay = 'quick' | 'recent' | 'favorites' | 'stars' | null;
type FileInfo = {mtime?: number; createdAt?: number};

function mondayOf(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
function dateLabel(now: Date): string {
  return now.toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'});
}
function timeLabel(now: Date): string {
  return now.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true}).replace(/\u202f/g, ' ');
}
function fileLabel(path: string): string {
  return path.split('/').pop()?.replace(/\.(note|pdf|epub|cbz|xps|fb2)$/i, '') || path;
}
function shortDate(time?: number): string {
  if (!time || !Number.isFinite(time)) return '';
  const d = new Date(time);
  return String(d.getMonth() + 1) + '/' + String(d.getDate());
}
function kindIcon(path: string): IconName {
  return /\.note$/i.test(path) ? 'notebook' : 'file';
}
function validDay(time: number): string | null {
  return Number.isFinite(time) && time > 0 ? dayKey(new Date(time)) : null;
}
function sortTasks(tasks: DashboardTask[], now: Date): DashboardTask[] {
  const rank: Record<string, number> = {overdue: 0, today: 1, tomorrow: 2, week: 3, later: 4, none: 5};
  return [...tasks].sort((a, b) => {
    const r = rank[dueBucket(a.due, now)] - rank[dueBucket(b.due, now)];
    return r || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.title.localeCompare(b.title);
  });
}

const noteGlyphStyle = {fontFamily: FONT, color: '#111111'} as const;
function Label({
  children, size, strong = false, muted = false, style, lines,
}: {children: React.ReactNode; size: number; strong?: boolean; muted?: boolean; style?: any; lines?: number}) {
  return (
    <Text numberOfLines={lines} ellipsizeMode="tail"
      style={[noteGlyphStyle, {fontSize: size, fontWeight: strong ? '600' : '400', color: muted ? '#686868' : '#111111', includeFontPadding: false}, style]}>
      {children}
    </Text>
  );
}
function TapIcon({name, onPress, size = 27, label}: {name: IconName; onPress: () => void; size?: number; label: string}) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label}
      onPress={onPress} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
      style={{alignItems: 'center', justifyContent: 'center', width: size + 16, height: size + 15}}>
      <Icon name={name} size={size} />
    </TouchableOpacity>
  );
}
function SectionHeading({
  icon, title, viewAll, edit, fontSize,
}: {icon: IconName; title: string; viewAll?: () => void; edit?: () => void; fontSize: number}) {
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', minHeight: fontSize + 17, marginBottom: 3}}>
      <Icon name={icon} size={fontSize + 4}/>
      <Label size={fontSize} style={{marginLeft: 7, flexShrink: 1}}>{title}</Label>
      <View style={{flex: 1}} />
      {viewAll && (
        <TouchableOpacity onPress={viewAll} accessibilityRole="button" accessibilityLabel={'View all ' + title}
          hitSlop={{top: 7, bottom: 7, left: 5, right: 5}}>
          <Label size={Math.max(12, fontSize - 5)} muted>View all ›</Label>
        </TouchableOpacity>
      )}
      {edit && (
        <TouchableOpacity onPress={edit} accessibilityRole="button" accessibilityLabel={'Edit ' + title}
          style={{flexDirection: 'row', alignItems: 'center', marginLeft: 8}}>
          <Label size={Math.max(12, fontSize - 5)} muted>Edit</Label>
          <View style={{marginLeft: 3}}><Icon name="edit" size={fontSize - 3}/></View>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function PrettyHome({
  config, nonce, onSettings,
}: {config: DashboardConfig | null; nonce: number; onSettings: () => void}): React.JSX.Element {
  const {width, height} = useWindowDimensions();
  // All sizes are Android dp. Proportional to the usable plugin window, rather
  // than blindly treating the Manta's physical 1920x2560 pixels as dp.
  const s = Math.max(0.78, Math.min(width / 760, height / 950, 1.28));
  const [prefs, setPrefs] = useState<PrettyPrefs | null>(null);
  const sizeBoost = prefs?.size === 'extra' ? 1.17 : prefs?.size === 'normal' ? 0.94 : 1.06;
  const body = 19 * s * sizeBoost;
  const heading = 21 * s * sizeBoost;
  const secondary = 14 * s * sizeBoost;
  const thin = '#b7b7b7';
  const [now, setNow] = useState(() => new Date());
  const [battery, setBattery] = useState<{level: number; charging: boolean} | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [recentMode, setRecentMode] = useState<RecentMode>('modified');
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [taskSource, setTaskSource] = useState<TasksSource>('none');
  const [taskError, setTaskError] = useState('');
  const [taskLoading, setTaskLoading] = useState(true);
  const [info, setInfo] = useState<Record<string, FileInfo>>({});
  const [createdDays, setCreatedDays] = useState<Set<string>>(new Set());
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [busy, setBusy] = useState(false);
  const [starNotes, setStarNotes] = useState<StarNote[]>([]);
  const [starLoading, setStarLoading] = useState(false);

  const pinned = useMemo(() => prefs?.quick ?? [], [prefs]);
  const favPinned = useMemo(() => prefs?.favorites ?? [], [prefs]);
  useEffect(() => {
    let live = true;
    loadPrettyPrefs(config).then(next => {if (live) setPrefs(next);}).catch(() => {});
    return () => {live = false;};
  }, [config, nonce]);

  const refresh = useCallback(() => {
    setNow(new Date());
    DashboardNative?.getBattery?.().then(setBattery).catch(() => {});
    readRecentDetailed().then(result => {
      setRecent(result.paths.filter(p => FILE_RE.test(p)));
      setRecentMode(result.mode);
    }).catch(() => {});
    // Only the real Supernote To-do data. No local/duplicate task fallback.
    setTaskLoading(true);
    readNativeSupernoteTasks().then(result => {
      setTasks(result.tasks.map(t => ({id:t.id,title:t.title,due:t.due,source:'native'})));
      setTaskSource('native');
      setTaskError(result.truncated ? 'Supernote returned an incomplete task list.' : '');
    }).catch(e => {
      setTasks([]);setTaskSource('none');
      setTaskError(String(e?.message ?? 'Could not read Supernote To-do.'));
    }).finally(() => setTaskLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      setNow(new Date());
      DashboardNative?.getBattery?.().then(setBattery).catch(() => {});
    }, 60000);
    const subscription = DeviceEventEmitter.addListener('dashboard_refresh_all', refresh);
    return () => {clearInterval(id); subscription.remove();};
  }, [refresh, nonce]);

  // File metadata for pinned items and the recent list. One listDir per
  // parent folder, not one filesystem scan per displayed row.
  useEffect(() => {
    const files = [...pinned.map(p => p.path), ...recent.slice(0, 20)].filter(Boolean);
    const dirs = [...new Set(files.map(p => p.substring(0, p.lastIndexOf('/'))))];
    let active = true;
    Promise.all(dirs.map(async dir => {
      try {return (await DashboardNative.listDir(dir)) as Array<{path: string; mtime: number; createdAt?: number}>;}
      catch {return [];}
    })).then(groups => {
      if (!active) return;
      const next: Record<string, FileInfo> = {};
      groups.flat().forEach(e => {next[e.path] = {mtime: e.mtime, createdAt: e.createdAt};});
      setInfo(next);
    });
    return () => {active = false;};
  }, [pinned, recent, nonce]);

  // Only creation timestamps may produce a dot; mtime is NOT a proxy.
  // Note: Android's filesystem may not expose birth times for all notebooks.
  useEffect(() => {
    let active = true;
    (async () => {
      const queue = [NOTE_ROOT];
      const seen = new Set<string>();
      const dates = new Set<string>();
      while (queue.length > 0 && seen.size < 250 && active) {
        const dir = queue.shift()!;
        if (seen.has(dir)) continue;
        seen.add(dir);
        try {
          const entries: Array<{name: string; path: string; isDir: boolean; createdAt?: number}> = await DashboardNative.listDir(dir);
          for (const e of entries ?? []) {
            if (e.isDir && !e.name.startsWith('.')) queue.push(e.path);
            else if (/\.note$/i.test(e.name) && typeof e.createdAt === 'number') {
              const k = validDay(e.createdAt);
              if (k) dates.add(k);
            }
          }
        } catch { /* folder not granted */ }
      }
      if (active) setCreatedDays(dates);
    })();
    return () => {active = false;};
  }, [nonce]);

  useEffect(() => {
    if (overlay !== 'stars') return;
    let alive = true;
    setStarLoading(true);
    scanStars([NOTE_ROOT], prefs?.starPreview ?? 'image', false)
      .then(data => { if (alive) setStarNotes(data.notes); })
      .catch(() => { if (alive) setStarNotes([]); })
      .finally(() => { if (alive) setStarLoading(false); });
    return () => { alive = false; };
  }, [overlay, nonce, prefs?.starPreview]);

  const activeTasks = useMemo(() => sortTasks(tasks, now).slice(0, 5), [tasks, now]);
  const weekStart = mondayOf(now);
  const days = WEEK.map((label, index) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + index);
    return {label, date: d, today: dayKey(d) === dayKey(now), hasNotes: createdDays.has(dayKey(d))};
  });
  const openPinned = (it: ShortcutItem) => {
    if (it.kind === 'folder') openFolder(it.path);
    else openFile(it.path, it.kind === 'note-page' ? it.page : 0);
  };
  const openTask = (_t: DashboardTask) => {launchApp(APPS.todo);};
  const openCalendar = (_date: Date) => {
    // Native Calendar launching is tested through the community's Android
    // Activity integration. No documented intent extra navigates to a chosen
    // day, so do not send guessed extras or claim day navigation works.
    launchApp(APPS.calendar);
  };
  const openLastNote = () => {
    const last = recent.find(path => /\.note$/i.test(path));
    if (last) openFile(last);
    else NativeUIUtils.showRattaDialog('No recently accessed note is available.', '', 'OK', false).catch(() => {});
  };
  const newNote = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const path = NOTE_ROOT + '/' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
        '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.note';
      const api = PluginFileAPI as any;
      if (typeof api.createNote !== 'function') throw new Error('Supernote createNote is not available.');
      // Empty string fails SDK input validation. Its real system templates
      // expose a human name and vUri. Try the first portrait template names.
      const templates: any[] = await PluginCommAPI.getNoteSystemTemplates() as any[] ?? [];
      const blank = templates.find(t => /blank|plain|empty|white/i.test(t.name ?? '')) ?? templates[0];
      const candidates = [blank?.name, blank?.vUri, ...templates.slice(0, 2).map(t => t.name)]
        .filter((v, i, arr): v is string => typeof v === 'string' && !!v && arr.indexOf(v) === i);
      if (!candidates.length) throw new Error('No blank note template is available on this firmware.');
      let lastError = 'The device refused to create a note.';
      let created = false;
      for (const template of candidates) {
        try {
          const response: any = await api.createNote({
            notePath: path, template, mode: prefs?.noteMode ?? 1, isPortrait: true,
          });
          if (response?.success === true && response?.result !== false) {
            created = true; break;
          }
          lastError = String(response?.error?.message ?? 'Supernote rejected template ' + template);
        } catch (e: any) {lastError = String(e?.message ?? e);}
      }
      if (!created) throw new Error(lastError);
      await openFile(path);
    } catch (error: any) {
      NativeUIUtils.showRattaDialog('New note could not be created: ' +
        String(error?.message ?? error), '', 'OK', false).catch(() => {});
    } finally {setBusy(false);}
  };
  const shortcutActions: Record<PrettyAction, () => void> = {
    calendar: () => openCalendar(new Date()),
    files: () => launchApp(APPS.files),
    favorites: () => setOverlay('favorites'),
    search: () => launchApp(APPS.search),
    stars: () => setOverlay('stars'),
    'last-note': openLastNote,
    todo: () => launchApp(APPS.todo),
    'new-note': newNote,
    'quick-access': () => setOverlay('quick'),
  };

  const shortcutItems = (prefs?.shortcuts ?? ['calendar','files','favorites','search','stars','last-note'])
    .map(key => {
      const action = ACTIONS.find(a => a.key === key)!;
      return {label: key === 'last-note' && recentMode === 'modified' ?
        'Recently modified note' : (action?.name ?? key),
        icon: (action?.icon ?? 'grid') as IconName,
        action: shortcutActions[key as PrettyAction]};
    });

  const listRowH = 67 * s;
  const fileRow = (path: string, i: number, date?: number) => (
    <TouchableOpacity key={path + i} onPress={() => openFile(path)} style={[styles.fileRow, {height: listRowH}]}>
      <Icon name={kindIcon(path)} size={21 * s}/>
      <Label size={body} lines={1} style={{flex: 1, marginHorizontal: 9 * s}}>{fileLabel(path)}</Label>
      <Label size={secondary} muted>{shortDate(date)}</Label>
    </TouchableOpacity>
  );
  const pinRow = (it: ShortcutItem, i: number) => (
    <TouchableOpacity key={it.path + i} onPress={() => openPinned(it)} style={[styles.fileRow, {height: listRowH}]}>
      <Icon name={it.kind === 'folder' ? 'files' : 'star'} size={21 * s}/>
      <Label size={body} lines={1} style={{flex: 1, marginHorizontal: 9 * s}}>{it.label || fileLabel(it.path)}</Label>
      <Label size={secondary} muted>{shortDate(info[it.path]?.mtime)}</Label>
    </TouchableOpacity>
  );
  const taskRow = (it: DashboardTask, i: number) => {
    const bucket = dueBucket(it.due, now);
    return (
      <TouchableOpacity key={it.id + i} onPress={() => openTask(it)}
        style={[styles.taskRow, {height: listRowH, backgroundColor: i % 2 === 0 ? '#eeeeee' : '#ffffff', borderRadius: 8}]}>
        <View style={{width: 18 * s, height: 18 * s, borderWidth: 1.7, borderColor: '#111111', borderRadius: 99, marginRight: 8 * s}}/>
        <Label size={body} lines={1} style={{flex: 1}}>{it.title}</Label>
        {bucket === 'overdue' ? (
          <View style={{backgroundColor: '#111111', borderRadius: 3, paddingHorizontal: 5 * s, paddingVertical: 3, marginLeft: 4}}>
            <Text style={{fontFamily: FONT, fontSize: 11 * s, fontWeight: '700', color: '#ffffff', includeFontPadding: false}}>OVERDUE</Text>
          </View>
        ) : it.due ? (
          <Label size={secondary} muted style={{marginLeft: 5, textAlign: 'right'}}>{dueLabel(it.due, now)}</Label>
        ) : null}
      </TouchableOpacity>
    );
  };

  const noTasks = () => (
    <TouchableOpacity onPress={taskSource === 'none' ? onSettings : () => launchApp(APPS.todo)} style={{paddingTop: 16 * s, paddingHorizontal: 7}}>
      <Label size={Math.max(13, body - 2)} muted lines={3}>
        {taskLoading ? 'Loading Supernote To-do…' : taskError || (taskSource === 'native' ? 'No incomplete Supernote tasks.' : 'Connect Supernote To-do in dashboard Settings.')}
      </Label>
    </TouchableOpacity>
  );

  const headerHeight = 117 * s;
  const weekHeight = 100 * s;
  const footerHeight = 56 * s;
  return (
    <View style={[styles.root, {paddingHorizontal: 17 * s, paddingTop: 8 * s, paddingBottom: 8 * s}]}>
      <View style={{height: headerHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
        <TouchableOpacity onPress={() => openCalendar(now)} accessibilityRole="button"
          accessibilityLabel="Open Supernote Calendar" style={{flex: 1, justifyContent: 'center'}}>
          <Label size={22 * s} style={{marginBottom: 3 * s}}>{dateLabel(now)}</Label>
          <Label size={52 * s} style={{lineHeight: 57 * s, fontWeight: '500'}}>{timeLabel(now)}</Label>
        </TouchableOpacity>
        <TouchableOpacity onPress={newNote} accessibilityRole="button"
          accessibilityLabel="Create a new note" style={{width: 80 * s, height: 83 * s, alignItems:'center',justifyContent:'center',marginRight:20*s}}>
          <Icon name="new-note" size={59*s}/>
        </TouchableOpacity>
        <View style={{flexDirection: 'row',alignItems:'center',marginRight:12*s}}>
          <View style={{flexDirection:'row',alignItems:'center',minWidth:85*s}}>
            <View style={{width:26*s,height:13*s,borderWidth:1.5,borderColor:'#111',borderRadius:2,padding:2,justifyContent:'center',marginRight:4*s}}>
              <View style={{width:Math.max(0,Math.min(100,battery?.level??0))*0.18*s,
                height:6*s,backgroundColor:'#111'}}/>
            </View>
            <View style={{width:3*s,height:6*s,backgroundColor:'#111',marginRight:5*s}}/>
            <Label size={17*s}>{battery?.level != null && battery.level >= 0 ? battery.level + '%' : '—'}</Label>
            {battery?.charging && <View style={{marginLeft:4*s}}><Icon name="charging" size={18*s}/></View>}
          </View>
          <TapIcon name="settings" label="Dashboard settings" size={30 * s} onPress={onSettings}/>
          <TapIcon name="home" label="Close dashboard" size={29 * s} onPress={() => leavePlugin()}/>
        </View>
      </View>
      <View style={{height: weekHeight, flexDirection: 'row', borderBottomWidth: 1, borderColor: '#a8a8a8'}}>
        {days.map(({label, date, today, hasNotes}) => (
          <TouchableOpacity onPress={() => openCalendar(date)} key={label} accessibilityRole="button"
            accessibilityLabel={'Open Supernote Calendar; date '+date.toDateString()}
            style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}> 
            <Label size={19 * s} style={{marginBottom: 5 * s}}>{label}</Label>
            <View style={{width: 40 * s, height: 40 * s, borderRadius: 25 * s,
              alignItems: 'center', justifyContent: 'center', backgroundColor: today ? '#111111' : 'transparent'}}>
              <Text style={{fontFamily: FONT, fontSize: 27 * s, includeFontPadding: false,
                fontWeight: today ? '600' : '400', color: today ? '#ffffff' : '#111111'}}>{date.getDate()}</Text>
            </View>
            <View style={{height: 8 * s, alignItems: 'center', marginTop: 2 * s}}>
              {hasNotes && <View style={{width: 4.5 * s, height: 4.5 * s, borderRadius: 4 * s, backgroundColor: '#222222'}} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main body is a strict two-by-two grid; NO ScrollView in home view. */}
      <View style={{flex: 1, minHeight: 0}}>
        <View style={{flex: 1.05, flexDirection: 'row', minHeight: 0}}>
          <View style={[styles.cell, {paddingTop: 11 * s, paddingRight: 6 * s, borderBottomWidth: 1, borderBottomColor: thin}]}>
            <SectionHeading icon="quick" title="Quick access" fontSize={heading} viewAll={() => setOverlay('quick')}/>
            {pinned.length
              ? pinned.slice(0, 5).map(pinRow)
              : <TouchableOpacity onPress={onSettings} style={{padding: 11}}><Label size={body - 1} muted>Tap here to pin notebooks or documents in Settings.</Label></TouchableOpacity>}
          </View>
          <View style={[styles.splitter, {marginTop: 10 * s, marginBottom: 10 * s, marginHorizontal: 8 * s}]} />
          <View style={[styles.cell, {paddingTop: 11 * s, paddingLeft: 6 * s, borderBottomWidth: 1, borderBottomColor: thin}]}>
            <SectionHeading icon="todo" title="To-do" fontSize={heading} viewAll={() => launchApp(APPS.todo)}/>
            {activeTasks.length ? activeTasks.map(taskRow) : noTasks()}
          </View>
        </View>

        <View style={{flex: 0.95, flexDirection: 'row', minHeight: 0}}>
          <View style={[styles.cell, {paddingTop: 12 * s, paddingRight: 6 * s}]}>
            <SectionHeading icon="grid" title="Shortcuts" fontSize={heading} edit={onSettings}/>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 * s}}>
              {shortcutItems.map((it, i) => (
                <TouchableOpacity key={it.label} onPress={it.action} accessibilityRole="button" accessibilityLabel={it.label}
                  style={{width: '50%', paddingRight: i % 2 === 0 ? 5 * s : 0, paddingLeft: i % 2 === 1 ? 5 * s : 0,
                    paddingBottom: 10 * s}}>
                  <View style={{height: 83 * s, flexDirection: 'row', borderWidth: 1.1, borderColor: '#777777',
                    borderRadius: 8 * s, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 * s}}>
                    <Icon name={it.icon} size={30 * s}/>
                    <Label size={Math.max(13, 16 * s)} lines={2} style={{marginLeft: 5 * s, flexShrink: 1}}>{it.label}</Label>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={[styles.splitter, {marginTop: 10 * s, marginBottom: 10 * s, marginHorizontal: 8 * s}]} />
          <View style={[styles.cell, {paddingTop: 12 * s, paddingLeft: 6 * s}]}>
            <SectionHeading icon="recent" title="Recent notes" fontSize={heading} viewAll={() => setOverlay('recent')}/>
            {recent.length ? recent.slice(0, 5).map((p, i) => fileRow(p, i, info[p]?.mtime)) :
              <View style={{padding: 11}}><Label size={body - 1} muted>No recent notes yet.</Label></View>}
          </View>
        </View>
      </View>

      <View style={{height: footerHeight, borderTopWidth: 1, borderColor: thin, marginTop: 1, flexDirection: 'row', alignItems: 'center'}}>
        {FOOTER.map((name, i) => (
          <View key={name} style={{flex: 1, alignItems: 'center', justifyContent: 'center',
            transform: [{translateY: 0}]}}>
            <View style={{height: 41 * s, width: 41 * s, borderRadius: 99,
              borderWidth: 1, borderColor: '#888888', alignItems: 'center', justifyContent: 'center'}}>
              <Icon name={name} size={26 * s}/>
            </View>
          </View>
        ))}
      </View>

      {/* The HOME never scrolls; scrolling is allowed only inside View all overlays. */}
      <Modal transparent visible={overlay !== null} animationType="none" onRequestClose={() => setOverlay(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSurface, {margin: 20 * s, padding: 18 * s}]}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
              <TapIcon name="back" label="Back to dashboard" size={23 * s} onPress={() => setOverlay(null)}/>
              <Label size={25 * s} strong style={{marginLeft: 9, flex: 1}}>
                {overlay === 'quick' ? 'Quick access' : overlay === 'recent' ? 'Recent notes' : overlay === 'favorites' ? 'Favorites' : 'Stars'}
              </Label>
              {(overlay === 'quick' || overlay === 'favorites') && <TouchableOpacity onPress={() => {setOverlay(null); onSettings();}}>
                <Label size={16 * s}>Edit</Label>
              </TouchableOpacity>}
            </View>
            {overlay === 'stars' ? (
              <ScrollView>
                {starLoading && <Label size={body} muted>Reading handwritten star marks…</Label>}
                {!starLoading && starNotes.length === 0 && <Label size={body} muted>No starred pages found in Notes.</Label>}
                {starNotes.map(note => (
                  <View key={note.file} style={{paddingVertical: 8}}>
                    <Label size={body} strong lines={1}>{fileLabel(note.file)}</Label>
                    {note.pages.map(page => (
                      <TouchableOpacity key={page.page} onPress={() => openFile(note.file, page.page)}
                        style={{paddingVertical: 10, paddingLeft: 16, borderBottomColor: '#dddddd', borderBottomWidth: 1}}>
                        <Label size={body}>Page {page.page}  ·  {page.count} star{page.count === 1 ? '' : 's'}</Label>
                        {page.texts?.map((t,j) => t ? <Label key={'text'+j} size={body - 2} style={{marginTop:7}}>{t}</Label> : null)}
                        {page.lines?.map((line,j) => line ? <StarStrip key={'line'+j} img={line}/> : null)}
                        {!page.lines?.some(Boolean) && !page.texts?.some(Boolean) && <Label size={secondary} muted>
                          No handwriting preview for this mark. Tap to open its page.
                        </Label>}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <ScrollView>
                {(overlay === 'recent' ? recent : overlay === 'favorites' ? favPinned.map(p=>p.path) : pinned.map(p => p.path)).length === 0 && (
                  <Label size={body} muted>No entries available.</Label>
                )}
                {overlay === 'favorites' && <Label size={secondary} muted>
                  Pinned dashboard favorites. Native Supernote Favorites are not readable by third-party plugins.
                </Label>}
                {overlay === 'recent' ? recent.map((p, i) => fileRow(p, i, info[p]?.mtime))
                  : (overlay === 'favorites' ? favPinned : pinned).map(pinRow)}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}


function StarStrip({img}: {img: {png:string;aspect:number;yFrac:number;hFrac:number}}) {
  const [w, setW] = useState(0);
  const full = img.aspect > 0 ? w / img.aspect : w * 1.33;
  const h = Math.max(20,Math.min(140,img.hFrac * full));
  return <View onLayout={e=>setW(e.nativeEvent.layout.width)} style={{width:'100%',height:h,overflow:'hidden',backgroundColor:'white',marginTop:5}}>
    {w>0&&<Image source={{uri:'file://'+img.png}}
      style={{width:w,height:full,marginTop:-img.yFrac*full}} resizeMode="stretch"/>}
  </View>;
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#ffffff', overflow: 'hidden'},
  cell: {flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden'},
  splitter: {width: 1, backgroundColor: '#8c8c8c'},
  fileRow: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5},
  taskRow: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, marginBottom: 1},
  modalBackdrop: {flex: 1, backgroundColor: '#00000055', justifyContent: 'center'},
  modalSurface: {flex: 1, backgroundColor: '#ffffff', borderColor: '#777777', borderWidth: 1, borderRadius: 10},
});
