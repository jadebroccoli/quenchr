import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSubscriptionStore } from '../src/stores/subscription-store';
import { useSettingsStore } from '../src/stores/settings-store';
import { colors, type as typ, spacing, radius } from '../src/tokens';
import { CardLight, CardDark, SectionDivider } from '../src/components/ui';

export default function SettingsScreen() {
  const { tier } = useSubscriptionStore();
  const { devMode, setDevMode } = useSettingsStore();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 12H5" />
              <Path d="M12 19l-7-7 7-7" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 36 }} />
        </View>

        <SectionDivider />

        <View style={styles.body}>
          {/* Account */}
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <CardLight>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Subscription</Text>
              <View style={[styles.tierBadge, tier === 'pro' && styles.tierBadgePro]}>
                <Text style={[styles.tierBadgeText, tier === 'pro' && styles.tierBadgeTextPro]}>
                  {tier === 'pro' ? 'PRO' : 'FREE'}
                </Text>
              </View>
            </View>
          </CardLight>

          {/* Developer */}
          <Text style={styles.sectionLabel}>DEVELOPER</Text>
          <CardLight>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Dev Mode</Text>
                <Text style={styles.settingDesc}>
                  Unlocks all Pro features for testing. Bypasses paywall and subscription checks.
                </Text>
              </View>
              <Switch
                value={devMode}
                onValueChange={setDevMode}
                trackColor={{ false: colors.cream3, true: colors.gold }}
                thumbColor={colors.cream}
              />
            </View>
            {devMode && (
              <View style={styles.devBadge}>
                <Text style={styles.devBadgeText}>PRO FEATURES UNLOCKED</Text>
              </View>
            )}
          </CardLight>

          {/* About */}
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <CardLight>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Version</Text>
              <Text style={styles.settingValue}>0.1.0</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Build</Text>
              <Text style={styles.settingValue}>Dev Client</Text>
            </View>
          </CardLight>

          {/* Data */}
          <Text style={styles.sectionLabel}>PRIVACY</Text>
          <CardDark>
            <Text style={styles.darkNote}>
              All scan data stays on your device. Only anonymized scores are synced to your account.
            </Text>
          </CardDark>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePad,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cream2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typ.h2,
    color: colors.ink,
  },
  body: {
    paddingHorizontal: spacing.pagePad,
    gap: 10,
  },
  sectionLabel: {
    ...typ.label,
    color: colors.ink3,
    marginTop: 10,
    marginBottom: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    ...typ.btn,
    color: colors.ink,
  },
  settingDesc: {
    ...typ.bodySmall,
    color: colors.ink3,
    marginTop: 2,
  },
  settingValue: {
    ...typ.body,
    color: colors.ink3,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cream3,
    marginVertical: 12,
  },
  tierBadge: {
    backgroundColor: colors.cream3,
    borderRadius: radius.badge,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tierBadgePro: {
    backgroundColor: colors.gold + '20',
  },
  tierBadgeText: {
    ...typ.label,
    color: colors.brown,
  },
  tierBadgeTextPro: {
    color: colors.gold,
  },
  devBadge: {
    marginTop: 12,
    backgroundColor: colors.gold + '20',
    borderRadius: radius.badge,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  devBadgeText: {
    ...typ.label,
    color: colors.gold,
  },
  darkNote: {
    ...typ.body,
    color: colors.lt3,
  },
});
