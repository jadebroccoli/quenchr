import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { colors, type as typ } from '../src/tokens';
import { QuenchrLogo } from '../src/components/ui';

// ── Feature data ──

const features = [
  {
    title: 'AI Feed Analysis',
    body: 'Claude analyzes your feed frame-by-frame and tells you exactly what your algorithm thinks you want.',
  },
  {
    title: 'Unlimited Audits',
    body: 'Track your score improving over time. Free tier caps at 3.',
  },
  {
    title: 'All 5 Platforms',
    body: 'Instagram, TikTok, Twitter/X, Reddit, YouTube. Clean everything.',
  },
  {
    title: 'Full Cleanup Plans',
    body: 'All 12 tasks per platform, priority-ordered by your actual audit results.',
  },
  {
    title: 'Browser Extension',
    body: 'Real-time content filtering as you scroll on desktop.',
    badge: 'COMING SOON',
  },
];

// ── Check icon ──

function CheckIcon() {
  return (
    <View style={styles.checkCircle}>
      <Svg width={10} height={10} viewBox="0 0 10 10">
        <Path
          d="M2 5l2.5 2.5L8 3"
          stroke={colors.gold}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

// ── Close icon ──

function CloseIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.lt4} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18" />
      <Path d="M6 6l12 12" />
    </Svg>
  );
}

