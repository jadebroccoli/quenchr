import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, type as typ, spacing } from '../../src/tokens';
import { QuenchrLogo, PrimaryButton } from '../../src/components/ui';

const INTRO_STORAGE_KEY = '@quenchr:hasSeenIntro';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  id: string;
  heading: string;
  subtitle: string;
  showLogo?: boolean;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    heading: 'Your algorithm\nknows too much.',
    subtitle:
      "It\u2019s been feeding you\u2026 questionable content. Let\u2019s have a little chat with it.",
    showLogo: true,
  },
  {
    id: '2',
    heading: 'We scan. We judge.\nWe fix.',
    subtitle:
      'Audit your feed with on-device AI, get a cleanliness score, and follow a guided cleanup plan.',
  },
  {
    id: '3',
    heading: 'No lectures.\nJust results.',
    subtitle:
      "Quenchr gamifies the cleanup \u2014 streaks, badges, challenges. Because guilt alone wasn\u2019t working.",
  },
];

export default function IntroScreen() {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isLastSlide = activeIndex === SLIDES.length - 1;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  async function markIntroSeen() {
    await AsyncStorage.setItem(INTRO_STORAGE_KEY, 'true');
  }

  async function handleGetStarted() {
    await markIntroSeen();
    router.replace('/(auth)/login');
  }

  async function handleSkip() {
    await markIntroSeen();
    router.replace('/(auth)/login');
  }

  function renderSlide({ item }: { item: Slide }) {
    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        <View style={styles.slideContent}>
          {item.showLogo && (
            <View style={styles.logoWrap}>
              <QuenchrLogo size={72} variant="brown" />
            </View>
          )}

          <Text style={styles.heading}>{item.heading}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>

        {isLastSlide && item.id === SLIDES[SLIDES.length - 1].id && (
          <View style={styles.ctaWrap}>
            <PrimaryButton label="Get Started" onPress={handleGetStarted} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Skip link */}
      <TouchableOpacity
        style={[styles.skipBtn, { top: insets.top + 16 }]}
        onPress={handleSkip}
        activeOpacity={0.6}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Pagination dots */}
      <View style={[styles.dotsRow, { paddingBottom: insets.bottom + 40 }]}>
        {SLIDES.map((slide, i) => (
          <View
            key={slide.id}
            style={[styles.dot, i === activeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  skipBtn: {
    position: 'absolute',
    right: spacing.pagePad,
    zIndex: 10,
  },
  skipText: {
    ...typ.btn,
    color: colors.ink3,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.pagePad + 8,
  },
  slideContent: {
    alignItems: 'center',
  },
  logoWrap: {
    marginBottom: 32,
  },
  heading: {
    ...typ.h1,
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 44,
  },
  subtitle: {
    ...typ.body,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  ctaWrap: {
    marginTop: 48,
    paddingHorizontal: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.cream3,
  },
  dotActive: {
    backgroundColor: colors.brown,
    width: 24,
  },
});
