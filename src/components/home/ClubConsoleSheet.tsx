import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { colors } from '../../theme';
import { LiveFloorSummary } from '../../services/liveFloorEngine';
import { ClubMember, ClubService, daysAbsent, daysLeft, renew, waLink } from '../../services/clubService';
import { ClubAnalytics } from '../../services/analyticsService';
import { ClubGrowthCard } from './ClubGrowthCard';
import { fmtInt as fmt } from '../../journal/journalLogic';
import { BottomSheet, SheetScrollView } from './BottomSheet';
import { LineChart } from './LineChart';
import { Avatar } from '../community/Avatar';

interface Props {
  visible: boolean;
  onClose: () => void;
  floor: LiveFloorSummary | null;
  members: ClubMember[];
  onMembersChange: (list: ClubMember[]) => void;
  counts: { onFloor: number; orders: number; applications: number; reports: number };
  onNavigate: (tab: 'shop' | 'coaches') => void;
  onOpenSettings: () => void;
  onOpenInfos: () => void;
  onOpenEntryQr: () => void;
  onOpenPermissions: () => void;
  /** Growth, churn and revenue. Null while it loads. */
  analytics: ClubAnalytics | null;
  /** What one month costs at this club, used when the owner renews someone. */
  monthlyPriceMillimes: number;
  /** Lets the parent recompute the numbers after a renewal. */
  onRenewed?: () => void;
}

const first = (n: string) => n.split(' ')[0];
const hh = (h: number) => `${String(h).padStart(2, '0')}h`;

