/** E-ink calendar strip adapted from the user's TRMNL Pretty Calendar visual reference. */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function mondayOf(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export function PrettyWeekStrip({nonce = 0}: {nonce?: number}): React.JSX.Element {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(interval);
  }, [nonce]);

  const start = mondayOf(now);
  const days = DAYS.map((name, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {name, date, today: date.toDateString() === now.toDateString()};
  });

  return (
    <View style={styles.container} accessibilityLabel="Current week">
      <View style={styles.month}>
        <Text style={styles.monthText}>{MONTHS[now.getMonth()]} <Text style={styles.year}>{now.getFullYear()}</Text></Text>
      </View>
      {days.map(({name, date, today}) => (
        <View key={name} style={styles.day}>
          <Text style={styles.dayName}>{name}</Text>
          <View style={[styles.dateCircle, today && styles.today]}>
            <Text style={[styles.dayNumber, today && styles.todayNumber]}>{date.getDate()}</Text>
          </View>
          <Text style={styles.marker}>·</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#999999', paddingVertical: 8, marginBottom: 8},
  month: {flex: 1.25, justifyContent: 'center', paddingLeft: 3},
  monthText: {fontSize: 22, fontWeight: '500', color: '#000000'},
  year: {fontWeight: '300', color: '#777777'},
  day: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  dayName: {fontSize: 11, color: '#777777', marginBottom: 3},
  dateCircle: {width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center'},
  today: {backgroundColor: '#000000'},
  dayNumber: {fontSize: 23, color: '#000000', fontWeight: '400'},
  todayNumber: {color: '#ffffff', fontWeight: '700'},
  marker: {fontSize: 12, color: '#777777', lineHeight: 12},
});
