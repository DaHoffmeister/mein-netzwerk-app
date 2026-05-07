// lib/NavLamp.tsx
// Leuchtstreifen-Animation entlang der unteren Kante der Navbar.
// Reines RN — kein natives Modul nötig. Gradient via gestaffelter View-Opazität.

import { useEffect, useRef } from 'react';
import { Animated, Easing, useWindowDimensions, StyleSheet, View } from 'react-native';
import { useTheme } from './ThemeContext';

const LAMP_WIDTH = 160;
const DURATION   = 12000;

// Gradient-Slices: opacity-Stufen simulieren transparent → solid → transparent
const SLICES = [0.05, 0.15, 0.35, 0.65, 0.9, 1, 1, 0.9, 0.65, 0.35, 0.15, 0.05];

export default function NavLamp() {
  const { theme }  = useTheme();
  const { width }  = useWindowDimensions();
  const translateX = useRef(new Animated.Value(-LAMP_WIDTH)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(translateX, {
        toValue:         width + LAMP_WIDTH,
        duration:        DURATION,
        easing:          Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [width]);

  const sliceWidth = LAMP_WIDTH / SLICES.length;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.lamp, { transform: [{ translateX }] }]}>
        {SLICES.map((opacity, i) => (
          <View
            key={i}
            style={{ width: sliceWidth, height: 2, backgroundColor: theme.brand, opacity }}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    overflow: 'hidden',
  },
  lamp: {
    position: 'absolute',
    flexDirection: 'row',
    width: LAMP_WIDTH,
    height: 2,
  },
});
