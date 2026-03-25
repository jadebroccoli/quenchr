import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../tokens';

export function SectionDivider() {
  return <View style={styles.rule} />;
}

const styles = StyleSheet.create({
  rule: {
    height: 1,
    backgroundColor: colors.cream3,
    marginHorizontal: spacing.pagePad,
    marginBottom: spacing.sectionGap,
  },
});
