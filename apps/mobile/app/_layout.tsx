import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';

// Ensure foreground notifications appear as banners
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// RevenueCat requires native module — guard for dev builds without it
let Purchases: any = null;
try {
  Purchases = require('react-native-purchases').default;
} catch {
  console.warn('[layout] react-native-purchases not available in this build');
}
import {
  DMSerifDisplay_400Regular,
} from '@expo-google-fonts/dm-serif-display';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { useAuthStore } from '../src/stores/auth-store';
import { useSubscriptionStore } from '../src/stores/subscription-store';
import { useSettingsStore } from '../src/stores/settings-store';
import { useMindfulStore } from '../src/stores/mindful-store';
import { useFocusStore } from '../src/stores/focus-store';
import { supabase } from '@quenchr/supabase-client';
import { colors } from '../src/tokens';

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setTier = useSubscriptionStore((s) => s.setTier);
  const loadTrialState = useSubscriptionStore((s) => s.loadTrialState);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadMindful = useMindfulStore((s) => s.loadMindful);
  const loadFocus = useFocusStore((s) => s.loadFocus);

  const [fontsLoaded] = useFonts({
    DMSerifDisplay_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  // Initialize RevenueCat (only if native module is available)
  useEffect(() => {
    if (!Purchases) return;

    const rcApiKey = Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_RC_IOS_API_KEY ?? ''
      : process.env.EXPO_PUBLIC_RC_ANDROID_API_KEY ?? '';

    if (rcApiKey) {
      Purchases.configure({ apiKey: rcApiKey });
    }
  }, []);

  useEffect(() => {
    // We rely solely on onAuthStateChange for session hydration.
    // INITIAL_SESSION fires once AsyncStorage has fully resolved — only then
    // do we mark loading=false so the app is never interactive with an empty
    // auth store (the root cause of "Session expired" on first scan).
    let initialSessionHandled = false;

    // Safety valve: if INITIAL_SESSION never fires (edge case), unblock after 5s
    const timeout = setTimeout(() => {
      if (!initialSessionHandled) {
        console.warn('[layout] INITIAL_SESSION timeout — unblocking app');
        setLoading(false);
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Update session/user FIRST, then flip loading off. Guarantees no subscriber
      // can observe { loading: false, session: null } during INITIAL_SESSION with
      // a valid session (React 18 batches these anyway, but explicit > implicit).
      if (session) {
        setSession({ access_token: session.access_token });
        loadUser(session.user.id);
      } else {
        setSession(null);
        setUser(null);
      }

      if (event === 'INITIAL_SESSION') {
        initialSessionHandled = true;
        clearTimeout(timeout);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function loadUser(userId: string) {
    loadSettings();
    loadMindful();
    loadFocus();
    loadTrialState();
    const { data } = await supabase.from('users').select('*').eq('id', userId).single();
    if (data) {
      setUser(data as any);
      // Sync subscription tier from DB — DB is source of truth for pro/free,
      // but trial state is managed locally (AsyncStorage) so only override if not already in trial
      if (data.subscription_tier === 'pro') {
        setTier('pro');
      } else if (data.subscription_tier === 'free' && useSubscriptionStore.getState().tier !== 'trial') {
        setTier('free');
      }
    }
  }

  // Block rendering until BOTH fonts AND auth session are ready.
  // This ensures useAuthStore always has the token before any screen mounts.
  const authLoading = useAuthStore((s) => s.loading);
  if (!fontsLoaded || authLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brown} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.cream },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="paywall"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            contentStyle: { backgroundColor: colors.char },
          }}
        />
        <Stack.Screen
          name="mindful"
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
            contentStyle: { backgroundColor: colors.char },
          }}
        />
        <Stack.Screen
          name="focus-session"
          options={{
            animation: 'slide_from_bottom',
            contentStyle: { backgroundColor: colors.cream },
          }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
