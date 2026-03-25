import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../src/stores/auth-store';
import { colors } from '../src/tokens';

const INTRO_STORAGE_KEY = '@quenchr:hasSeenIntro';

export default function Index() {
  const { user, loading } = useAuthStore();
  const [hasSeenIntro, setHasSeenIntro] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(INTRO_STORAGE_KEY).then((value) => {
      setHasSeenIntro(value === 'true');
    });
  }, []);

  if (loading || hasSeenIntro === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream }}>
        <ActivityIndicator size="large" color={colors.brown} />
      </View>
    );
  }

  if (!user) {
    if (!hasSeenIntro) {
      return <Redirect href="/(auth)/intro" />;
    }
    return <Redirect href="/(auth)/login" />;
  }

  if (!user.onboarding_complete) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}
