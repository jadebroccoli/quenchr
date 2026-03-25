import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors, type as typ, radius } from '../../tokens';

interface Props {
  title: string;
  subtitle?: string;
  onPress: () => void;
  style?: ViewStyle;
}

export function Dropzone({ title, subtitle, onPress, style }: Props) {
  return (
    <TouchableOpacity style={[styles.zone, style]} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.icon}>{'\u2191'}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  zone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.brown3,
    borderRadius: radius.btn,
    paddingVertical: 26,
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
    color: colors.brown3,
    marginBottom: 8,
  },
  title: {
    ...typ.btnSm,
    color: colors.brown,
  },
  subtitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    color: colors.brown3,
    marginTop: 4,
  },
});
