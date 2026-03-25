import { View, Text, StyleSheet } from 'react-native';
import { colors, type as typ } from '../../tokens';

interface StatItem {
  value: string | number;
  label: string;
  gold?: boolean;
}

interface Props {
  items: StatItem[];
}

export function StatRow({ items }: Props) {
  return (
    <View style={styles.row}>
      {items.map((item, i) => (
        <View key={item.label} style={[styles.cell, i < items.length - 1 && styles.cellBorder]}>
          <Text style={[styles.number, item.gold && styles.gold]}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cellBorder: {
    borderRightWidth: 1,
    borderRightColor: colors.char4,
  },
  number: {
    ...typ.statNum,
    color: colors.lt,
  },
  gold: {
    color: colors.gold,
  },
  label: {
    ...typ.caption,
    color: colors.lt3,
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
