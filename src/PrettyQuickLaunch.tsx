/** Four prominent pinned shortcuts, with the remaining configured shortcuts expandable. */
import React, {useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {ShortcutItem} from './config';
import {openFile, openFolder} from './open';

function activate(item: ShortcutItem) {
  if (item.kind === 'folder') {
    openFolder(item.path);
  } else {
    openFile(item.path, item.kind === 'note-page' ? item.page : 0);
  }
}

export function PrettyQuickLaunch({items}: {items: ShortcutItem[]}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const pinned = items.slice(0, 4);
  const more = items.slice(4);
  return (
    <View style={styles.root}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>QUICK LAUNCH</Text>
        <Text style={styles.subheading}>PINNED</Text>
      </View>
      <View style={styles.grid}>
        {Array.from({length: 4}).map((_, i) => {
          const item = pinned[i];
          return (
            <TouchableOpacity
              key={i}
              disabled={!item}
              accessibilityRole="button"
              accessibilityLabel={item?.label ?? 'Unassigned shortcut'}
              onPress={() => item && activate(item)}
              style={[styles.tile, !item && styles.emptyTile]}>
              <Text style={[styles.tileText, !item && styles.emptyText]} numberOfLines={2}>
                {item ? item.label : 'Unassigned'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {more.length > 0 && (
        <>
          <TouchableOpacity style={styles.expand} onPress={() => setExpanded(v => !v)}>
            <Text style={styles.expandText}>{expanded ? '− HIDE SHORTCUTS' : '+ ALL SHORTCUTS (' + more.length + ')'}</Text>
          </TouchableOpacity>
          {expanded && more.map((item, i) => (
            <TouchableOpacity key={i} style={styles.listItem} onPress={() => activate(item)}>
              <Text style={styles.listText}>{item.label}</Text>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {marginHorizontal: 4, marginBottom: 12},
  headingRow: {flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 5, marginBottom: 8},
  heading: {fontSize: 16, fontWeight: '700', color: '#000000', letterSpacing: 0.5},
  subheading: {fontSize: 10, fontWeight: '500', color: '#777777'},
  grid: {flexDirection: 'row', gap: 6},
  tile: {flex: 1, minHeight: 72, borderWidth: 1.5, borderColor: '#000000', borderRadius: 5, justifyContent: 'center', alignItems: 'center', padding: 6},
  emptyTile: {borderColor: '#bbbbbb'},
  tileText: {fontSize: 14, fontWeight: '700', textAlign: 'center', color: '#000000'},
  emptyText: {fontSize: 11, color: '#888888', fontWeight: '400'},
  expand: {alignSelf: 'flex-start', paddingVertical: 12},
  expandText: {fontSize: 12, color: '#000000', fontWeight: '700'},
  listItem: {borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#999999', paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between'},
  listText: {fontSize: 14, color: '#000000'},
  arrow: {fontSize: 16, color: '#000000'},
});
