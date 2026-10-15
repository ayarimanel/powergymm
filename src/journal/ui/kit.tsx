import React from 'react';
import { Pressable, StyleProp, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import { Text } from '../../components/ui/Text';
import Svg, { Path } from 'react-native-svg';
import { MuscleGroup } from '../../types/database';
import { Recovery } from '../journalLogic';
import { colors } from '../../theme';

/** Journal tokens (Journal.css), mapped onto the app theme. */
export const J = {
  bg: colors.bg,
  surface: colors.card,
  surface2: colors.track,
  line: colors.border,
  fg: colors.text,
  muted: colors.textMuted,
  accent: colors.brand,
  accentSoft: colors.brandSoft,
  accentText: colors.brandText,
  ok: colors.green.bar,
  okText: colors.green.text,
  okSoft: colors.green.soft,
  rec: colors.amber.bar,
  recText: colors.amber.text,
  recSoft: colors.amber.soft,
  tired: colors.red.bar,
  tiredText: colors.red.text,
  tiredSoft: colors.red.soft,
  gold: colors.gold.text,
  goldBright: colors.gold.bar,
  goldSoft: colors.gold.soft,
};

export const tabular = { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] };

/** Mixes a hex color with the card surface: the "color-mix(… 16 %, surface)" of the CSS. */
export const tint = (hex: string, pct: number) => {
  const n = parseInt(hex.slice(1), 16);
  const base = parseInt(colors.card.slice(1), 16);
  const mix = (c: number, b: number) => Math.round(c * (pct / 100) + b * (1 - pct / 100));
  return `rgb(${mix((n >> 16) & 255, (base >> 16) & 255)},${mix((n >> 8) & 255, (base >> 8) & 255)},${mix(n & 255, base & 255)})`;
};

type BtnVariant = 'primary' | 'soft' | 'ghost' | 'danger' | 'dark';
export const Btn: React.FC<{
  label: string;
  onPress: () => void;
  variant?: BtnVariant;
  small?: boolean;
  full?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ label, onPress, variant = 'primary', small, full, disabled, style }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityState={{ disabled: !!disabled }}
    style={({ pressed }) => [k.btn, k[`btn_${variant}`], small && k.btnSm, full && { alignSelf: 'stretch' }, disabled && { opacity: 0.45 }, pressed && { opacity: 0.85 }, style]}
  >
    <Text style={[k.btnText, k[`btnText_${variant}`], small && { fontSize: 12 }]}>{label}</Text>
  </Pressable>
);

export const Link: React.FC<{ label: string; onPress: () => void; muted?: boolean; style?: StyleProp<ViewStyle> }> = ({ label, onPress, muted, style }) => (
  <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={[{ alignSelf: 'flex-start', padding: 4 }, style]}>
    <Text style={[k.link, muted && k.linkMuted]}>{label}</Text>
  </Pressable>
);

export const Card: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => <View style={[k.card, style]}>{children}</View>;

export const SecHead: React.FC<{ title: string; right?: React.ReactNode; sub?: string; pad?: boolean }> = ({ title, right, sub, pad }) => (
  <View style={[k.sec, pad && { paddingHorizontal: 4, marginBottom: 0, marginTop: 4 }]}>
    <Text style={k.h2} accessibilityRole="header">{title}</Text>
    {sub ? <Text style={k.sub}>{sub}</Text> : right}
  </View>
);