// ── Main Screen ──

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Plan state
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(false);

  // Close button delay
  const [showClose, setShowClose] = useState(false);

  // Toggle animation
  const slideAnim = useRef(new Animated.Value(1)).current; // 0=monthly, 1=annual (default annual)
  const [toggleWidth, setToggleWidth] = useState(0);
  const saveBadgeOpacity = useRef(new Animated.Value(1)).current;

  // Show close button after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowClose(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch RC offerings
  useEffect(() => {
    const fetchOfferings = async () => {
      try {
        const offerings = await Purchases.getOfferings();
        if (offerings.current) {
          const monthly = offerings.current.availablePackages.find(
            (p) => p.packageType === 'MONTHLY'
          );
          const annual = offerings.current.availablePackages.find(
            (p) => p.packageType === 'ANNUAL'
          );
          if (monthly) setMonthlyPackage(monthly);
          if (annual) setAnnualPackage(annual);
        }
      } catch (e) {
        console.error('Error fetching offerings:', e);
      }
    };
    fetchOfferings();
  }, []);

  // Animate toggle
  function selectPlan(plan: 'monthly' | 'annual') {
    setSelectedPlan(plan);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: plan === 'annual' ? 1 : 0,
        duration: 200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(saveBadgeOpacity, {
        toValue: plan === 'annual' ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }

  // Purchase
  const handlePurchase = async () => {
    const pkg = selectedPlan === 'monthly' ? monthlyPackage : annualPackage;
    if (!pkg) return;
    setLoading(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (customerInfo.entitlements.active['pro']) {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase failed', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Restore
  const handleRestore = async () => {
    setLoading(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active['pro']) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('No purchases found', 'No active subscription found to restore.');
      }
    } catch (e: any) {
      Alert.alert('Restore failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const onToggleLayout = (e: LayoutChangeEvent) => {
    setToggleWidth(e.nativeEvent.layout.width);
  };

  const pillWidth = toggleWidth > 0 ? (toggleWidth - 6) / 2 : 0;
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, pillWidth],
  });

  const isAnnual = selectedPlan === 'annual';
  const priceText = isAnnual ? '$4.99' : '$7.99';
  const periodText = '/ month';
  const billingNote = isAnnual
    ? 'Billed annually at $59.99. Cancel anytime.'
    : 'Billed monthly. Cancel anytime.';
  const footerNote = isAnnual
    ? 'Then $59.99/year. Cancel anytime.'
    : 'Then $7.99/month. Cancel anytime.';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 16 }]}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <QuenchrLogo size={32} variant="cream" />
            <Text style={styles.logoText}>Quenchr</Text>
          </View>
          <Text style={styles.headline}>
            {'Your feed deserves\nbetter than this.'}
          </Text>
          <Text style={styles.subheadline}>
            Upgrade to Pro and actually fix your algorithm — not just feel bad about it.
          </Text>
        </View>

        {/* ── Plan Toggle ── */}
        <View style={styles.toggleContainer} onLayout={onToggleLayout}>
          {pillWidth > 0 && (
            <Animated.View
              style={[
                styles.togglePill,
                { width: pillWidth, transform: [{ translateX }] },
              ]}
            />
          )}
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => selectPlan('monthly')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, !isAnnual && styles.toggleTextActive]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => selectPlan('annual')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, isAnnual && styles.toggleTextActive]}>
              Annual
            </Text>
          </TouchableOpacity>
        </View>
        <Animated.View style={{ opacity: saveBadgeOpacity }}>
          <Text style={styles.saveBadge}>SAVE 40% — BEST VALUE</Text>
        </Animated.View>

        {/* ── Feature List ── */}
        <View style={styles.featureList}>
          {features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <CheckIcon />
              <View style={styles.featureContent}>
                <View style={styles.featureTitleRow}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  {f.badge && <Text style={styles.featureBadge}>{f.badge}</Text>}
                </View>
                <Text style={styles.featureBody}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Price Display ── */}
        <View style={styles.priceSection}>
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>{priceText}</Text>
            <Text style={styles.periodText}>{periodText}</Text>
          </View>
          <Text style={styles.billingNote}>{billingNote}</Text>
        </View>

        {/* ── CTA Button ── */}
        <TouchableOpacity
          style={[styles.ctaButton, loading && styles.ctaButtonLoading]}
          onPress={handlePurchase}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.brown} size="small" />
          ) : (
            <Text style={styles.ctaText}>Start Free Trial — 7 Days</Text>
          )}
        </TouchableOpacity>

        {/* ── Footer ── */}
        <Text style={styles.footerNote}>{footerNote}</Text>
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={handleRestore}>
            <Text style={styles.footerLink}>Restore Purchases</Text>
          </TouchableOpacity>
          <Text style={styles.footerSep}> · </Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://quenchr.app/privacy')}>
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.footerSep}> · </Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://quenchr.app/terms')}>
            <Text style={styles.footerLink}>Terms</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Close Button (delayed) ── */}
      {showClose && (
        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <CloseIcon />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.char,
  },
  scroll: {
    flexGrow: 1,
  },

  // Header
  header: {
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
    color: colors.lt,
  },
  headline: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 34,
    lineHeight: 36,
    color: colors.lt,
    textAlign: 'center',
    marginTop: 28,
  },
  subheadline: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    lineHeight: 19,
    color: colors.lt3,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 10,
  },

  // Toggle
  toggleContainer: {
    backgroundColor: colors.char3,
    borderRadius: 30,
    padding: 3,
    marginHorizontal: 24,
    marginTop: 24,
    flexDirection: 'row',
    position: 'relative',
  },
  togglePill: {
    position: 'absolute',
    backgroundColor: colors.lt,
    borderRadius: 26,
    top: 3,
    left: 3,
    bottom: 3,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 1,
  },
  toggleText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: colors.lt4,
  },
  toggleTextActive: {
    color: colors.ink,
  },
  saveBadge: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.gold,
    textAlign: 'center',
    marginTop: 8,
  },

  // Features
  featureList: {
    paddingHorizontal: 24,
    marginTop: 28,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(196, 146, 42, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: colors.lt,
    marginBottom: 2,
  },
  featureBadge: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 8,
    letterSpacing: 1,
    color: colors.gold,
    marginLeft: 6,
  },
  featureBody: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    lineHeight: 16,
    color: colors.lt3,
  },

  // Price
  priceSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceText: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 38,
    color: colors.lt,
  },
  periodText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: colors.lt3,
  },
  billingNote: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    color: colors.lt4,
    textAlign: 'center',
    marginTop: 4,
  },

  // CTA
  ctaButton: {
    backgroundColor: colors.lt,
    borderRadius: 14,
    height: 52,
    marginHorizontal: 24,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonLoading: {
    opacity: 0.7,
  },
  ctaText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: colors.brown,
  },

  // Footer
  footerNote: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    color: colors.lt4,
    textAlign: 'center',
    marginTop: 12,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  footerLink: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    color: colors.lt4,
  },
  footerSep: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    color: colors.lt4,
  },

  // Close
  closeButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    padding: 4,
  },
});
