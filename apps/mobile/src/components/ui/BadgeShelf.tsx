import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { BADGES } from '../../utils/badges';
import { colors, type as typ, radius } from '../../tokens';

interface Props {
  unlockedIds: Set<string>;
}

export function BadgeShelf({ unlockedIds }: Props) {
  // Unlocked badges first, then locked ones
  const sorted = [...BADGES].sort((a, b) => {
    const aUnlocked = unlockedIds.has(a.id);
    const bUnlocked = unlockedIds.has(b.id);
    if (aUnlocked === bUnlocked) return 0;
    return aUnlocked ? -1 : 1;
  });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {sorted.map((badge) => {
        const unlocked = unlockedIds.has(badge.id);
        return (
          <View key={badge.id} style={styles.item}>
            <View style={[styles.circle, unlocked ? styles.circleUnlocked : styles.circleLocked]}>
              <Text style={[styles.emoji, !unlocked && styles.emojiLocked]}>
                {badge.emoji}
              </Text>
            </View>
            <Text
              style={[styles.label, !unlocked && styles.labelLocked]}
              numberOfLines={2}
            >
              {badge.name}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const CIRCLE = 56;

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 2,
    gap: 16,
    paddingBottom: 4,
  },
  item: {
    alignItems: 'center',
    width: CIRCLE + 8,
    gap: 6,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleUnlocked: {
    backgroundColor: colors.gold + '25',
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  circleLocked: {
    backgroundColor: colors.char4,
    borderWidth: 1.5,
    borderColor: colors.char4,
  },
  emoji: {
    fontSize: 24,
  },
  emojiLocked: {
    opacity: 0.25,
  },
  label: {
    ...typ.caption,
    color: colors.lt2,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 13,
  },
  labelLocked: {
    color: colors.lt4,
    opacity: 0.5,
  },
});
