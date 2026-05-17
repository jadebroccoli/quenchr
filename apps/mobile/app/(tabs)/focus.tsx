import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Switch,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PLATFORMS, POINTS, computeStreakUpdate } from '@quenchr/shared';
import type { Challenge, UserChallenge } from '@quenchr/shared';
import { updateChallengeProgress, updateStreak } from '@quenchr/supabase-client';
import { useAuthStore } from '../../src/stores/auth-store';
import { useAuditStore } from '../../src/stores/audit-store';
import { useCleanupStore } from '../../src/stores/cleanup-store';
import { useSubscriptionStore } from '../../src/stores/subscription-store';
import { useFocusStore } from '../../src/stores/focus-store';
import { useSettingsStore } from '../../src/stores/settings-store';
import { useMindfulStore } from '../../src/stores/mindful-store';
import { useChallengesInit } from '../../src/hooks/useChallengesInit';
import { computeCleanStreak } from '../../src/utils/scanStreak';
import { OasisVisual } from '../../src/components/ui/OasisVisual';
import { PanicOverlay } from '../../src/components/PanicOverlay';
import {
  PageHeader,
  SectionDivider,
  CardDark,
  StatRow,
  PrimaryButton,
  SecondaryButton,
  ProgressBar,
} from '../../src/components/ui';
import { colors, type as typ, spacing, radius } from '../../src/tokens';

type ChallengeWithTemplate = UserChallenge & { challenge: Challenge };

