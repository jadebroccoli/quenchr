import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../tokens';

interface Props {
  progress: number; // 0–1
  variant?: 'light' | 'dark';
  style?: ViewStyle;
}

export function ProgressBar({ progress, variant = 'light', style }: Props) {
  const trackColor = variant === 'light' ? colors.cream3 : colors.char4;
  return (
    <View style={[styles.track, { backgroundColor: trackColor }, style]}>
      <View style={[styles.fill, { width: `${Math.min(progress * 100, 100)}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
});
