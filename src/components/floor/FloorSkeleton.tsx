import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../../theme';

const Bone: React.FC<{ style?: object }> = ({ style }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return <Animated.View style={[styles.bone, style, { opacity: anim }]} />;
};

/** Placeholder shown while the first Floor snapshot is loading. */
export const FloorSkeleton: React.FC = () => (
  <View>
    <View style={styles.storiesRow}>
      {[0, 1, 2, 3].map(i => <Bone key={i} style={{ width: 56, height: 56, borderRadius: 28 }} />)}
    </View>
    <View style={styles.card}>
      <Bone style={{ width: 130, height: 34, borderRadius: 10 }} />
      <Bone style={{ width: 200, height: 18, marginTop: 14 }} />
      <Bone style={{ height: 40, marginTop: 22, borderRadius: 12 }} />
    </View>
    <View style={styles.chipsRow}>
      {[0, 1, 2, 3].map(i => <Bone key={i} style={{ width: 90, height: 38, borderRadius: 19 }} />)}
    </View>
  </View>
);

const styles = StyleSheet.create({
  bone: { backgroundColor: colors.track },
  storiesRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: { borderRadius: 24, padding: 18, minHeight: 200, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
