import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, type as typ, radius } from '../../tokens';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export function SecondaryButton({ label, onPress, disabled, style }: Props) {
  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.brown3,
    borderRadius: radius.btn,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...typ.btnSm,
    color: colors.brown,
  },
});
