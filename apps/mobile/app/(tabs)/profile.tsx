import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { evaluateBadges, getLevel } from '@quenchr/shared';
import { supabase } from '@quenchr/supabase-client';
import { useAuthStore } from '../../src/stores/auth-store';
import { useAuditStore } from '../../src/stores/audit-store';
import { useCleanupStore } from '../../src/stores/cleanup-store';
import { useSubscriptionStore } from '../../src/stores/subscription-store';
import { colors, type as typ, spacing, radius } from '../../src/tokens';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { CardLight } from '../../src/components/ui/CardLight';
import { CardDark } from '../../src/components/ui/CardDark';
import { ProgressBar } from '../../src/components/ui/ProgressBar';
import { StatRow } from '../../src/components/ui/StatRow';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const streak = useCleanupStore((s) => s.streak);
  const progress = useCleanupStore((s) => s.progress);
  const audits = useAuditStore((s) => s.audits);
  const { tier, isPro } = useSubscriptionStore();

  // Evaluate badge unlock status
  const badges = useMemo(
    () =>
      evaluateBadges({
        streak,
        totalTasksCompleted: progress.length,
        audits,
      }),
    [streak, progress.length, audits]
  );

  // Compute level from total points
  const level = useMemo(
    () => getLevel(streak?.total_points ?? 0),
    [streak?.total_points]
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
    useAuthStore.getState().signOut();
    router.replace('/');
  }

  function handleUpgrade() {
    // TODO: Phase 5 - RevenueCat integration
    Alert.alert('Coming Soon', 'Pro subscriptions will be available in the next update.');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header row with settings gear */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <PageHeader eyebrow="You" title="Redemption Arc." />
          </View>
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsButton}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.ink3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <SvgCircle cx={12} cy={12} r={3} />
              <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* User Info */}
        <View style={styles.section}>
          <View style={styles.userRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(user?.display_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.display_name || 'User'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <View style={[styles.tierBadge, isPro() && styles.tierBadgePro]}>
                <Text style={[styles.tierText, isPro() && styles.tierTextPro]}>
                  {tier.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Level card */}
        <View style={styles.section}>
          <CardLight style={{ alignItems: 'center' }}>
            <Text style={styles.levelNumber}>{level.level}</Text>
            <Text style={styles.levelLabel}>{level.label}</Text>
            <ProgressBar progress={level.progress} variant="light" style={styles.levelBar} />
            {level.nextLevelPoints !== null ? (
              <Text style={styles.levelCaption}>
                {level.currentPoints} / {level.nextLevelPoints} pts to next level
              </Text>
            ) : (
              <Text style={styles.levelCaption}>Max level reached!</Text>
            )}
          </CardLight>
        </View>

        {/* Stats card */}
        <View style={styles.section}>
          <CardDark>
            <StatRow
              items={[
                { value: streak?.current_streak ?? 0, label: 'Day Streak', gold: true },
                { value: streak?.total_points ?? 0, label: 'Total Points' },
                { value: streak?.longest_streak ?? 0, label: 'Best Streak' },
              ]}
            />
          </CardDark>
        </View>

        {/* Badges card */}
        <View style={styles.section}>
          <CardLight>
            <Text style={styles.badgesTitle}>Badges</Text>
            <View style={styles.badgeGrid}>
              {badges.map((badge) => (
                <View
                  key={badge.id}
                  style={[styles.badgeItem, !badge.unlocked && styles.badgeLocked]}
                >
                  <Text style={styles.badgeIcon}>{badge.icon}</Text>
                  <Text style={styles.badgeLabel}>{badge.label}</Text>
                  {badge.unlocked && (
                    <Text style={styles.badgeCheck}>{'\u2713'}</Text>
                  )}
                </View>
              ))}
            </View>
          </CardLight>
        </View>

        {/* Upgrade */}
        {!isPro() && (
          <View style={styles.section}>
            <CardDark>
              <TouchableOpacity onPress={handleUpgrade} style={styles.upgradeInner}>
                <Text style={styles.upgradeTitle}>Upgrade to Pro</Text>
                <Text style={styles.upgradeSubtitle}>
                  Unlimited audits, all platforms, browser extension & more
                </Text>
              </TouchableOpacity>
            </CardDark>
          </View>
        )}

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: spacing.pagePad,
    marginBottom: spacing.sectionGap,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  settingsButton: {
    padding: 8,
    marginTop: 30,
    marginRight: spacing.pagePad,
  },
  settingsIcon: {
    fontSize: 24,
  },

  // User info
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.char,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typ.h2,
    color: colors.lt,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    ...typ.h3,
    color: colors.ink,
  },
  userEmail: {
    ...typ.bodySmall,
    color: colors.ink2,
    marginTop: 2,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cream3,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 8,
  },
  tierBadgePro: {
    backgroundColor: colors.gold,
  },
  tierText: {
    ...typ.label,
    color: colors.brown,
  },
  tierTextPro: {
    color: colors.char,
  },

  // Level card
  levelNumber: {
    ...typ.bigNum,
    color: colors.ink,
  },
  levelLabel: {
    ...typ.body,
    color: colors.ink2,
    marginTop: 2,
  },
  levelBar: {
    width: '100%',
    marginTop: 14,
  },
  levelCaption: {
    ...typ.caption,
    color: colors.ink3,
    marginTop: 8,
  },

  // Badges
  badgesTitle: {
    ...typ.label,
    color: colors.ink3,
    marginBottom: 12,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badgeItem: {
    width: '30%',
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: radius.card,
    padding: 12,
  },
  badgeLocked: {
    opacity: 0.3,
  },
  badgeIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  badgeLabel: {
    ...typ.caption,
    color: colors.ink3,
    textAlign: 'center',
  },
  badgeCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    ...typ.caption,
    color: colors.gold,
    fontWeight: '800',
  },

  // Upgrade
  upgradeInner: {
    alignItems: 'center',
  },
  upgradeTitle: {
    ...typ.h3,
    color: colors.lt,
  },
  upgradeSubtitle: {
    ...typ.body,
    color: colors.lt3,
    marginTop: 4,
    textAlign: 'center',
  },

  // Sign out
  signOutButton: {
    padding: 16,
    alignItems: 'center',
  },
  signOutText: {
    ...typ.btn,
    color: colors.red,
  },
});
