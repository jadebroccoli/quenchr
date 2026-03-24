import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { evaluateBadges, getLevel } from '@quenchr/shared';
import { supabase } from '@quenchr/supabase-client';
import { useAuthStore } from '../../src/stores/auth-store';
import { useAuditStore } from '../../src/stores/audit-store';
import { useCleanupStore } from '../../src/stores/cleanup-store';
import { useSubscriptionStore } from '../../src/stores/subscription-store';

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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsButton}>
            <Text style={styles.settingsIcon}>{'\u2699\uFE0F'}</Text>
          </TouchableOpacity>
        </View>

        {/* User Info */}
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(user?.display_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.display_name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={[styles.tierBadge, isPro() && styles.tierBadgePro]}>
            <Text style={styles.tierText}>{tier.toUpperCase()}</Text>
          </View>
        </View>

        {/* Level */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Level</Text>
          <Text style={styles.levelNumber}>Level {level.level}</Text>
          <Text style={styles.levelLabel}>{level.label}</Text>
          <View style={styles.levelBarContainer}>
            <View style={[styles.levelBarFill, { width: `${level.progress * 100}%` }]} />
          </View>
          {level.nextLevelPoints !== null ? (
            <Text style={styles.levelProgress}>
              {level.currentPoints} / {level.nextLevelPoints} pts to next level
            </Text>
          ) : (
            <Text style={styles.levelProgress}>Max level reached!</Text>
          )}
        </View>

        {/* Stats */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{streak?.current_streak ?? 0}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{streak?.total_points ?? 0}</Text>
              <Text style={styles.statLabel}>Total Points</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{streak?.longest_streak ?? 0}</Text>
              <Text style={styles.statLabel}>Best Streak</Text>
            </View>
          </View>
        </View>

        {/* Badges */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Badges</Text>
          <View style={styles.badgeGrid}>
            {badges.map((badge) => (
              <View
                key={badge.id}
                style={[
                  styles.badgeItem,
                  !badge.unlocked && styles.badgeLocked,
                ]}
              >
                <Text style={styles.badgeIcon}>{badge.icon}</Text>
                <Text style={styles.badgeLabel}>{badge.label}</Text>
                {badge.unlocked && (
                  <Text style={styles.badgeUnlockedCheck}>✓</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Upgrade */}
        {!isPro() && (
          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
            <Text style={styles.upgradeTitle}>Upgrade to Pro</Text>
            <Text style={styles.upgradeSubtitle}>
              Unlimited audits, all platforms, browser extension & more
            </Text>
          </TouchableOpacity>
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
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 24,
    gap: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsButton: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 24,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  userEmail: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  tierBadge: {
    backgroundColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 12,
  },
  tierBadgePro: {
    backgroundColor: '#6366F1',
  },
  tierText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },

  // Level
  levelNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: '#6366F1',
  },
  levelLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  levelBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 16,
  },
  levelBarFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  levelProgress: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  statItem: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#6366F1',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },

  // Badges
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
  },
  badgeItem: {
    width: '30%',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
  },
  badgeLocked: {
    opacity: 0.4,
  },
  badgeIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  badgeLabel: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
  },
  badgeUnlockedCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '800',
  },

  // Upgrade
  upgradeButton: {
    backgroundColor: '#6366F1',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  upgradeSubtitle: {
    fontSize: 13,
    color: '#C7D2FE',
    marginTop: 4,
    textAlign: 'center',
  },
  signOutButton: {
    padding: 16,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});