export function Seg<T extends string | number>({ options, value, onChange, small }: { options: [T, string][]; value: T; onChange: (v: T) => void; small?: boolean }) {
  return (
    <View style={k.seg} accessibilityRole="tablist">
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable key={String(v)} onPress={() => onChange(v)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[k.segBtn, small && k.segBtnSm, on && k.segOn]}>
            <Text style={[k.segText, small && { fontSize: 11 }, on && { color: colors.onBrand }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const Kpis: React.FC<{ items: [string | number, string][]; tight?: boolean }> = ({ items, tight }) => (
  <View style={[k.kpis, tight && k.kpisTight]}>
    {items.map(([v, l]) => (
      <View key={l} style={k.kpi}>
        <Text style={[k.kpiV, tabular]}>{v}</Text>
        <Text style={k.kpiL}>{l}</Text>
      </View>
    ))}
  </View>
);

export const Pill: React.FC<{ tone: 'ok' | 'rec' | 'tired' | 'never'; label: string }> = ({ tone, label }) => {
  const c = tone === 'ok' ? [J.okSoft, J.okText] : tone === 'rec' ? [J.recSoft, J.recText] : tone === 'tired' ? [J.tiredSoft, J.tiredText] : [J.surface2, J.muted];
  return (
    <View style={[k.pill, { backgroundColor: c[0] }]}>
      <Text style={[k.pillText, { color: c[1] }]} numberOfLines={1}>{label}</Text>
    </View>
  );
};

export const StatusPill: React.FC<{ r: Recovery }> = ({ r }) => {
  if (r.status === 'never') return <Pill tone="never" label="À découvrir" />;
  if (r.status === 'ready') return <Pill tone="ok" label="Prêt" />;
  if (r.status === 'recovering') return <Pill tone="rec" label={`Prêt dans ${r.readyInH} h`} />;
  return <Pill tone="tired" label={`Fatigué · ${r.readyInH} h`} />;
};

const GLYPH: Record<MuscleGroup, string> = {
  chest: 'M5 8c2-3 5-3 7 0 2-3 5-3 7 0v5c-2 3-5 3-7 0-2 3-5 3-7 0z',
  back: 'M7 4h10l2 6-3 10H8L5 10z',
  legs: 'M8 3h3v18H8zM13 3h3v18h-3z',
  shoulders: 'M3 12a5 5 0 0 1 10 0M11 12a5 5 0 0 1 10 0M9 12h6v9H9z',
  arms: 'M6 4h4v7l5 2 3 4-2 3-6-3H6z',
  cardio: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
};
export const MuscleGlyph: React.FC<{ id: MuscleGroup; color: string; size?: number }> = ({ id, color, size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d={GLYPH[id]} fill={color} />
  </Svg>
);

/** Round muscle badge: tinted circle + glyph. */
export const MuscleIcon: React.FC<{ id: MuscleGroup; color: string; small?: boolean }> = ({ id, color, small }) => (
  <View style={[k.ic, small && k.icSm, { backgroundColor: tint(color, 16) }]}>
    <MuscleGlyph id={id} color={color} size={small ? 20 : 24} />
  </View>
);

export const Dot: React.FC<{ color: string; size?: number }> = ({ color, size = 8 }) => <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;

export const k = StyleSheet.create({
  card: { backgroundColor: J.surface, borderWidth: 1, borderColor: J.line, borderRadius: 20, padding: 14, shadowColor: colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 1 },
  sec: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 },
  h2: { fontSize: 15, fontWeight: '800', color: J.fg },
  sub: { fontSize: 12, color: J.muted },
  empty: { color: J.muted, fontSize: 13, marginTop: 6, marginBottom: 10 },
  note: { fontSize: 11, color: J.muted, marginTop: 10, lineHeight: 16 },

  btn: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  btnSm: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, minHeight: 32 },
  btn_primary: { backgroundColor: J.accent },
  btn_soft: { backgroundColor: J.accentSoft },
  btn_ghost: { backgroundColor: J.surface2 },
  btn_danger: { backgroundColor: J.tired },
  btn_dark: { backgroundColor: J.fg },
  btnText: { fontWeight: '800', fontSize: 14 },
  btnText_primary: { color: colors.white },
  btnText_soft: { color: J.accentText },
  btnText_ghost: { color: J.fg },
  btnText_danger: { color: colors.white },
  btnText_dark: { color: J.surface },

  link: { color: J.accent, fontWeight: '800', fontSize: 13 },
  linkMuted: { color: J.muted, fontWeight: '700', fontSize: 12 },

  seg: { flexDirection: 'row', backgroundColor: J.surface2, borderRadius: 999, padding: 3, alignSelf: 'flex-start' },
  segBtn: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  segBtnSm: { paddingVertical: 3, paddingHorizontal: 9 },
  // Active segment = the club color, as the filter pills
  segOn: { backgroundColor: colors.brand, shadowColor: colors.brand, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 1 },
  segText: { fontSize: 12, fontWeight: '700', color: J.muted },

  kpis: { flexDirection: 'row', backgroundColor: J.surface2, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4 },
  kpisTight: { backgroundColor: 'transparent', padding: 0, gap: 16 },
  kpi: { flex: 1, alignItems: 'center', minWidth: 0 },
  kpiV: { fontSize: 24, fontWeight: '900', color: J.fg, lineHeight: 26 },
  kpiL: { fontSize: 11, color: J.muted },

  pill: { alignSelf: 'center', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 3 },
  pillText: { fontSize: 10.5, fontWeight: '800' },

  ic: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  icSm: { width: 38, height: 38, borderRadius: 19 },

  prMini: { fontSize: 10, fontWeight: '800', backgroundColor: J.goldSoft, color: J.gold, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
});
