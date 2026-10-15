import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { CommunityPost, MemberProfile } from '../../types/database';
import { colors } from '../../theme';
import { isPR, postImages } from '../../services/communityService';
import { BottomSheet, SheetScrollView } from '../home/BottomSheet';
import { ProductImage } from '../shop/ProductImage';
import { SocialRow } from './SocialRow';
import { Avatar, CoachBadge } from './Avatar';

// ---------- Profile (view) ----------

interface ProfileProps {
  userId: string | null;
  isMe: boolean;
  profiles: Record<string, MemberProfile>;
  posts: CommunityPost[];
  onClose: () => void;
  onEdit: () => void;
  onOpenPost: (post: CommunityPost) => void;
}

const Stat: React.FC<{ value: number; label: string; gold?: boolean }> = ({ value, label, gold }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, gold && { color: colors.gold.deep }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Tile: React.FC<{ post: CommunityPost; onPress: () => void }> = ({ post, onPress }) => {
  const img = postImages(post)[0];
  const pr = isPR(post) && post.prDetails;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Ouvrir la publication" style={styles.tile}>
      {img ? (
        <ProductImage uri={img} style={StyleSheet.absoluteFill as any} iconSize={24} />
      ) : pr ? (
        <View style={[styles.tileFill, { backgroundColor: colors.gold.bg }]}>
          <Ionicons name="trophy" size={20} color={colors.gold.deep} />
          <Text style={[styles.tileBig, { color: colors.gold.text }]}>{pr.weightKg} kg</Text>
          <Text style={[styles.tileSmall, { color: colors.gold.deep }]} numberOfLines={1}>
            {pr.exercise}
          </Text>
        </View>
      ) : post.category === 'question' ? (
        <View style={[styles.tileFill, { backgroundColor: colors.brandSoft }]}>
          <Ionicons name="help-circle" size={22} color={colors.brandDark} />
          <Text style={[styles.tileSmall, { color: colors.brandDark }]} numberOfLines={3}>
            {post.caption}
          </Text>
        </View>
      ) : (
        <View style={[styles.tileFill, { backgroundColor: colors.track }]}>
          <Text style={[styles.tileSmall, { color: colors.textSecondary }]} numberOfLines={4}>
            {post.caption}
          </Text>
        </View>
      )}
      {pr && img && (
        <View style={styles.tileGold}>
          <Ionicons name="trophy" size={12} color={colors.gold.text} />
        </View>
      )}
      {postImages(post).length > 1 && (
        <View style={styles.tileMulti}>
          <Ionicons name="copy" size={12} color={colors.white} />
        </View>
      )}
    </Pressable>
  );
};

export const ProfileSheet: React.FC<ProfileProps> = ({ userId, isMe, profiles, posts, onClose, onEdit, onOpenPost }) => {
  // keep content while the sheet slides out
  const [id, setId] = useState<string | null>(userId);
  useEffect(() => {
    if (userId) setId(userId);
  }, [userId]);

  const profile = id ? profiles[id] : undefined;
  const mine = id ? posts.filter(p => p.userId === id) : [];
  const validated = mine.filter(p => isPR(p) && p.prApproval?.status === 'approved');
  const likes = mine.reduce((s, p) => s + p.likesCount, 0);
  const name = profile?.name ?? mine[0]?.userName ?? 'Membre';

  return (
    <BottomSheet visible={!!userId} onClose={onClose} snaps={[0.65, 0.94]}>
      {(_e, extraBottom) => (
        <SheetScrollView contentContainerStyle={{ paddingBottom: 32 + extraBottom }} showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            <Avatar name={name} url={profile?.avatarUrl} size={92} gold={validated.length > 0} />
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                {profile?.role === 'coach' && <CoachBadge />}
              </View>
              {profile?.role === 'owner' && <Text style={styles.role}>Propriétaire du club</Text>}
              <View style={styles.stats}>
                <Stat value={mine.length} label="Posts" />
                <Stat value={validated.length} label="Records validés" gold />
                <Stat value={likes} label="J’aime" />
              </View>
            </View>
          </View>

          <View style={styles.pad}>
            {!!profile?.bio ? (
              <Text style={styles.bio}>{profile.bio}</Text>
            ) : isMe ? (
              <Text style={[styles.bio, { color: colors.textMuted }]}>Ajoute une photo et une bio pour te présenter aux autres membres.</Text>
            ) : null}

            {/* Whatever this member chose to share. Nothing shows if he shared nothing. */}
            <SocialRow socials={profile?.socials} />

            {isMe && (
              <Pressable onPress={onEdit} accessibilityRole="button" style={styles.editBtn}>
                <Ionicons name="create-outline" size={18} color={colors.text} />
                <Text style={styles.editText}>Modifier le profil</Text>
              </Pressable>
            )}

            {validated.length > 0 && (
              <>
                <Text style={styles.section}>Records validés par les coachs</Text>
                <SheetScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {validated.map(p => (
                    <View key={p.id} style={styles.medalChip}>
                      <Ionicons name="shield-checkmark" size={16} color={colors.gold.ink} />
                      <Text style={styles.medalText}>
                        {p.prDetails!.exercise} · {p.prDetails!.weightKg} kg
                      </Text>
                    </View>
                  ))}
                </SheetScrollView>
              </>
            )}

            <Text style={styles.section}>Publications</Text>
            {mine.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="images-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyText}>Aucune publication pour l’instant</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {mine.map(p => (
                  <Tile key={p.id} post={p} onPress={() => onOpenPost(p)} />
                ))}
              </View>
            )}
          </View>
        </SheetScrollView>
      )}
    </BottomSheet>
  );
};


const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 20, paddingTop: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, flexShrink: 1 },
  role: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 16, marginTop: 10 },
  stat: { alignItems: 'flex-start' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

  pad: { paddingHorizontal: 20 },
  bio: { fontSize: 15, lineHeight: 22, color: colors.text, marginTop: 14 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.text,
    marginTop: 14,
  },
  editText: { fontSize: 14, fontWeight: '800', color: colors.text },
  section: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 20, marginBottom: 10 },
  medalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: colors.gold.bar,
  },
  medalText: { fontSize: 13, fontWeight: '800', color: colors.gold.ink },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tile: { width: '32.6%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.track },
  tileFill: { flex: 1, padding: 8, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tileBig: { fontSize: 18, fontWeight: '900' },
  tileSmall: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  tileGold: { position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.gold.bar, alignItems: 'center', justifyContent: 'center' },
  tileMulti: { position: 'absolute', top: 6, right: 6 },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 15, color: colors.textMuted },
});
