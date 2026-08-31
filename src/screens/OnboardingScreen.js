import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Dimensions, Platform, StatusBar,
} from 'react-native';
import { colors, spacing, radius } from '../utils/theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '⛳',
    title: 'Make every\nround count.',
    body: 'TeeWager turns your regular round into a friendly competition. Track who earns what hole by hole and settle up at the bar with one tap — no math, no arguments, no IOUs.',
  },
  {
    emoji: '🫘',
    title: 'Beans are\nthe currency.',
    body: 'Set your bean (wager) amount. Then earn beans for birdies, long drives, closest to the pin, 3-putts, skins, and more. Every hole is a chance to win — or lose — a few beans.',
  },
  {
    emoji: '🏆',
    title: 'Free to play.\nPro for more.',
    body: '3 free rounds with 4 core games and up to 4 players. Upgrade to Pro for all 13 games, a 5th player slot, lifetime stats, and a shareable results card.',
  },
  {
    emoji: '🚀',
    title: "You're ready\nto play.",
    body: 'Create an account to save your rounds and stats, or jump straight in as a guest. You can sign up anytime.',
    isFinal: true,
  },
];

export default function OnboardingScreen({ onDone }) {
  const [index, setIndex] = useState(0);
  const listRef = useRef(null);

  function next() {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      onDone();
    }
  }

  function skip() {
    onDone();
  }

  const slide = SLIDES[index];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Skip button */}
      {index < SLIDES.length - 1 && (
        <TouchableOpacity style={styles.skipBtn} onPress={skip} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onMomentumScrollEnd={e => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(newIndex);
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {/* CTA */}
      {slide.isFinal ? (
        <View style={styles.finalBtns}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => onDone('signup')} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Create account — free</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => onDone('signin')} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDone('guest')} activeOpacity={0.7} style={styles.guestBtn}>
            <Text style={styles.guestText}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.nextBtn} onPress={next} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>Next →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.green, alignItems: 'center' },

  skipBtn:      { position: 'absolute', top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 12 : 56, right: spacing.xl, zIndex: 10 },
  skipText:     { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' },

  slide:        { width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingTop: 80 },
  emoji:        { fontSize: 72, marginBottom: spacing.lg },
  title:        { fontSize: 36, fontWeight: '900', color: colors.white, textAlign: 'center', lineHeight: 42, marginBottom: spacing.md },
  body:         { fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 24 },

  dots:         { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive:    { backgroundColor: colors.white, width: 22 },

  nextBtn:      { marginBottom: 48, backgroundColor: colors.white, paddingVertical: 16, paddingHorizontal: 48, borderRadius: radius.pill },
  nextBtnText:  { color: colors.green, fontSize: 17, fontWeight: '800' },

  finalBtns:    { width: '100%', paddingHorizontal: spacing.xl, marginBottom: 48, gap: spacing.sm, flexDirection: 'column' },
  primaryBtn:   { backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: colors.green, fontSize: 16, fontWeight: '800' },
  secondaryBtn: { borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  secondaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  guestBtn:     { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.sm },
  guestText:    { color: 'rgba(255,255,255,0.72)', fontSize: 14 },
});
