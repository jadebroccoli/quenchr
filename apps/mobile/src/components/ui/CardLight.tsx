import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, radius } from '../../tokens';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function CardLight({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cream2,
    borderWidth: 0.5,
    borderColor: colors.cream3,
    borderRadius: radius.card,
    padding: spacing.cardPad,
  },
});
