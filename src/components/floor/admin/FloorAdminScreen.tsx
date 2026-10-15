import React, { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { Text } from '../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloorSettings } from '../../../types/floor';
import { FloorSettingsService } from '../../../services/floorSettingsService';
import { FloorDemoService } from '../../../services/floorDemoService';
import { useFloorAdminData } from '../../../floor/useFloorAdminData';
import { LEVEL_LABEL } from '../../../floor/crowd';
import { levelTint } from '../../../floor/levelColors';
import { useBackHandler } from '../../../navigation/backStack';
import { colors } from '../../../theme';
import { HBars, TodayVsAverageChart, WeekHeatmap } from './AdminCharts';
import { HoursEditor } from './HoursEditor';
import { ZoneSettings } from './ZoneSettings';
import { claimSwipe } from '../../../navigation/swipeGuard';

interface Props {
  visible: boolean;
  onClose: () => void;
  gymId: string;
  capacity: number;
  /** Hours, zones or demo data changed: the member Floor should reload now. */
  onChanged: () => void;
}

type Tab = 'summary' | 'live' | 'graph' | 'hours' | 'zones' | 'demand' | 'engagement';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'summary', label: 'Résumé', icon: 'sparkles-outline' },
  { id: 'live', label: 'En direct', icon: 'pulse-outline' },
  { id: 'graph', label: 'Graphiques', icon: 'analytics-outline' },
  { id: 'hours', label: 'Horaires', icon: 'time-outline' },
  { id: 'zones', label: 'Zones', icon: 'grid-outline' },
  { id: 'demand', label: 'Demande', icon: 'notifications-outline' },
  { id: 'engagement', label: 'Engagement', icon: 'people-outline' },
];
const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const hh = (h: number | null) => (h === null ? '—' : `${h}h`);

const Kpi: React.FC<{ value: string | number; label: string; tint?: { soft: string; text: string } }> = ({ value, label, tint }) => (
  <View style={[styles.kpi, tint && { backgroundColor: tint.soft }]}>
    <Text style={[styles.kpiValue, tint && { color: tint.text }]}>{value}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </View>
);

const Section: React.FC<{ title: string; children: React.ReactNode; note?: string }> = ({ title, children, note }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {note && <Text style={styles.note}>{note}</Text>}
    {children}
  </View>
);

const SINGLE_DEVICE_NOTE = 'Sans le backend, l’app ne voit que les check-ins faits sur cet appareil. Active le mode démo pour une présentation.';

