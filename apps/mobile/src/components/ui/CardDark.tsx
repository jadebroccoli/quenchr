import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, radius } from '../../tokens';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function CardDark({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.char2,
    borderRadius: radius.card,
    padding: spacing.cardPad,
  },
});
