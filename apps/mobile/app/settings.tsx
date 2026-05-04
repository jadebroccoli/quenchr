import { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, TextInput, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSubscriptionStore } from '../src/stores/subscription-store';
import { useSettingsStore } from '../src/stores/settings-store';
import { useMindfulStore } from '../src/stores/mindful-store';
import { colors, type as typ, spacing, radius } from '../src/tokens';
import { CardLight, CardDark, SectionDivider } from '../src/components/ui';

export default function SettingsScreen() {
  const { tier } = useSubscriptionStore();
  const { devMode, setDevMode } = useSettingsStore();
  const { personalMessage, weeklyStats, setPersonalMessage } = useMindfulStore();

  const [messageInput, setMessageInput] = useState(personalMessage);
  const [shortcutGuideVisible, setShortcutGuideVisible] = useState(false);

  function handleSaveMessage() {
    setPersonalMessage(messageInput.trim());
    Alert.alert('Saved', 'Your message will appear on the Mindful Moment screen.');
  }

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

          {/* Friction Pause */}
          <Text style={styles.sectionLabel}>FRICTION PAUSE</Text>
          <CardDark>
            <Text style={styles.fpHeadline}>Intercept social media opens</Text>
            <Text style={styles.fpBody}>
              Create an iOS Shortcut that opens Quenchr before Instagram or TikTok — a breathing pause with your feed score and a personal message before you scroll.
            </Text>
            <TouchableOpacity
              style={styles.fpGuideBtn}
              onPress={() => setShortcutGuideVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.fpGuideBtnText}>How to set up iOS Shortcut →</Text>
            </TouchableOpacity>

            {/* Weekly pause stats */}
            <View style={styles.fpStatsRow}>
              <View style={styles.fpStat}>
                <Text style={styles.fpStatNum}>{weeklyStats.respected}</Text>
                <Text style={styles.fpStatLabel}>PAUSES{'\n'}RESPECTED</Text>
              </View>
              <View style={styles.fpStatDivider} />
              <View style={styles.fpStat}>
                <Text style={[styles.fpStatNum, { color: colors.lt4 }]}>{weeklyStats.overridden}</Text>
                <Text style={styles.fpStatLabel}>OPENED{'\n'}ANYWAY</Text>
              </View>
            </View>
          </CardDark>

          {/* Personal Message */}
          <CardLight>
            <Text style={styles.settingLabel}>Your Mindful Moment message</Text>
            <Text style={styles.settingDesc}>
              This appears on the pause screen when you try to open Instagram or TikTok. Leave blank for a smart default based on your feed score.
            </Text>
            <TextInput
              style={styles.messageInput}
              value={messageInput}
              onChangeText={setMessageInput}
              placeholder="e.g. I'm doing this for my relationship."
              placeholderTextColor={colors.ink4}
              multiline
              maxLength={120}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveMessage} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Save message</Text>
            </TouchableOpacity>
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

      {/* iOS Shortcut setup guide modal */}
      <Modal
        visible={shortcutGuideVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShortcutGuideVisible(false)}
      >
        <View style={styles.guideOverlay}>
          <View style={styles.guideSheet}>
            <View style={styles.guideHeader}>
              <Text style={styles.guideTitle}>iOS Shortcut Setup</Text>
              <TouchableOpacity onPress={() => setShortcutGuideVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.guideClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.guideSub}>
                This takes about 2 minutes. Once set up, every time you open Instagram or TikTok, Quenchr intercepts for a 5-second breathing pause.
              </Text>

              {[
                { n: '1', text: 'Open the Shortcuts app on your iPhone.' },
                { n: '2', text: 'Tap Automation at the bottom of the screen.' },
                { n: '3', text: 'Tap the + button (top right) → New Automation.' },
                { n: '4', text: 'Scroll down and tap App → choose Instagram (or TikTok).' },
                { n: '5', text: 'Make sure "Is Opened" is selected. Tap Next.' },
                { n: '6', text: 'Tap New Blank Automation → + Add Action.' },
                { n: '7', text: 'Search for "Open URLs" and add the action.' },
                { n: '8', text: `Set the URL to:\nquenchr://mindful?platform=instagram\n(use "tiktok" for TikTok)` },
                { n: '9', text: 'Turn OFF "Ask Before Running" so it fires automatically.' },
                { n: '10', text: 'Tap Done. That\'s it.' },
              ].map((step) => (
                <View key={step.n} style={styles.guideStep}>
                  <View style={styles.guideStepNum}>
                    <Text style={styles.guideStepNumText}>{step.n}</Text>
                  </View>
                  <Text style={styles.guideStepText}>{step.text}</Text>
                </View>
              ))}

              <View style={styles.guideNote}>
                <Text style={styles.guideNoteText}>
                  💡 iOS will show "Automation ran" in your notification centre. This is normal — you can mute it by long-pressing the notification.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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

  // Friction Pause card
  fpHeadline: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 20,
    color: colors.lt,
    marginBottom: 8,
  },
  fpBody: {
    ...typ.body,
    color: colors.lt3,
    lineHeight: 22,
    marginBottom: 16,
  },
  fpGuideBtn: {
    borderWidth: 1,
    borderColor: colors.lt4,
    borderRadius: radius.btn,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  fpGuideBtnText: {
    ...typ.btn,
    color: colors.lt2,
  },
  fpStatsRow: {
    flexDirection: 'row',
    backgroundColor: colors.char4,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  fpStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  fpStatDivider: {
    width: 1,
    backgroundColor: colors.char3,
    marginVertical: 10,
  },
  fpStatNum: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 32,
    color: colors.gold,
    lineHeight: 36,
  },
  fpStatLabel: {
    ...typ.label,
    color: colors.lt4,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 13,
  },

  // Personal message input
  messageInput: {
    ...typ.body,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.cream3,
    borderRadius: radius.card,
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    ...typ.btn,
    color: colors.lt,
  },

  // Shortcut guide modal
  guideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  guideSheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.pagePad,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  guideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  guideTitle: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
    color: colors.ink,
  },
  guideClose: {
    ...typ.btn,
    color: colors.ink3,
    fontSize: 16,
  },
  guideSub: {
    ...typ.body,
    color: colors.ink2,
    marginBottom: 20,
    lineHeight: 22,
  },
  guideStep: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  guideStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brown,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  guideStepNumText: {
    ...typ.label,
    color: colors.lt,
    fontSize: 11,
  },
  guideStepText: {
    ...typ.body,
    color: colors.ink,
    flex: 1,
    lineHeight: 22,
  },
  guideNote: {
    backgroundColor: colors.cream2,
    borderRadius: radius.card,
    padding: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  guideNoteText: {
    ...typ.body,
    color: colors.ink3,
    lineHeight: 22,
  },
});