const Kpi: React.FC<{ icon: string; value: number; label: string; alert?: boolean; onPress?: () => void }> = ({ icon, value, label, alert, onPress }) => (
  <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${label} : ${value}`} style={({ pressed }) => [styles.kpi, alert && value > 0 && styles.kpiAlert, pressed && { opacity: 0.8 }]}>
    <Icon name={icon as any} size={22} color={alert && value > 0 ? colors.amber.text : colors.textSecondary} />
    <Text style={[styles.kpiValue, alert && value > 0 && { color: colors.amber.text }]}>{value}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </Pressable>
);

const Row: React.FC<{ m: ClubMember; sub: string; subColor: string; children: React.ReactNode }> = ({ m, sub, subColor, children }) => (
  <View style={styles.row}>
    <Avatar name={m.name} size={44} />
    <View style={{ flex: 1 }}>
      <Text style={styles.name}>{m.name}</Text>
      <Text style={[styles.rowSub, { color: subColor }]}>{sub}</Text>
    </View>
    {children}
  </View>
);

/** Owner console: what needs attention today, when the club is busy, who to call back. */
export const ClubConsoleSheet: React.FC<Props> = ({ visible, onClose, floor, members, onMembersChange, counts, onNavigate, onOpenSettings, onOpenInfos, onOpenEntryQr, onOpenPermissions, analytics, monthlyPriceMillimes, onRenewed }) => {
  const [confirmRenew, setConfirmRenew] = useState<string | null>(null);
  const [showAllAbsent, setShowAllAbsent] = useState(false);

  const absent = useMemo(() => members.filter(m => daysAbsent(m) >= 10).sort((a, b) => daysAbsent(b) - daysAbsent(a)), [members]);
  const expiring = useMemo(() => members.filter(m => daysLeft(m) <= 14).sort((a, b) => daysLeft(a) - daysLeft(b)), [members]);

  // Busy / quiet hours from the typical curve
  const insight = useMemo(() => {
    if (!floor) return null;
    const bars = floor.hourlyData.filter(h => h.hour < floor.closingHour);
    if (bars.length < 3) return null;
    const sorted = [...bars].sort((a, b) => b.percentage - a.percentage);
    const busiest = sorted[0];
    const quiet = sorted[sorted.length - 1];
    return { busiest, quiet };
  }, [floor]);

  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const shownAbsent = showAllAbsent ? absent : absent.slice(0, 4);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.94]}
      header={
        <Text style={styles.title} accessibilityRole="header">
          Console du club
        </Text>
      }
    >
      {() => (
        <SheetScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Today */}
          <Text style={styles.h}>À surveiller aujourd’hui</Text>
          <View style={styles.kpis}>
            <Kpi icon="people-outline" value={counts.onFloor} label="Dans la salle" />
            <Kpi icon="bag-check-outline" value={counts.orders} label="Commandes" alert onPress={() => onNavigate('shop')} />
            <Kpi icon="ribbon-outline" value={counts.applications} label="Candidatures" alert onPress={() => onNavigate('coaches')} />
            <Kpi icon="card-outline" value={expiring.filter(m => daysLeft(m) <= 7).length} label="Abonnements ≤ 7 j" alert />
            <Kpi icon="chatbubble-ellipses-outline" value={absent.length} label="À relancer" alert />
            <Kpi icon="flag-outline" value={counts.reports} label="Signalements" alert />
          </View>

          {/* Growth: the numbers the owner judges the club on. */}
          {analytics ? (
            <View style={{ marginTop: 16 }}>
              <ClubGrowthCard analytics={analytics} />
            </View>
          ) : null}

          {/* Traffic */}
          <Text style={styles.h}>Affluence typique</Text>
          {floor ? (
            <View style={styles.chartCard}>
              <LineChart points={floor.hourlyData} openingHour={floor.openingHour} closingHour={floor.closingHour} isOpen={floor.isOpen} />
              {insight && (
                <View style={styles.insight}>
                  <Icon name="bulb-outline" size={20} color={colors.brand} />
                  <Text style={styles.insightText}>
                    Pic vers <Text style={styles.bold}>{hh(insight.busiest.hour)}</Text> ({insight.busiest.percentage} % de la capacité). Creux vers <Text style={styles.bold}>{hh(insight.quiet.hour)}</Text> : idéal pour un cours collectif ou une promo.
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Absent members */}
          <Text style={styles.h}>
            À relancer <Text style={styles.count}>({absent.length})</Text>
          </Text>
          {absent.length === 0 && <Text style={styles.empty}>Tous les membres sont venus ces 10 derniers jours.</Text>}
          {shownAbsent.map(m => (
            <Row key={m.id} m={m} sub={`Absent depuis ${daysAbsent(m)} jours`} subColor={colors.amber.text}>
              <Pressable
                onPress={() => open(waLink(m.phone, `Bonjour ${first(m.name)}, ça fait ${daysAbsent(m)} jours qu’on ne t’a pas vu au club. Tout va bien ? On t’attend pour reprendre l’entraînement 💪`))}
                accessibilityRole="button"
                accessibilityLabel={`Relancer ${m.name} sur WhatsApp`}
                style={styles.wa}
              >
                <Icon name="logo-whatsapp" size={18} color={colors.whatsappDark} />
                <Text style={styles.waText}>Relancer</Text>
              </Pressable>
            </Row>
          ))}
          {absent.length > 4 && (
            <Pressable onPress={() => setShowAllAbsent(v => !v)} accessibilityRole="button" style={styles.more}>
              <Text style={styles.moreText}>{showAllAbsent ? 'Réduire' : `Voir les ${absent.length} membres`}</Text>
            </Pressable>
          )}

          {/* Memberships */}
          <Text style={styles.h}>
            Abonnements à renouveler <Text style={styles.count}>({expiring.length})</Text>
          </Text>
          {expiring.length === 0 && <Text style={styles.empty}>Aucun abonnement n’expire dans les 14 jours.</Text>}
          {expiring.map(m => {
            const left = daysLeft(m);
            const expired = left < 0;
            return (
              <Row key={m.id} m={m} sub={expired ? `Expiré depuis ${-left} j` : left === 0 ? 'Expire aujourd’hui' : `Expire dans ${left} j`} subColor={expired ? colors.red.text : colors.amber.text}>
                <Pressable
                  onPress={() => open(waLink(m.phone, `Bonjour ${first(m.name)}, ton abonnement ${expired ? 'a expiré' : `expire dans ${left} jours`}. Passe à l’accueil pour le renouveler, on garde ta place 🙂`))}
                  accessibilityRole="button"
                  accessibilityLabel={`Rappeler ${m.name}`}
                  style={styles.waIcon}
                >
                  <Icon name="logo-whatsapp" size={20} color={colors.whatsappDark} />
                </Pressable>
                {confirmRenew === m.id ? (
                  <Pressable
                    onPress={() => {
                      onMembersChange(members.map(x => (x.id === m.id ? renew(x) : x)));
                      // Logged so the growth card counts real money instead of guessing.
                      ClubService.logRenewal({ memberId: m.id, at: new Date().toISOString(), days: 30, priceMillimes: monthlyPriceMillimes });
                      onRenewed?.();
                      setConfirmRenew(null);
                    }}
                    accessibilityRole="button"
                    style={[styles.renew, { backgroundColor: colors.text }]}
                  >
                    <Text style={[styles.renewText, { color: colors.onInverse }]}>Confirmer</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setConfirmRenew(m.id)} accessibilityRole="button" style={styles.renew}>
                    <Text style={styles.renewText}>+30 j</Text>
                  </Pressable>
                )}
              </Row>
            );
          })}

          {/* Settings */}
          <Text style={styles.h}>Réglages</Text>
          <Pressable onPress={onOpenSettings} accessibilityRole="button" style={styles.setting}>
            <Icon name="time-outline" size={22} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Nom, horaires et capacité</Text>
              <Text style={styles.settingSub}>{floor ? `${floor.openingHour}:00 – ${floor.closingHour}:00 · ${fmt(floor.maxGymCapacity)} personnes` : ''}</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={onOpenEntryQr} accessibilityRole="button" style={styles.setting}>
            <Icon name="qr-code-outline" size={22} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>QR d’entrée du club</Text>
              <Text style={styles.settingSub}>À imprimer et afficher à l’accueil</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={onOpenInfos} accessibilityRole="button" style={styles.setting}>
            <Icon name="megaphone-outline" size={22} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Infos du club</Text>
              <Text style={styles.settingSub}>Aïd, Iftar, fermetures, événements</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={onOpenPermissions} accessibilityRole="button" style={styles.setting}>
            <Icon name="key-outline" size={22} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Permissions</Text>
              <Text style={styles.settingSub}>Donne des droits ponctuels à un membre</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </SheetScrollView>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  h: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 22, marginBottom: 10 },
  count: { color: colors.textMuted, fontWeight: '700' },
  empty: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  bold: { fontWeight: '800', color: colors.text },

  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { width: '48%', flexGrow: 1, alignItems: 'flex-start', gap: 2, padding: 14, borderRadius: 16, backgroundColor: colors.bg },
  kpiAlert: { backgroundColor: colors.amber.soft },
  kpiValue: { fontSize: 28, fontWeight: '900', color: colors.text },
  kpiLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },

  chartCard: { padding: 12, borderRadius: 18, backgroundColor: colors.bg },
  insight: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12 },
  insightText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.textSecondary },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.track },
  name: { fontSize: 15, fontWeight: '800', color: colors.text },
  rowSub: { fontSize: 13, fontWeight: '700', marginTop: 1 },
  wa: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: colors.whatsapp },
  waText: { fontSize: 14, fontWeight: '800', color: colors.whatsapp },
  waIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.whatsapp, alignItems: 'center', justifyContent: 'center' },
  renew: { height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  renewText: { fontSize: 14, fontWeight: '800', color: colors.text },
  more: { height: 44, justifyContent: 'center' },
  moreText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },

  setting: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.bg, marginBottom: 10 },
  settingTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  settingSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
});
