import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors, type as typ, radius } from '../../tokens';

interface Props {
  title?: string;
  subtitle?: string;
  onPress: () => void;
  style?: ViewStyle;
}

export function AuditBanner({
  title = 'Run an Audit First',
  subtitle = 'We need a baseline before cleanup',
  onPress,
  style,
}: Props) {
  return (
    <TouchableOpacity style={[styles.banner, style]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>{'\u203A'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.cream2,
    borderWidth: 1,
    borderColor: colors.cream4,
    borderRadius: radius.btn,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    ...typ.btnSm,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    color: colors.ink2,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: colors.ink3,
    marginLeft: 8,
  },
});
