import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Modal } from 'react-native';
import { colors, type as typ, radius } from '../tokens';

// ── Types ──

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

type BreathPhase = 'inhale' | 'hold' | 'exhale';

const PHASE_DURATION: Record<BreathPhase, number> = {
  inhale: 4000,
  hold:   4000,
  exhale: 4000,
};

const PHASE_LABELS: Record<BreathPhase, string> = {
  inhale: 'Breathe in',
  hold:   'Hold',
  exhale: 'Breathe out',
};

const PHASES: BreathPhase[] = ['inhale', 'hold', 'exhale'];

// ── Component ──

export function PanicOverlay({ visible, onDismiss }: Props) {
  const circleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const loopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  // Fade in when visible
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      startBreathingLoop();
    } else {
      fadeAnim.setValue(0);
      stopLoop();
    }
    return () => stopLoop();
  }, [visible]);

  function stopLoop() {
    if (loopRef.current) clearTimeout(loopRef.current);
    if (animRef.current) animRef.current.stop();
    circleAnim.setValue(0);
  }

  function runPhase(phaseIndex: number) {
    const currentPhase = PHASES[phaseIndex % PHASES.length];
    setPhase(currentPhase);

    const toValue = currentPhase === 'inhale' ? 1 : currentPhase === 'hold' ? 1 : 0;
    const duration = PHASE_DURATION[currentPhase];

    const anim = Animated.timing(circleAnim, {
      toValue,
      duration,
      easing: currentPhase === 'hold' ? Easing.linear : Easing.inOut(Easing.ease),
      useNativeDriver: false,
    });

    animRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) {
        loopRef.current = setTimeout(() => runPhase(phaseIndex + 1), 100);
      }
    });
  }

  function startBreathingLoop() {
    stopLoop();
    runPhase(0);
  }

  const circleSize = circleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 160],
  });

  const circleOpacity = circleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <View style={styles.content}>
          <Text style={styles.headline}>You caught yourself.</Text>
          <Text style={styles.subheadline}>That's the hard part.</Text>

          {/* Breathing circle */}
          <View style={styles.circleContainer}>
            <Animated.View
              style={[
                styles.outerRing,
                { width: circleSize, height: circleSize, opacity: circleOpacity },
              ]}
            />
            <View style={styles.innerDot} />
          </View>

          <Text style={styles.phaseLabel}>{PHASE_LABELS[phase]}</Text>
          <Text style={styles.phaseSub}>4 · 4 · 4 breathing</Text>

          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={styles.dismissText}>I'm good now</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 14, 8, 0.97)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  headline: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 32,
    color: colors.lt,
    textAlign: 'center',
    marginBottom: 8,
  },
  subheadline: {
    ...typ.body,
    color: colors.ink4,
    textAlign: 'center',
    marginBottom: 64,
  },
  circleContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  outerRing: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: colors.brown,
  },
  innerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.lt,
  },
  phaseLabel: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 24,
    color: colors.lt,
    marginBottom: 8,
  },
  phaseSub: {
    ...typ.caption,
    color: colors.ink4,
    marginBottom: 64,
    letterSpacing: 1,
  },
  dismissButton: {
    borderWidth: 1.5,
    borderColor: colors.brown,
    borderRadius: radius.btn,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  dismissText: {
    ...typ.btn,
    color: colors.lt,
  },
});
