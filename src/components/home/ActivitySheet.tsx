import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { CommunityPost, MemberProfile } from '../../types/database';
import { colors } from '../../theme';
import { ActivityEvent, isPR, postImages, timeAgoFr } from '../../services/communityService';
import { Avatar } from '../community/Avatar';
import { ProductImage } from '../shop/ProductImage';
import { BottomSheet, SheetScrollView } from './BottomSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  events: ActivityEvent[]; // already filtered: events on MY posts by OTHER members
  /** Timestamp of the last time the sheet was opened (before this opening) → "Nouveau" section. */
  seenAt: number;
  posts: CommunityPost[];
  profiles: Record<string, MemberProfile>;
  onOpenPost: (postId: string) => void;
}

type Row =
  | { kind: 'like'; key: string; postId: string; actors: string[]; actorIds: string[]; at: string; unread: boolean }
  | { kind: 'comment'; key: string; postId: string; actor: string; actorId: string; text: string; at: string; unread: boolean }
  | { kind: 'validated'; key: string; postId: string; actor: string; actorId: string; at: string; unread: boolean };

const Bold: React.FC<{ children: React.ReactNode }> = ({ children }) => <Text style={styles.bold}>{children}</Text>;

const buildRows = (events: ActivityEvent[], seenAt: number): Row[] => {
  const rows: Row[] = [];
  const likes = new Map<string, Extract<Row, { kind: 'like' }>>();
  [...events]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .forEach(e => {
      const unread = new Date(e.createdAt).getTime() > seenAt;
      if (e.type === 'like') {
        const g = likes.get(e.postId);
        if (g) {
          if (!g.actorIds.includes(e.actorId)) {
            g.actors.push(e.actorName);
            g.actorIds.push(e.actorId);
          }
          g.unread = g.unread || unread;
        } else {
          const row: Extract<Row, { kind: 'like' }> = { kind: 'like', key: 'l-' + e.postId, postId: e.postId, actors: [e.actorName], actorIds: [e.actorId], at: e.createdAt, unread };
          likes.set(e.postId, row);
          rows.push(row);
        }
      } else if (e.type === 'comment') {
        rows.push({ kind: 'comment', key: e.id, postId: e.postId, actor: e.actorName, actorId: e.actorId, text: e.text ?? '', at: e.createdAt, unread });
      } else {
        rows.push({ kind: 'validated', key: e.id, postId: e.postId, actor: e.actorName, actorId: e.actorId, at: e.createdAt, unread });
      }
    });
  return rows.sort((a, b) => b.at.localeCompare(a.at));
};

const BADGE = {
  like: { icon: 'heart', bg: colors.red.bar },
  comment: { icon: 'chatbubble', bg: colors.brand },
  validated: { icon: 'shield-checkmark', bg: colors.gold.bar },
} as const;

const Thumb: React.FC<{ post?: CommunityPost }> = ({ post }) => {
  if (!post) return <View style={styles.thumb} />;
  const img = postImages(post)[0];
  if (img) return <ProductImage uri={img} style={styles.thumb} iconSize={18} />;
  if (isPR(post))
    return (
      <View style={[styles.thumb, { backgroundColor: colors.gold.soft, alignItems: 'center', justifyContent: 'center' }]}>
        <Icon name="trophy" size={20} color={colors.gold.deep} />
      </View>
    );
  return (
    <View style={[styles.thumb, { backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' }]}>
      <Icon name={post.category === 'question' ? 'help-circle-outline' : 'chatbubble-ellipses-outline'} size={20} color={colors.textMuted} />
    </View>
  );
};

/** Instagram-like "Activité": who liked / commented on your Wall posts, and record validations. */
export const ActivitySheet: React.FC<Props> = ({ visible, onClose, events, seenAt, posts, profiles, onOpenPost }) => {
  const rows = useMemo(() => buildRows(events, seenAt), [events, seenAt]);
  const fresh = rows.filter(r => r.unread);
  const older = rows.filter(r => !r.unread);
  const postOf = (id: string) => posts.find(p => p.id === id);

  const renderRow = (r: Row) => {
    const actorId = r.kind === 'like' ? r.actorIds[0] : r.actorId;
    const actor = r.kind === 'like' ? r.actors[0] : r.actor;
    const post = postOf(r.postId);
    const badge = BADGE[r.kind];

    let content: React.ReactNode;
    if (r.kind === 'like') {
      const [a, b] = r.actors;
      const others = r.actors.length - 2;
      content =
        r.actors.length === 1 ? (
          <>
            <Bold>{a}</Bold> a aimé ta publication.
          </>
        ) : r.actors.length === 2 ? (
          <>
            <Bold>{a}</Bold> et <Bold>{b}</Bold> ont aimé ta publication.
          </>
        ) : (
          <>
            <Bold>{a}</Bold>, <Bold>{b}</Bold> et {others} autre{others > 1 ? 's' : ''} ont aimé ta publication.
          </>
        );
    } else if (r.kind === 'comment') {
      content = (
        <>
          <Bold>{r.actor}</Bold> {post?.category === 'question' ? 'a répondu à ta question' : 'a commenté'} : « {r.text} »
        </>
      );
    } else {
      content = (
        <>
          <Bold>{r.actor}</Bold> a validé ton record. Le badge doré est à toi.
        </>
      );
    }

    return (
      <Pressable
        key={r.key}
        onPress={() => onOpenPost(r.postId)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, r.unread && styles.rowUnread, pressed && { opacity: 0.7 }]}
      >
        <View>
          <Avatar name={actor} url={profiles[actorId]?.avatarUrl} size={44} />
          <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
            <Icon name={badge.icon as any} size={11} color={colors.white} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowText} numberOfLines={3}>
            {content}
          </Text>
          <Text style={styles.time}>{timeAgoFr(r.at)}</Text>
        </View>
        <Thumb post={post} />
        {r.unread && <View style={styles.dot} />}
      </Pressable>
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.6, 0.94]}
      header={
        <Text style={styles.title} accessibilityRole="header">
          Activité
        </Text>
      }
    >
      {(_e, extraBottom) => (
        <SheetScrollView contentContainerStyle={{ paddingBottom: 32 + extraBottom }} showsVerticalScrollIndicator={false}>
          {rows.length === 0 && (
            <View style={styles.empty}>
              <Icon name="heart-outline" size={46} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Pas encore d’activité</Text>
              <Text style={styles.emptySub}>Publie sur le Mur : les j’aime, commentaires et validations de records apparaîtront ici.</Text>
            </View>
          )}

          {fresh.length > 0 && (
            <>
              <Text style={styles.section}>Nouveau</Text>
              {fresh.map(renderRow)}
            </>
          )}
          {older.length > 0 && (
            <>
              <Text style={styles.section}>{fresh.length > 0 ? 'Plus tôt' : 'Récent'}</Text>
              {older.map(renderRow)}
            </>
          )}
        </SheetScrollView>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  section: { fontSize: 15, fontWeight: '800', color: colors.text, paddingHorizontal: 20, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  rowUnread: { backgroundColor: colors.brandSoft },
  typeBadge: { position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  rowText: { fontSize: 14, lineHeight: 20, color: colors.text },
  bold: { fontWeight: '800' },
  time: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  thumb: { width: 46, height: 46, borderRadius: 10, backgroundColor: colors.track },
  dot: { position: 'absolute', right: 8, top: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textSecondary },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
