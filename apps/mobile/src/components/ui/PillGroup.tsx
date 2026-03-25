import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, type as typ, radius } from '../../tokens';

interface PillOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: PillOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
}

export function PillGroup<T extends string>({ options, selected, onSelect }: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const isSelected = opt.value === selected;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.pill, isSelected && styles.pillSelected]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.brown2,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pillSelected: {
    backgroundColor: colors.brown,
    borderColor: colors.brown,
  },
  pillText: {
    ...typ.pillText,
    color: colors.brown,
  },
  pillTextSelected: {
    color: colors.lt,
  },
});
