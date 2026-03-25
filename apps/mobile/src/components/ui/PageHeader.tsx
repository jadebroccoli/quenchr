import { View, Text, StyleSheet } from 'react-native';
import { colors, type, spacing } from '../../tokens';

interface Props {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

export function PageHeader({ eyebrow, title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.pagePad,
    paddingTop: 26,
    paddingBottom: 16,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.ink3,
    marginBottom: 6,
  },
  title: {
    ...type.h1,
    color: colors.ink,
  },
  subtitle: {
    ...type.body,
    color: colors.ink2,
    marginTop: 4,
  },
});
