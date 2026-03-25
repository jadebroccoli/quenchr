import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { colors } from '../../tokens';

interface Props {
  size?: number;
  variant?: 'brown' | 'cream' | 'dark';
}

/**
 * Quenchr "Q" logo mark — a serif Q with a gold halo tilt.
 * Rendered natively via react-native-svg.
 */
export function QuenchrLogo({ size = 48, variant = 'brown' }: Props) {
  const bg = variant === 'brown' ? colors.brown : variant === 'dark' ? colors.char : colors.cream;
  const fg = variant === 'cream' ? colors.brown : colors.lt;

  const r = size / 2;
  const fontSize = size * 0.56;
  const haloRx = size * 0.155;
  const haloRy = size * 0.045;
  const haloCy = size * 0.31;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={r} cy={r} r={r - 2} fill={bg} />
        {/* Gold halo arcs */}
        <Ellipse cx={r - 1.5} cy={haloCy} rx={haloRx} ry={haloRy} fill={bg} stroke={bg} strokeWidth={size * 0.04} />
        <Path
          d={`M${r - 1.5 - haloRx} ${haloCy} A${haloRx} ${haloRy} 0 0 1 ${r - 1.5 + haloRx} ${haloCy}`}
          fill="none"
          stroke={colors.gold}
          strokeWidth={size * 0.035}
          strokeLinecap="round"
          rotation={-10}
          origin={`${r - 1.5}, ${haloCy}`}
        />
        <Path
          d={`M${r - 1.5 - haloRx} ${haloCy} A${haloRx} ${haloRy} 0 0 0 ${r - 1.5 + haloRx} ${haloCy}`}
          fill="none"
          stroke={colors.gold}
          strokeWidth={size * 0.035}
          strokeLinecap="round"
          strokeOpacity={0.35}
          rotation={-10}
          origin={`${r - 1.5}, ${haloCy}`}
        />
      </Svg>
      <Text
        style={[
          styles.letter,
          {
            fontSize,
            color: fg,
            lineHeight: fontSize * 1.2,
            top: size * 0.15,
          },
        ]}
      >
        Q
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    position: 'absolute',
    fontFamily: 'DMSerifDisplay_400Regular',
  },
});
