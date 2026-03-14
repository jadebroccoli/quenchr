import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { PLATFORMS } from '@quenchr/shared';
import type { Platform } from '@quenchr/shared';
import { supabase, addUserPlatform } from '@quenchr/supabase-client';
import { useAuthStore } from '../../src/stores/auth-store';

const AVAILABLE_PLATFORMS: { key: Platform; emoji: string }[] = [
  { key: 'instagram', emoji: '📸' },
  { key: 'tiktok', emoji: '🎵' },
  { key: 'twitter', emoji: '🐦' },
  { key: 'reddit', emoji: '🤖' },
  { key: 'youtube', emoji: '▶️' },
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

    // Add selected platforms
    for (const platform of selected) {
      await addUserPlatform(user.id, platform);
    }

    // Mark onboarding complete
    await supabase.from('users').update({ onboarding_complete: true }).eq('id', user.id);

    useAuthStore.getState().setUser({ ...user, onboarding_complete: true });
    setLoading(false);

    router.replace('/(tabs)/dashboard');
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Which platforms{'\n'}do you want to clean?</Text>
        <Text style={styles.subtitle}>
          We'll create a personalized cleanup plan for each one.
        </Text>
      </View>

      <View style={styles.grid}>
        {AVAILABLE_PLATFORMS.map(({ key, emoji }) => {
          const isSelected = selected.has(key);
          const info = PLATFORMS[key];
          return (
            <TouchableOpacity
              key={key}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => togglePlatform(key)}
              activeOpacity={0.7}
            >
              <Text style={styles.emoji}>{emoji}</Text>
              <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                {info.label}
              </Text>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
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
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 12,
  },
  grid: {
    gap: 12,
    flex: 1,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#1E1B4B',
  },
  emoji: {
    fontSize: 28,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#CBD5E1',
    flex: 1,
  },
  cardLabelSelected: {
    color: '#F8FAFC',
  },
  checkmark: {
    fontSize: 20,
    color: '#6366F1',
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 40,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