/** Owner-only "Live" dashboard: exact numbers, the detailed graphs, and every Floor setting. */
export const FloorAdminScreen: React.FC<Props> = ({ visible, onClose, gymId, capacity, onChanged }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [tab, setTab] = useState<Tab>('summary');
  const [demoBusy, setDemoBusy] = useState(false);
  const { data, reload } = useFloorAdminData(gymId, capacity, visible ? 20_000 : 3_600_000);

  useBackHandler(visible, onClose);

  const saveSettings = async (patch: Partial<FloorSettings>) => {
    await FloorSettingsService.saveSettings(patch);
    await reload();
    onChanged();
  };

  const toggleDemo = async (on: boolean) => {
    setDemoBusy(true);
    if (on) await FloorDemoService.enable();
    else await FloorDemoService.disable();
    await reload();
    onChanged();
    setDemoBusy(false);
  };

  if (!visible) return null;
  const now = new Date();

  const body = () => {
    if (!data) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />;
    const tint = levelTint(data.level);
    switch (tab) {
      case 'summary': {
        const { summary, saturation, shift, gaps, quiet } = data;
        const red = levelTint('plein');
        const green = levelTint('calme');
        return (
          <>
            <Section title="Ta semaine en bref" note={data.demoMode ? undefined : SINGLE_DEVICE_NOTE}>
              <View style={[styles.kpis, wide && styles.kpisWide]}>
                <Kpi value={summary.visits} label="Entrées · 7 derniers jours" />
                <Kpi
                  value={summary.change === null ? '—' : `${summary.change >= 0 ? '+' : ''}${summary.change} %`}
                  label="vs la semaine d’avant"
                  tint={summary.change === null ? undefined : summary.change >= 0 ? green : red}
                />
                <Kpi value={summary.busiest ? `${WEEKDAYS[summary.busiest.weekday].slice(0, 3)}. ${summary.busiest.hour}h` : '—'} label="Moment le plus chargé" />
              </View>
              {summary.lines.slice(1).map(l => (
                <View key={l} style={styles.line}>
                  <View style={styles.lineDot} />
                  <Text style={styles.lineText}>{l}</Text>
                </View>
              ))}
              <Pressable
                onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(summary.text)}`).catch(() => {})}
                accessibilityRole="button"
                style={({ pressed }) => [styles.share, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
                <Text style={styles.shareText}>Envoyer le résumé sur WhatsApp</Text>
              </Pressable>
            </Section>

            <Section title="Matériel : zones saturées" note="Membres présents en moyenne vs nombre de postes déclarés (onglet Zones), 4 dernières semaines.">
              {saturation.length ? (
                saturation.map(z => (
                  <View key={z.muscle} style={styles.insightRow}>
                    <View style={[styles.zoneRow, { borderBottomWidth: 0, paddingBottom: 2 }]}>
                      <Text style={styles.zoneName}>{z.label.charAt(0).toUpperCase() + z.label.slice(1)}</Text>
                      <Text style={styles.zoneCount}>≈ {z.worstLoad} / {z.capacity} postes</Text>
                      <View style={[styles.levelPill, { backgroundColor: red.soft }]}>
                        <Text style={[styles.levelPillText, { color: red.text }]}>Saturée</Text>
                      </View>
                    </View>
                    <Text style={styles.insightText}>
                      {z.from}h–{z.to}h, {z.days} jour{z.days > 1 ? 's' : ''} sur 7. Ajoute {Math.max(1, z.worstLoad - z.capacity)} poste{z.worstLoad - z.capacity > 1 ? 's' : ''} ou propose ce créneau aux membres à un autre moment.
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.empty}>Aucune zone saturée : ton matériel suffit aux heures de pointe.</Text>
              )}
            </Section>

            <Section title="Heures de pointe" note="Part des visites aux heures les plus chargées, cette semaine vs les 4 semaines d’avant.">
              {shift ? (
                <>
                  <View style={[styles.kpis, wide && styles.kpisWide]}>
                    <Kpi value={`${Math.round(shift.shareThisWeek * 100)} %`} label={`Visites ${shift.peakFrom}h–${shift.peakTo}h cette semaine`} tint={shift.movedVisits > 0 ? green : undefined} />
                    <Kpi value={`${Math.round(shift.shareBefore * 100)} %`} label="Avant" />
                    <Kpi value={shift.movedVisits > 0 ? `+${shift.roomForMembers}` : '0'} label="Membres réguliers en plus possibles" tint={shift.movedVisits > 0 ? green : undefined} />
                  </View>
                  <Text style={styles.insightText}>{shift.text}</Text>
                </>
              ) : (
                <Text style={styles.empty}>Pas encore assez d’entrées pour comparer (il faut quelques semaines).</Text>
              )}
            </Section>

            <Section title="Coachs plateau aux heures de pointe">
              {gaps.length ? (
                gaps.map(g => (
                  <View key={`${g.weekday}-${g.hour}`} style={styles.line}>
                    <Ionicons name="alert-circle-outline" size={18} color={colors.amber.text} />
                    <Text style={styles.lineText}>{g.text}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.empty}>Tes heures les plus chargées ont un coach plateau prévu.</Text>
              )}
            </Section>

            <Section title="Heures creuses">
              {quiet ? (
                <View style={styles.highlight}>
                  <Ionicons name="bulb-outline" size={20} color={colors.brand} />
                  <Text style={styles.highlightText}>{quiet.text}</Text>
                </View>
              ) : (
                <Text style={styles.empty}>Pas encore assez d’entrées pour trouver ton creux.</Text>
              )}
            </Section>
          </>
        );
      }
      case 'live':
        return (
          <>
            <View style={[styles.kpis, wide && styles.kpisWide]}>
              <Kpi value={data.presentCount} label="Présents maintenant" />
              <Kpi value={LEVEL_LABEL[data.level]} label="Niveau de la salle" tint={tint} />
              <Kpi value={data.lastHourCheckIns} label="Check-ins · dernière heure" />
              <Kpi value={`${Math.round((data.presentCount / Math.max(1, data.capacity)) * 100)} %`} label={`de la capacité (${data.capacity})`} />
            </View>
            <Section title="Zones en direct">
              {data.zones.map(z => {
                const zt = levelTint(z.level);
                return (
                  <View key={z.muscle} style={styles.zoneRow}>
                    <Text style={styles.zoneName}>{z.label}</Text>
                    <Text style={styles.zoneCount}>
                      {z.count} / {z.capacity} postes
                    </Text>
                    <View style={[styles.levelPill, { backgroundColor: zt.soft }]}>
                      <Text style={[styles.levelPillText, { color: zt.text }]}>{LEVEL_LABEL[z.level]}</Text>
                    </View>
                  </View>
                );
              })}
            </Section>
          </>
        );
      case 'graph':
        return (
          <>
            <Section title={`Aujourd’hui vs un ${WEEKDAYS[(now.getDay() + 6) % 7].toLowerCase()} moyen`} note="Check-ins par heure. Moyenne sur les 8 dernières semaines.">
              <TodayVsAverageChart today={data.todayByHour} average={data.weekdayAverageByHour} nowHour={now.getHours()} weekdayLabel={WEEKDAYS[(now.getDay() + 6) % 7]} />
            </Section>
            <Section title="Semaine type" note="Moyenne par jour et par heure, 8 dernières semaines.">
              <WeekHeatmap cells={data.heatmap} />
            </Section>
          </>
        );
      case 'hours':
        return (
          <Section title="Horaires & jours spéciaux" note="Les changements s’appliquent tout de suite à la page Floor des membres.">
            <HoursEditor settings={data.settings} onSave={saveSettings} />
          </Section>
        );
      case 'zones':
        return (
          <Section title="Réglages des zones" note="Nombre de postes par zone → seuils calme / moyen / plein. Aperçu avec les présents actuels.">
            <ZoneSettings settings={data.settings} capacity={data.capacity} live={data.zones} presentCount={data.presentCount} onSave={saveSettings} />
          </Section>
        );
      case 'demand': {
        const planned = data.plannedByHour.filter(p => p.count > 0).sort((a, b) => b.count - a.count);
        const alerts = data.alertsByHour.filter(p => p.count > 0);
        return (
          <>
            {planned[0] && (
              <View style={styles.highlight}>
                <Ionicons name="calendar-outline" size={20} color={colors.brand} />
                <Text style={styles.highlightText}>
                  <Text style={styles.bold}>{planned[0].count} membre{planned[0].count > 1 ? 's' : ''}</Text> prévoi{planned[0].count > 1 ? 'ent' : 't'} de venir à {hh(planned[0].hour)}
                </Text>
              </View>
            )}
            <View style={[styles.kpis, wide && styles.kpisWide]}>
              <Kpi value={data.demoMode ? alerts.reduce((s, a) => s + a.count, 0) : data.activeAlerts} label="Alertes « calme » actives" />
              <Kpi value={hh(data.peakHourThisWeek)} label="Heure de pointe cette semaine" />
              <Kpi value={hh(data.peakHourLastWeek)} label="Heure de pointe semaine dernière" />
            </View>
            <Section title="Visites prévues par heure" note={data.demoMode ? undefined : SINGLE_DEVICE_NOTE}>
              {planned.length ? <HBars rows={[...planned].sort((a, b) => a.hour - b.hour).map(p => ({ label: hh(p.hour), value: p.count }))} highlightMax /> : <Text style={styles.empty}>Aucune visite prévue aujourd’hui.</Text>}
            </Section>
            <Section title="Alertes « préviens-moi » par heure">
              {alerts.length ? <HBars rows={alerts.map(p => ({ label: hh(p.hour), value: p.count }))} highlightMax /> : <Text style={styles.empty}>Aucune alerte active.</Text>}
            </Section>
          </>
        );
      }
      case 'engagement':
        return (
          <>
            <View style={[styles.kpis, wide && styles.kpisWide]}>
              <Kpi value={data.checkInsPerDay.reduce((s, d) => s + d.count, 0)} label="Check-ins · 7 derniers jours" />
              <Kpi value={data.activeMembersThisWeek ?? '—'} label="Membres actifs cette semaine" />
            </View>
            <Section title="Check-ins par jour">
              <HBars rows={data.checkInsPerDay.map(d => ({ label: WEEKDAYS[(new Date(d.date + 'T00:00:00').getDay() + 6) % 7].slice(0, 3), value: d.count }))} />
            </Section>
            <Section title="Répartition des séries" note={data.demoMode ? 'Nombre de membres par longueur de série.' : SINGLE_DEVICE_NOTE}>
              {data.streakBuckets.length ? <HBars rows={data.streakBuckets.map(b => ({ label: b.bucket, value: b.count }))} /> : null}
            </Section>
          </>
        );
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer le tableau de bord">
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            Live
          </Text>
          <View style={styles.demo}>
            {demoBusy ? <ActivityIndicator size="small" color={colors.brand} /> : null}
            <Text style={styles.demoLabel}>Mode démo</Text>
            <Switch value={!!data?.demoMode} onValueChange={toggleDemo} disabled={demoBusy} accessibilityLabel="Mode démo" />
          </View>
        </View>

        {data?.demoMode && (
          <View style={styles.demoBanner}>
            <Text style={styles.demoBannerText}>Données de démonstration : rien de tout ça n’est réel.</Text>
          </View>
        )}

        <ScrollView horizontal onTouchStart={claimSwipe} showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
          {TABS.map(t => {
            const on = tab === t.id;
            return (
              <Pressable key={t.id} onPress={() => setTab(t.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.tab, on && styles.tabOn]}>
                <Ionicons name={t.icon as any} size={16} color={on ? colors.white : colors.textSecondary} />
                <Text style={[styles.tabText, on && { color: colors.white }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
          <View style={styles.inner}>{body()}</View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { flex: 1, fontSize: 20, fontWeight: '900', color: colors.text },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  demoLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  demoBanner: { backgroundColor: colors.amber.soft, paddingVertical: 6, paddingHorizontal: 16 },
  demoBannerText: { fontSize: 12, fontWeight: '700', color: colors.amber.text, textAlign: 'center' },

  tabsScroll: { flexGrow: 0, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.track },
  tabOn: { backgroundColor: colors.text },
  tabText: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },

  content: { padding: 16 },
  inner: { width: '100%', maxWidth: 1100, alignSelf: 'center', gap: 14 },

  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpisWide: { flexWrap: 'nowrap' },
  kpi: { flexGrow: 1, flexBasis: '45%', padding: 14, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 2 },
  kpiValue: { fontSize: 26, fontWeight: '900', color: colors.text },
  kpiLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  section: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  note: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: -4 },
  empty: { fontSize: 13, color: colors.textMuted },
  bold: { fontWeight: '900', color: colors.text },

  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.track },
  zoneName: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  zoneCount: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  levelPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, minWidth: 72, alignItems: 'center' },
  levelPillText: { fontSize: 12, fontWeight: '900' },

  highlight: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.brandSoft },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted, marginTop: 7 },
  lineText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
  share: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 14, backgroundColor: colors.whatsapp, marginTop: 4 },
  shareText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  insightRow: { gap: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.track },
  insightText: { fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  highlightText: { flex: 1, fontSize: 15, color: colors.text },
});
