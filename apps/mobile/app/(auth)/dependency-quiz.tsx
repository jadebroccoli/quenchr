import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, type as typ, radius, spacing } from '../../src/tokens';

// ── Constants ──

export const QUIZ_STORAGE_KEY = '@quenchr:dependencyQuiz';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Quiz Data ──

interface QuizQuestion {
  id: string;
  question: string;
  options: { label: string; weight: number }[];
}

const QUESTIONS: QuizQuestion[] = [
  {
    id: 'frequency',
    question: 'How often do you see suggestive content while scrolling?',
    options: [
      { label: 'Rarely', weight: 1 },
      { label: 'A few times a week', weight: 2 },
      { label: 'Daily', weight: 3 },
      { label: "It's basically my whole feed", weight: 4 },
    ],
  },
  {
    id: 'duration',
    question: 'How long have you been dealing with this?',
    options: [
      { label: 'Just noticed it', weight: 1 },
      { label: 'A few months', weight: 2 },
      { label: 'Over a year', weight: 3 },
      { label: 'It feels permanent', weight: 4 },
    ],
  },
  {
    id: 'impact',
    question: 'What bothers you most about it?',
    options: [
      { label: "It's affecting my focus", weight: 2 },
      { label: 'Relationship issues', weight: 3 },
      { label: "I just don't want it", weight: 1 },
      { label: 'All of the above', weight: 4 },
    ],
  },
  {
    id: 'history',
    question: 'Have you tried to clean up your feed before?',
    options: [
      { label: 'Never tried', weight: 1 },
      { label: 'Tried manually, gave up', weight: 2 },
      { label: 'Used another app', weight: 3 },
      { label: 'Yes, but it came back', weight: 4 },
    ],
  },
  {
    id: 'goal',
    question: "What's your main goal?",
    options: [
      { label: 'Clean feed, no drama', weight: 1 },
      { label: 'Better mental clarity', weight: 2 },
      { label: 'Improve a relationship', weight: 3 },
      { label: 'Full dopamine reset', weight: 4 },
    ],
  },
];

interface DependencyResult {
  label: string;
  color: string;
  description: string;
  advice: string;
}

function getDependencyResult(totalWeight: number): DependencyResult {
  if (totalWeight <= 7) {
    return {
      label: 'Low',
      color: colors.brown,
      description: "Your feed has some noise, but it hasn't taken over.",
      advice: 'A quick audit should sort you out. Run a scan to see exactly what you\'re working with.',
    };
  }
  if (totalWeight <= 12) {
    return {
      label: 'Moderate',
      color: colors.gold,
      description: "The algorithm has figured out what keeps you scrolling.",
      advice: "You're not alone. Most people hit this point after 6 months of scrolling. The cleanup tools will help reset the signal.",
    };
  }
  if (totalWeight <= 17) {
    return {
      label: 'High',
      color: '#E07B39',
      description: "Your feed is actively working against you.",
      advice: "The algorithm is good at its job. The AI scan will identify exactly which accounts are poisoning the well.",
    };
  }
  return {
    label: 'Heavy',
    color: colors.red,
    description: "Your feed has been optimized to keep you hooked.",
    advice: "This is fixable — but it takes more than unfollowing a few accounts. Let Quenchr map it out for you.",
  };
}

// ── Screen ──

export default function DependencyQuizScreen() {
  const [currentStep, setCurrentStep] = useState(0); // 0..4 = questions, 5 = result
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const totalWeight = answers.reduce((sum, w) => sum + w, 0);
  const result = getDependencyResult(totalWeight);
  const isResultScreen = currentStep === QUESTIONS.length;

  function animateTransition(onMidpoint: () => void) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 0, useNativeDriver: true }),
    ]).start(() => {
      onMidpoint();
      setSelectedIndex(null);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
      ]).start();
    });
  }

  function handleSelect(optionIndex: number, weight: number) {
    setSelectedIndex(optionIndex);
    setTimeout(() => {
      animateTransition(() => {
        setAnswers((prev) => [...prev, weight]);
        setCurrentStep((prev) => prev + 1);
      });
    }, 300);
  }

  async function handleEnterApp() {
    await AsyncStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify({ answers, totalWeight, completedAt: new Date().toISOString() }));
    router.replace('/(tabs)/dashboard');
  }

  const question = QUESTIONS[currentStep];
  const progress = currentStep / QUESTIONS.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <Animated.View
        style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        {!isResultScreen ? (
          <>
            <Text style={styles.stepLabel}>Question {currentStep + 1} of {QUESTIONS.length}</Text>
            <Text style={styles.question}>{question.question}</Text>

            <View style={styles.options}>
              {question.options.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.option, selectedIndex === i && styles.optionSelected]}
                  onPress={() => handleSelect(i, opt.weight)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionText, selectedIndex === i && styles.optionTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <ResultScreen result={result} onContinue={handleEnterApp} />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

// ── Result Screen ──

function ResultScreen({ result, onContinue }: { result: DependencyResult; onContinue: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 10, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.resultContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <Text style={styles.resultEyebrow}>Your dependency score</Text>
      <Text style={[styles.resultLabel, { color: result.color }]}>{result.label}</Text>
      <Text style={styles.resultDescription}>{result.description}</Text>

      <View style={[styles.resultAdviceCard, { borderLeftColor: result.color }]}>
        <Text style={styles.resultAdvice}>{result.advice}</Text>
      </View>

      <TouchableOpacity style={styles.ctaButton} onPress={onContinue} activeOpacity={0.85}>
        <Text style={styles.ctaText}>Let's fix it</Text>
      </TouchableOpacity>

      <Text style={styles.skipNote}>You can retake this quiz anytime from Settings.</Text>
    </Animated.View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.cream3,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brown,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.pagePad,
    paddingTop: 40,
  },
  stepLabel: {
    ...typ.label,
    color: colors.ink4,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  question: {
    ...typ.h2,
    color: colors.ink,
    marginBottom: 40,
    lineHeight: 36,
  },
  options: {
    gap: 12,
  },
  option: {
    borderWidth: 1.5,
    borderColor: colors.cream3,
    borderRadius: radius.card,
    padding: 18,
    backgroundColor: colors.lt,
  },
  optionSelected: {
    borderColor: colors.brown,
    backgroundColor: colors.brown + '15',
  },
  optionText: {
    ...typ.body,
    color: colors.ink2,
  },
  optionTextSelected: {
    color: colors.brown,
    fontWeight: '600',
  },
  // Result screen
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  resultEyebrow: {
    ...typ.label,
    color: colors.ink4,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 72,
    fontFamily: 'DMSerifDisplay_400Regular',
    lineHeight: 80,
    marginBottom: 16,
  },
  resultDescription: {
    ...typ.body,
    color: colors.ink2,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  resultAdviceCard: {
    borderLeftWidth: 3,
    paddingLeft: 16,
    paddingVertical: 8,
    marginBottom: 48,
    width: '100%',
  },
  resultAdvice: {
    ...typ.body,
    color: colors.ink3,
    lineHeight: 22,
  },
  ctaButton: {
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  ctaText: {
    ...typ.btn,
    color: colors.lt,
  },
  skipNote: {
    ...typ.caption,
    color: colors.ink4,
    textAlign: 'center',
  },
});
