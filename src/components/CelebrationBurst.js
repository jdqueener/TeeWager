import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { colors } from '../utils/theme';

const SYMBOLS = ['$', '$', '$', '💰', '🪙'];
const PARTICLE_COUNT = 18;
const PARTICLE_COLORS = [colors.gold, colors.green];

function randomBetween(min, max) { return min + Math.random() * (max - min); }

// A one-shot, non-interactive dollar-sign/coin burst, fired when a round is
// marked finished. Built on RN's own Animated API rather than a confetti
// library — no new dependency, and the colors tie directly into the app's
// existing gold/green palette instead of generic multi-color confetti.
export default function CelebrationBurst({ visible, onDone }) {
  const { width, height } = useWindowDimensions();
  const particlesRef = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      anim: new Animated.Value(0),
      x: randomBetween(0, width),
      delay: randomBetween(0, 800),
      duration: randomBetween(2800, 4000),
      rotateTo: randomBetween(-180, 180),
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      size: randomBetween(20, 34),
      drift: randomBetween(-40, 40),
    }))
  );

  useEffect(() => {
    if (!visible) return;
    const particles = particlesRef.current;
    particles.forEach(p => p.anim.setValue(0));
    Animated.parallel(
      particles.map(p => Animated.timing(p.anim, {
        toValue: 1, duration: p.duration, delay: p.delay, useNativeDriver: true,
      }))
    ).start(() => onDone?.());
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particlesRef.current.map((p, i) => {
        const translateY = p.anim.interpolate({ inputRange: [0, 1], outputRange: [-40, height * 0.9] });
        const translateX = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
        const opacity     = p.anim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });
        const rotate      = p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotateTo}deg`] });
        return (
          <Animated.Text
            key={i}
            style={[
              styles.particle,
              { left: p.x, fontSize: p.size, color: p.color, opacity, transform: [{ translateY }, { translateX }, { rotate }] },
            ]}
          >
            {p.symbol}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', top: 0, fontWeight: '900' },
});
