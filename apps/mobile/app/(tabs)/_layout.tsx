import { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform, Modal, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, type as typ, spacing, radius } from '../../src/tokens';
import { useSettingsStore } from '../../src/stores/settings-store';
import { useAuthStore } from '../../src/stores/auth-store';

// Minimal stroke icons matching the design spec (18x18)
function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <Path d="M9 22V12h6v10" />
    </Svg>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 19a8 8 0 100-16 8 8 0 000 16z" />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  );
}

function BroomIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2L12 10" />
      <Path d="M8 10c0 0-4 4-4 10h16c0-6-4-10-4-10H8z" />
    </Svg>
  );
}

function FocusIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22V12" />
      <Path d="M12 12C10 9 7 7 4 7c0 3 2 6 5 7" />
      <Path d="M12 12C14 9 17 7 20 7c0 3-2 6-5 7" />
    </Svg>
  );
}

function UserIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <Path d="M12 11a4 4 0 100-8 4 4 0 000 8z" />
    </Svg>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 32 : 0);

  const user = useAuthStore((s) => s.user);
  const { frameRetentionAsked, setFrameRetentionAsked, setFrameRetentionConsent } = useSettingsStore();

  // Show the popup once per user lifetime — only after auth resolves and settings load
  const [consentVisible, setConsentVisible] = useState(false);

  useEffect(() => {
    if (user && !frameRetentionAsked) {
      // Small delay so the tab UI has settled before the popup appears
      const timer = setTimeout(() => setConsentVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [user, frameRetentionAsked]);

  function handleConsent(accepted: boolean) {
    setFrameRetentionConsent(accepted);
    setFrameRetentionAsked(true);
    setConsentVisible(false);
  }

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.char,
            borderTopWidth: 0,
            paddingTop: 10,
            paddingBottom: bottomPadding,
            height: 62 + bottomPadding,
            elevation: 0,
          },
          tabBarActiveTintColor: colors.lt,
          tabBarInactiveTintColor: colors.lt4,
          tabBarLabelStyle: {
            ...typ.navLabel,
            marginTop: 4,
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <HomeIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="audit"
          options={{
            title: 'Audit',
            tabBarIcon: ({ color }) => <SearchIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="cleanup"
          options={{
            title: 'Cleanup',
            tabBarIcon: ({ color }) => <BroomIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="focus"
          options={{
            title: 'Focus',
            tabBarIcon: ({ color }) => <FocusIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Me',
            tabBarIcon: ({ color }) => <UserIcon color={color} />,
          }}
        />
        {/* Challenges content moved to Focus tab — keep route alive but hide from tab bar */}
        <Tabs.Screen name="challenges" options={{ href: null }} />
      </Tabs>

      {/* One-time AI training consent popup */}
      <Modal
        visible={consentVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => handleConsent(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.iconRow}>
              <Text style={styles.icon}>🧠</Text>
            </View>
            <Text style={styles.title}>Help build Quenchr AI</Text>
            <Text style={styles.body}>
              After each scan, we can anonymously save up to 5 flagged frames to train our own on-device content model — cutting out third-party AI entirely.
            </Text>
            <Text style={styles.body}>
              Frame pixels only. No usernames, profile photos, or identifying data — ever.
            </Text>
            <Text style={styles.finePrint}>
              You can change this any time in Focus → Data & AI Training.
            </Text>

            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => handleConsent(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.acceptBtnText}>Yes, I'm in</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => handleConsent(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.declineBtnText}>No thanks</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.pagePad,
  },
  sheet: {
    backgroundColor: colors.char,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 380,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 26,
    color: colors.lt,
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    ...typ.body,
    color: colors.lt3,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
  },
  finePrint: {
    ...typ.caption,
    color: colors.lt4,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
    lineHeight: 18,
  },
  acceptBtn: {
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  acceptBtnText: {
    ...typ.btn,
    color: colors.lt,
  },
  declineBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  declineBtnText: {
    ...typ.body,
    color: colors.lt4,
  },
});
