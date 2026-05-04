import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../src/stores/auth-store';
import { colors } from '../src/tokens';
import { QUIZ_STORAGE_KEY } from './(auth)/dependency-quiz';

const INTRO_STORAGE_KEY = '@quenchr:hasSeenIntro';

export default function Index() {
  const { user, loading } = useAuthStore();
  const [hasSeenIntro, setHasSeenIntro] = useState<boolean | null>(null);
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(INTRO_STORAGE_KEY),
      AsyncStorage.getItem(QUIZ_STORAGE_KEY),
    ]).then(([intro, quiz]) => {
      setHasSeenIntro(intro === 'true');
      setHasCompletedQuiz(quiz !== null);
    });
  }, []);

  if (loading || hasSeenIntro === null || hasCompletedQuiz === null) {
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

  if (!hasCompletedQuiz) {
    return <Redirect href="/(auth)/dependency-quiz" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}