export default function FocusScreen() {
  const router = useRouter();
  const [panicVisible, setPanicVisible] = useState(false);
  const [oasisInfoVisible, setOasisInfoVisible] = useState(false);
  const [shortcutGuideVisible, setShortcutGuideVisible] = useState(false);

  const { frameRetentionConsent, setFrameRetentionConsent } = useSettingsStore();
  const { personalMessage, weeklyStats, setPersonalMessage } = useMindfulStore();
  const [messageInput, setMessageInput] = useState(personalMessage);

  function handleSaveMessage() {
    setPersonalMessage(messageInput.trim());
    Alert.alert('Saved', 'Your message will appear on the Mindful Moment screen.');
  }

  // Auth
  const user = useAuthStore((s) => s.user);

  // Audit / oasis
  const currentAudit = useAuditStore((s) => s.currentAudit);
  const auditHistory = useAuditStore((s) => s.auditHistory);
  const cleanStreak = useMemo(() => computeCleanStreak(auditHistory), [auditHistory]);

  // Focus sessions
  const activeSession = useFocusStore((s) => s.activeSession);
  const sessionsCompleted = useFocusStore((s) => s.sessionsCompleted);

  // Cleanup / challenges / streak
  const challenges = useCleanupStore((s) => s.challenges);
  const setChallenges = useCleanupStore((s) => s.setChallenges);
  const streak = useCleanupStore((s) => s.streak);
  const setStreak = useCleanupStore((s) => s.setStreak);
  const isPro = useSubscriptionStore((s) => s.proAccess);
  const { loading, error, refetch } = useChallengesInit();

  const completedCount = challenges.filter((c) => c.completed).length;
  const allDone = challenges.length > 0 && completedCount === challenges.length;

  // ── Challenge handlers ──

  async function handleProgress(uc: ChallengeWithTemplate) {
    if (uc.completed || !user) return;

    if (uc.challenge.is_premium && !isPro) {
      router.push('/paywall');
      return;
    }

    const newProgress = Math.min(uc.progress + 1, uc.challenge.target_count);
    const isNowComplete = newProgress >= uc.challenge.target_count;

    const { error: progErr } = await updateChallengeProgress(uc.id, newProgress, isNowComplete);
    if (progErr) {
      Alert.alert('Error', 'Could not save progress. Check your connection.');
      return;
    }

    if (isNowComplete) {
      const streakData = computeStreakUpdate(streak, POINTS.challengeComplete);
      const { error: streakErr } = await updateStreak(user.id, streakData);
      if (!streakErr) {
        setStreak(
          streak
            ? { ...streak, ...streakData }
            : { id: Date.now().toString(), user_id: user.id, ...streakData },
        );
      }
      Alert.alert('Challenge Complete!', `+${POINTS.challengeComplete} points earned!`);
    }

    setChallenges(
      challenges.map((c) =>
        c.id === uc.id
          ? {
              ...c,
              progress: newProgress,
              completed: isNowComplete,
              completed_at: isNowComplete ? new Date().toISOString() : null,
            }
          : c,
      ),
    );
  }

  // ── Not authenticated ──
  if (!user && !loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centeredState}>
          <Text style={styles.centeredTitle}>Sign in to use Focus</Text>
          <Text style={styles.centeredSub}>
            Track your oasis, run focus sessions, and complete daily challenges.
          </Text>
          <PrimaryButton label="Sign In" onPress={() => router.push('/(auth)/login')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow="Focus"
          title="Take back your attention."
          subtitle="Your oasis grows every time you resist."
        />
        <SectionDivider />

        <View style={styles.body}>
          {/* ── Oasis + Streak ── */}
          <CardDark>
            <View style={styles.oasisHeader}>
              <Text style={styles.eyebrowDark}>YOUR OASIS</Text>
              <TouchableOpacity
                onPress={() => setOasisInfoVisible(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={styles.infoBtn}>
                  <Text style={styles.infoBtnText}>?</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.oasisWrapper}>
              <OasisVisual feedScore={currentAudit?.feed_score ?? null} />
            </View>

            {/* Clean Streak */}
            <View style={styles.cleanStreakRow}>
              <View style={styles.cleanStreakMain}>
                <Text style={styles.cleanStreakNum}>{cleanStreak.current}</Text>
                <View>
                  <Text style={styles.cleanStreakLabel}>CLEAN WEEKS</Text>
                  <Text style={styles.cleanStreakSub}>
                    Best: {cleanStreak.longest} week{cleanStreak.longest !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              {cleanStreak.current > 0 && <Text style={styles.fireEmoji}>🔥</Text>}
            </View>

            <StatRow
              items={[
                { value: streak?.current_streak ?? 0, label: 'Task Streak' },
                { value: streak?.longest_streak ?? 0, label: 'Best' },
                { value: streak?.total_points ?? 0, label: 'Points', gold: true },
              ]}
            />
          </CardDark>

          {/* ── Focus Session ── */}
          <CardDark>
            <Text style={styles.eyebrowDark}>FOCUS SESSION</Text>
            {activeSession ? (
              <>
                <Text style={styles.focusActiveHeadline}>Session in progress</Text>
                <Text style={styles.focusSub}>
                  {activeSession.durationMinutes}-min session running — stay strong.
                </Text>
                <TouchableOpacity
                  style={styles.focusBtn}
                  onPress={() => router.push('/focus-session')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.focusBtnText}>View Session →</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.focusHeadline}>Go scroll-free.</Text>
                <Text style={styles.focusSub}>
                  Lock in for 15, 30, 60, or 90 minutes.{'\n'}
                  Your Oasis grows with every session.
                  {sessionsCompleted > 0 && `  · ${sessionsCompleted} completed`}
                </Text>
                <TouchableOpacity
                  style={styles.focusBtn}
                  onPress={() => router.push('/focus-session')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.focusBtnText}>Start Focus Session</Text>
                </TouchableOpacity>
              </>
            )}
          </CardDark>

          {/* ── Panic Button ── */}
          <CardDark>
            <Text style={styles.panicHeadline}>Caught mid-scroll?</Text>
            <Text style={styles.panicSub}>Tap to pause and reset.</Text>
            <TouchableOpacity
              style={styles.panicBtn}
              onPress={() => setPanicVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.panicBtnText}>Stop Scrolling</Text>
            </TouchableOpacity>
          </CardDark>

          {/* ── Challenges ── */}
          <View style={styles.challengesSection}>
            <Text style={styles.challengesHeader}>DAILY CHALLENGES</Text>
            {loading ? (
              <View style={styles.centeredMini}>
                <ActivityIndicator size="small" color={colors.brown} />
                <Text style={styles.centeredMiniText}>Loading challenges...</Text>
              </View>
            ) : error ? (
              <View style={styles.centeredMini}>
                <Text style={[styles.centeredMiniText, { color: colors.red }]}>
                  Couldn't load challenges
                </Text>
                <SecondaryButton label="Try Again" onPress={refetch} style={{ marginTop: 8 }} />
              </View>
            ) : (
              <>
                {allDone && (
                  <CardDark style={styles.allDoneCard}>
                    <Text style={styles.allDoneText}>
                      All done! Come back tomorrow for new ones.
                    </Text>
                  </CardDark>
                )}

                {challenges.length === 0 && (
                  <View style={styles.centeredMini}>
                    <Text style={styles.centeredMiniText}>
                      Improve your feed score to unlock challenges.
                    </Text>
                  </View>
                )}

                {challenges.map((uc) => {
                  const challenge = uc.challenge;
                  if (!challenge) return null;
                  const isComplete = uc.completed;
                  const progressPct = uc.progress / challenge.target_count;

                  return (
                    <CardDark
                      key={uc.id}
                      style={isComplete ? styles.cardComplete : undefined}
                    >
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.challengeTitle}>
                          {isComplete ? '✓ ' : ''}
                          {challenge.title}
                        </Text>
                        {challenge.is_premium && (
                          <View style={styles.proBadge}>
                            <Text style={styles.proText}>PRO</Text>
                          </View>
                        )}
                      </View>

                      {challenge.platform && (
                        <Text style={styles.platformTag}>
                          {PLATFORMS[challenge.platform as keyof typeof PLATFORMS]?.label}
                        </Text>
                      )}

                      <View style={styles.pointsBadge}>
                        <Text style={styles.pointsText}>+{challenge.points} pts</Text>
                      </View>

                      <Text style={styles.challengeDesc}>{challenge.description}</Text>

                      <ProgressBar
                        progress={progressPct}
                        variant="dark"
                        style={{ marginTop: 4 }}
                      />
                      <Text style={styles.progressCount}>
                        {uc.progress}/{challenge.target_count}
                      </Text>

                      {!isComplete && (
                        <SecondaryButton
                          label="I did this! (+1)"
                          onPress={() => handleProgress(uc as ChallengeWithTemplate)}
                          style={{ marginTop: 4 }}
                        />
                      )}
                    </CardDark>
                  );
                })}
              </>
            )}
          </View>
          {/* ── Friction Pause ── */}
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

          {/* ── Mindful Moment message ── */}
          <CardDark>
            <Text style={styles.fpHeadline}>Your pause message</Text>
            <Text style={styles.fpBody}>
              Appears when you try to open Instagram or TikTok. Leave blank for a smart default based on your feed score.
            </Text>
            <TextInput
              style={styles.messageInput}
              value={messageInput}
              onChangeText={setMessageInput}
              placeholder="e.g. I'm doing this for my relationship."
              placeholderTextColor={colors.lt4}
              multiline
              maxLength={120}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveMessage} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Save message</Text>
            </TouchableOpacity>
          </CardDark>

          {/* ── Privacy ── */}
          <Text style={styles.sectionLabel}>PRIVACY</Text>
          <CardDark>
            <Text style={styles.privacyNote}>
              All scan data stays on your device. Only anonymized scores are synced to your account.
            </Text>
          </CardDark>

          {/* ── Data & AI Training ── */}
          <Text style={styles.sectionLabel}>DATA & AI TRAINING</Text>
          <CardDark>
            <View style={styles.consentRow}>
              <View style={styles.consentInfo}>
                <Text style={styles.consentLabel}>Share flagged frames</Text>
                <Text style={styles.consentDesc}>
                  After each scan, up to 5 flagged images are anonymously uploaded to help train Quenchr's on-device AI. Frame pixels only — no usernames or identifying data.
                </Text>
              </View>
              <Switch
                value={frameRetentionConsent}
                onValueChange={(enabled) => {
                  if (enabled) {
                    Alert.alert(
                      'Help train Quenchr AI',
                      'Up to 5 flagged frames from each scan are anonymously stored to improve our on-device content classifier. Frame pixels only — no usernames, profile info, or identifying data.\n\nYou can turn this off any time.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Enable', onPress: () => setFrameRetentionConsent(true) },
                      ],
                    );
                  } else {
                    setFrameRetentionConsent(false);
                  }
                }}
                trackColor={{ false: colors.char3, true: colors.brown }}
                thumbColor={colors.lt}
              />
            </View>
            {frameRetentionConsent && (
              <View style={styles.consentActiveBadge}>
                <Text style={styles.consentActiveBadgeText}>CONTRIBUTING TO AI TRAINING</Text>
              </View>
            )}
          </CardDark>

        </View>
      </ScrollView>

      <PanicOverlay visible={panicVisible} onDismiss={() => setPanicVisible(false)} />

      {/* Oasis info modal */}
      <Modal
        visible={oasisInfoVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOasisInfoVisible(false)}
      >
        <TouchableOpacity
          style={styles.infoOverlay}
          activeOpacity={1}
          onPress={() => setOasisInfoVisible(false)}
        >
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Your Oasis</Text>
            <Text style={styles.infoBody}>
              Your Oasis reflects your feed health. The cleaner your score, the more it
              flourishes — from barren wasteland to thriving oasis. Scan regularly to watch it
              grow.
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>

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
                { n: '10', text: "Tap Done. That's it." },
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
  body: {
    paddingHorizontal: spacing.pagePad,
    gap: spacing.cardGap,
  },

  // Centered states
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.pagePad,
    gap: 12,
  },
  centeredTitle: {
    ...typ.h3,
    color: colors.ink,
    textAlign: 'center',
  },
  centeredSub: {
    ...typ.body,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: 4,
  },
  centeredMini: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  centeredMiniText: {
    ...typ.body,
    color: colors.ink3,
    textAlign: 'center',
  },

  // Section labels
  eyebrowDark: {
    ...typ.label,
    color: colors.lt3,
  },

  // Oasis card
  oasisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infoBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.lt3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnText: {
    fontSize: 10,
    color: colors.lt3,
    fontWeight: '700',
    lineHeight: 13,
  },
  oasisWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  cleanStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.char4,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  cleanStreakMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cleanStreakNum: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 48,
    lineHeight: 52,
    color: colors.gold,
  },
  cleanStreakLabel: {
    ...typ.label,
    color: colors.lt2,
    fontSize: 11,
  },
  cleanStreakSub: {
    ...typ.caption,
    color: colors.lt3,
    marginTop: 2,
  },
  fireEmoji: {
    fontSize: 28,
  },

  // Focus session card
  focusHeadline: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
    color: colors.lt,
    marginBottom: 6,
    marginTop: 8,
  },
  focusActiveHeadline: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
    color: colors.gold,
    marginBottom: 6,
    marginTop: 8,
  },
  focusSub: {
    ...typ.body,
    color: colors.lt3,
    marginBottom: 20,
    lineHeight: 22,
  },
  focusBtn: {
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    paddingVertical: 14,
    alignItems: 'center',
  },
  focusBtnText: {
    ...typ.btn,
    color: colors.lt,
  },

  // Panic card
  panicHeadline: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
    color: colors.lt,
    marginBottom: 6,
  },
  panicSub: {
    ...typ.body,
    color: colors.lt3,
    marginBottom: 20,
  },
  panicBtn: {
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    paddingVertical: 14,
    alignItems: 'center',
  },
  panicBtnText: {
    ...typ.btn,
    color: colors.lt,
  },

  // Challenges section
  challengesSection: {
    gap: spacing.cardGap,
  },
  challengesHeader: {
    ...typ.label,
    color: colors.ink3,
    paddingTop: 4,
  },
  allDoneCard: {
    borderWidth: 1,
    borderColor: colors.gold,
  },
  allDoneText: {
    ...typ.body,
    color: colors.lt2,
    textAlign: 'center',
  },
  cardComplete: {
    borderWidth: 1,
    borderColor: colors.gold,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  challengeTitle: {
    ...typ.h3,
    color: colors.lt,
    flex: 1,
  },
  proBadge: {
    backgroundColor: colors.gold,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proText: {
    ...typ.label,
    color: colors.char,
  },
  platformTag: {
    ...typ.label,
    color: colors.lt4 ?? colors.lt3,
    marginTop: 4,
  },
  pointsBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gold + '20',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  pointsText: {
    ...typ.caption,
    color: colors.gold,
  },
  challengeDesc: {
    ...typ.body,
    color: colors.lt3,
    marginTop: 8,
  },
  progressCount: {
    ...typ.caption,
    color: colors.lt4 ?? colors.lt3,
    marginTop: 6,
  },

  // Section label (light, for use on cream background)
  sectionLabel: {
    ...typ.label,
    color: colors.ink3,
    paddingTop: 4,
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

  // Mindful message
  messageInput: {
    ...typ.body,
    color: colors.lt,
    borderWidth: 1,
    borderColor: colors.char3,
    borderRadius: radius.card,
    padding: 12,
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

  // Privacy
  privacyNote: {
    ...typ.body,
    color: colors.lt3,
    lineHeight: 22,
  },

  // AI Training consent
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  consentInfo: {
    flex: 1,
  },
  consentLabel: {
    ...typ.btn,
    color: colors.lt,
  },
  consentDesc: {
    ...typ.bodySmall,
    color: colors.lt3,
    marginTop: 4,
    lineHeight: 18,
  },
  consentActiveBadge: {
    marginTop: 12,
    backgroundColor: colors.brown + '25',
    borderRadius: radius.badge,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  consentActiveBadgeText: {
    ...typ.label,
    color: colors.brown,
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

  // Oasis info modal
  infoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  infoCard: {
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    padding: 24,
    width: '100%',
  },
  infoTitle: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
    color: colors.lt,
    marginBottom: 12,
  },
  infoBody: {
    ...typ.body,
    color: colors.lt3,
    lineHeight: 22,
  },
});
