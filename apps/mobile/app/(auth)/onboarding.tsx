import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { PLATFORMS } from '@quenchr/shared';
import type { Platform } from '@quenchr/shared';
import { supabase, addUserPlatform } from '@quenchr/supabase-client';
import { useAuthStore } from '../../src/stores/auth-store';
import { colors, type as typ, radius, spacing } from '../../src/tokens';

const AVAILABLE_PLATFORMS: { key: Platform; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'twitter', label: 'Twitter / X' },
  { key: 'reddit', label: 'Reddit' },
  { key: 'youtube', label: 'YouTube' },
];

export default function OnboardingScreen() {
  const [selected, setSelected] = useState<Set<Platform>>(new Set());
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);

  function togglePlatform(platform: Platform) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  }

  async function handleContinue() {
    if (selected.size === 0) {
      Alert.alert('Select a platform', 'Pick at least one platform to clean up.');
      return;
    }

    if (!user) return;

    setLoading(true);

    for (const platform of selected) {
      await addUserPlatform(user.id, platform);
    }

    await supabase.from('users').update({ onboarding_complete: true }).eq('id', user.id);

    useAuthStore.getState().setUser({ ...user, onboarding_complete: true });
    setLoading(false);

    router.replace('/(auth)/dependency-quiz');
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SETUP</Text>
        <Text style={styles.title}>Which platforms{'\n'}do you want to clean?</Text>
        <Text style={styles.subtitle}>
          We'll create a personalized cleanup plan for each one.
        </Text>
      </View>

      <View style={styles.grid}>
        {AVAILABLE_PLATFORMS.map(({ key, label }) => {
          const isSelected = selected.has(key);
          return (
            <TouchableOpacity
              key={key}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => togglePlatform(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                {label}
              </Text>
              {isSelected && <Text style={styles.checkmark}>{'\u2713'}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.button, selected.size === 0 && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={loading || selected.size === 0}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Setting up...' : `Let's Clean ${selected.size > 0 ? `(${selected.size})` : ''}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.pagePad,
    paddingTop: 80,
  },
  header: {
    marginBottom: 40,
  },
  eyebrow: {
    ...typ.eyebrow,
    color: colors.ink3,
    marginBottom: 8,
  },
  title: {
    ...typ.h1,
    color: colors.ink,
    lineHeight: 42,
  },
  subtitle: {
    ...typ.body,
    color: colors.ink3,
    marginTop: 12,
  },
  grid: {
    gap: 10,
    flex: 1,
  },
  card: {
    backgroundColor: colors.cream2,
    borderRadius: radius.card,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1.5,
    borderColor: colors.cream3,
  },
  cardSelected: {
    borderColor: colors.brown,
    backgroundColor: colors.brown + '10',
  },
  cardLabel: {
    ...typ.h3,
    color: colors.ink2,
    flex: 1,
  },
  cardLabelSelected: {
    color: colors.ink,
  },
  checkmark: {
    fontSize: 20,
    color: colors.brown,
    fontWeight: '700',
  },
  button: {
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    padding: 16,
    alignItems: 'center',
    marginBottom: 40,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    ...typ.btn,
    color: colors.lt,
  },
});
