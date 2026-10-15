import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, G, Rect, Circle } from 'react-native-svg';
import { MuscleGroup } from '../types/database';
import { colors } from '../theme';

interface MuscleAnatomyIconProps {
  muscleGroup: MuscleGroup;
  size?: number;
}

export const MuscleAnatomyIcon: React.FC<MuscleAnatomyIconProps> = ({ 
  muscleGroup, 
  size = 48 
}) => {
  const PALETTES: Record<string, { bg: string; body: string; accent: string }> = {
    chest: { bg: '#FFF1F2', body: colors.text, accent: '#FF6B6B' },
    back: { bg: '#EFF6FF', body: colors.text, accent: '#3B82F6' },
    shoulders: { bg: '#FEF9C3', body: colors.text, accent: colors.amber.bar },
    arms: { bg: '#ECFCCB', body: colors.text, accent: colors.green.bar },
    legs: { bg: '#ECFEFF', body: colors.text, accent: '#06B6D4' },
    cardio: { bg: '#FFF7ED', body: colors.text, accent: '#FB923C' },
  };

  const palette = PALETTES[muscleGroup] || { bg: colors.brandSoft, body: colors.textSecondary, accent: colors.red.bar };
  const baseColor = palette.body;
  const highlightColor = palette.accent;
  const backgroundColor = palette.bg;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        {/* Soft rounded badge background */}
        <Circle cx="50" cy="50" r="48" fill={backgroundColor} />
        {/* subtle ring */}
        <Circle cx="50" cy="50" r="48" stroke={colors.white} strokeOpacity="0.08" strokeWidth="2" />
        
        {/* CHEST ANATOMY ICON */}
        {muscleGroup === 'chest' && (
          <G>
            {/* Body Silhouette */}
            <Path 
              d="M33 24 L50 18 L67 24 L75 38 L70 74 L30 74 L25 38 Z" 
              fill={baseColor} 
              stroke="rgba(0,0,0,0.06)" 
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Neck */}
            <Path d="M44 10 L56 10 L54 16 L46 16 Z" fill={baseColor} />
            {/* CHEST HIGHLIGHTED IN VIBRANT RED */}
            <Path 
              d="M36 34 C43 31, 48 34, 50 40 C52 34, 57 31, 64 34 C68 44, 54 52, 50 54 C46 52, 34 44, 36 34 Z" 
              fill={highlightColor} 
              stroke={colors.white} 
              strokeWidth="1.2"
              strokeOpacity={0.9}
            />
          </G>
        )}

        {/* BACK ANATOMY ICON */}
        {muscleGroup === 'back' && (
          <G>
            {/* Body Silhouette (Rear view) */}
            <Path 
              d="M33 24 L50 18 L67 24 L78 40 L70 74 L30 74 L22 40 Z" 
              fill={baseColor} 
              stroke="rgba(0,0,0,0.06)" 
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Spine line */}
            <Path d="M50 15 L50 82" stroke={colors.text} strokeWidth="2" strokeDasharray="3 3" />
            {/* BACK & LATS HIGHLIGHTED IN VIBRANT RED */}
            <Path 
              d="M36 28 L50 20 L64 28 L72 44 L60 62 L50 50 L40 62 L28 44 Z" 
              fill={highlightColor} 
              stroke={colors.white} 
              strokeWidth="1.2"
              strokeOpacity={0.92}
            />
          </G>
        )}

        {/* SHOULDERS ANATOMY ICON */}
        {muscleGroup === 'shoulders' && (
          <G>
            {/* Torso Base */}
            <Path 
              d="M34 34 L50 26 L66 34 L72 76 L28 76 Z" 
              fill={baseColor} 
              stroke="rgba(0,0,0,0.06)" 
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Left Deltoid Highlight */}
            <Path 
              d="M20 30 C24 22, 36 24, 34 36 C32 44, 22 42, 20 30 Z" 
              fill={highlightColor} 
              stroke={colors.white} 
              strokeWidth="1.0"
              strokeOpacity={0.95}
            />
            {/* Right Deltoid Highlight */}
            <Path 
              d="M80 30 C76 22, 64 24, 66 36 C68 44, 78 42, 80 30 Z" 
              fill={highlightColor} 
              stroke={colors.white} 
              strokeWidth="1.0"
              strokeOpacity={0.95}
            />
          </G>
        )}

        {/* ARMS (BICEPS / TRICEPS) ANATOMY ICON */}
        {muscleGroup === 'arms' && (
          <G>
            {/* Torso Center */}
            <Path d="M40 22 L60 22 L58 74 L42 74 Z" fill={baseColor} stroke="rgba(0,0,0,0.06)" strokeWidth="1.2" />
            {/* Left Bicep Highlight */}
            <Path 
              d="M22 26 C28 24, 36 30, 34 46 C32 56, 24 52, 20 36 Z" 
              fill={highlightColor} 
              stroke={colors.white} 
              strokeWidth="1.0"
              strokeOpacity={0.95}
            />
            {/* Right Bicep Highlight */}
            <Path 
              d="M78 26 C72 24, 64 30, 66 46 C68 56, 76 52, 80 36 Z" 
              fill={highlightColor} 
              stroke={colors.white} 
              strokeWidth="1.0"
              strokeOpacity={0.95}
            />
          </G>
        )}

        {/* LEGS & GLUTES ANATOMY ICON */}
        {muscleGroup === 'legs' && (
          <G>
            {/* Hip Base */}
            <Path d="M30 18 L70 18 L66 34 L34 34 Z" fill={baseColor} />
            {/* Left Quad / Thigh Highlight */}
            <Path 
              d="M32 34 L48 34 L44 76 L28 74 Z" 
              fill={highlightColor} 
              stroke={colors.white} 
              strokeWidth="1.0"
              strokeOpacity={0.95}
            />
            {/* Right Quad / Thigh Highlight */}
            <Path 
              d="M52 34 L68 34 L72 74 L56 76 Z" 
              fill={highlightColor} 
              stroke={colors.white} 
              strokeWidth="1.0"
              strokeOpacity={0.95}
            />
          </G>
        )}

        {/* CARDIO ANATOMY ICON */}
        {muscleGroup === 'cardio' && (
          <G>
            {/* Chest Silhouette */}
            <Path d="M32 28 L68 28 L64 70 L36 70 Z" fill={baseColor} />
            {/* Heart Pulse Highlight */}
            <Path 
              d="M50 32 C42 22, 28 34, 36 50 L50 66 L64 50 C72 34, 58 22, 50 32 Z" 
              fill={highlightColor} 
              stroke={colors.white} 
              strokeWidth="1.2"
              strokeOpacity={0.95}
            />
            {/* Pulse line */}
            <Path d="M25 45 L38 45 L43 35 L48 55 L53 40 L58 45 L75 45" stroke={colors.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </G>
        )}

      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
