import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { Icon } from '../../ui/Icon';
import { Community, MurPost } from '../../../community/murService';
import { clubTheme, communityTint, colors } from '../../../theme';

interface Props {
  post: MurPost;
  community: Community;
  liked: boolean;
  canManage: boolean;
  onLike: () => void;
  onReply: () => void;
  onHide: () => void;
  /** True when the viewer outranks this post's author; false hides the action. */
  canBan?: boolean;
  onBan?: () => void;
}

export const MurPostCard: React.FC<Props> = ({ post: p, community: c, liked, canManage, onLike, onReply, onHide, canBan, onBan }) => {
  const tint = communityTint(c.color);
  const n = p.likes + (liked ? 1 : 0);
  const isReaction = p.kind === 'record';
  const official = p.kind === 'official';
  const nComments = p.comments?.length ?? 0;
  const lastComment = nComments ? p.comments![nComments - 1] : null;

  return (
    <View style={styles.card}>
      {/* why */}
      <Text style={styles.why}>
        dans <Text style={[styles.whyBold, { color: tint.bar }]}>{c.name}</Text>
        {official ? '' : ' · parce que tu en fais partie'}
      </Text>

      {/* header */}
      <View style={styles.ph}>
        {official ? (
          <View style={[styles.av, styles.avOfficial]}>
            <Image source={clubTheme.mark} style={styles.avMark} resizeMode="contain" accessibilityLabel={clubTheme.clubName} />
          </View>
        ) : (
          <View style={[styles.av, p.anonymous ? { backgroundColor: colors.track } : { backgroundColor: tint.soft }]}>
            <Text style={[styles.avText, p.anonymous ? { color: colors.textMuted } : { color: tint.bar }]}>{p.init}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text style={styles.author}>{official ? clubTheme.clubName : p.anonymous ? 'Membre anonyme' : p.author}</Text>
            {official && <View style={[styles.bdg, { backgroundColor: communityTint('accent').soft }]}><Text style={[styles.bdgText, { color: colors.brand }]}>Officiel</Text></View>}
          </View>
          <Text style={styles.ago}>{p.ago}</Text>
        </View>
      </View>

      {/* question badges */}
      {p.kind === 'question' && (
        <View style={styles.badges}>
          <View style={[styles.bdg, { backgroundColor: communityTint('accent').soft }]}><Text style={[styles.bdgText, { color: colors.brand }]}>Question</Text></View>
          {p.answer && <View style={[styles.bdg, { backgroundColor: colors.green.soft }]}><Text style={[styles.bdgText, { color: colors.green.text }]}>Répondu par un coach</Text></View>}
        </View>
      )}

      {!!p.text && <Text style={styles.text}>{p.text}</Text>}

      {/* body */}
      {p.kind === 'record' && (
        <>
          <View style={styles.rec}>
            <Text style={styles.recKg}>{p.kg} kg</Text>
            <Text style={styles.recSub}>× {p.reps} reps · {p.lift}</Text>
          </View>
          <View style={styles.badges}>
            <View style={[styles.bdg, { backgroundColor: colors.green.soft }]}><Text style={[styles.bdgText, { color: colors.green.text }]}>Validé par {p.validatedBy}</Text></View>
            {!!p.delta && <View style={[styles.bdg, { backgroundColor: colors.gold.soft }]}><Text style={[styles.bdgText, { color: colors.gold.deep }]}>{p.delta}</Text></View>}
          </View>
        </>
      )}

      {official && !!p.media && (
        <View style={styles.media}>
          <Text style={styles.mediaText}>{p.media}</Text>
        </View>
      )}

      {p.answer && (
        <View style={styles.answer}>
          <Text style={styles.answerText}><Text style={styles.answerBy}>{p.answer.by} : </Text>{p.answer.text}</Text>
        </View>
      )}

      {/* latest comment, tap to open the thread */}
      {lastComment && (
        <Pressable onPress={onReply} accessibilityRole="button" accessibilityLabel={`Voir les ${nComments} commentaires`} style={styles.lastComment}>
          <Text style={styles.lastCommentText} numberOfLines={2}>
            <Text style={styles.lastCommentName}>{lastComment.author} </Text>
            {lastComment.text}
          </Text>
          {nComments > 1 && <Text style={styles.moreComments}>Voir les {nComments} commentaires</Text>}
        </Pressable>
      )}

      {/* actions */}
      <View style={styles.acts}>
        <Pressable onPress={onLike} accessibilityRole="button" style={[styles.act, styles.actRow, liked && styles.actOn]}>
          <Icon name="heart" size={14} color={liked ? colors.gold.deep : colors.textMuted} />
          <Text style={[styles.actText, liked && { color: colors.gold.deep }]}>{isReaction ? 'Féliciter' : "J'aime"} · {n}</Text>
        </Pressable>
        <Pressable onPress={onReply} accessibilityRole="button" accessibilityLabel={p.kind === 'question' ? 'Répondre' : 'Commenter'} style={[styles.act, styles.actRow]}>
          <Icon name="chatbubble-outline" size={14} color={colors.textMuted} />
          <Text style={styles.actText}>
            {p.kind === 'question' ? 'Répondre' : 'Commenter'}
            {nComments ? ` · ${nComments}` : ''}
          </Text>
        </Pressable>
        {canManage && (
          <Pressable onPress={onHide} accessibilityRole="button" style={[styles.act, { marginLeft: 'auto' }]}>
            <Text style={styles.actText}>Masquer</Text>
          </Pressable>
        )}
        {/* Hiding one post is not always enough: removing the person is the other half. */}
        {canManage && canBan && onBan && (
          <Pressable onPress={onBan} accessibilityRole="button" accessibilityLabel="Retirer ce membre de la communauté" style={styles.act}>
            <Text style={[styles.actText, { color: colors.red.text }]}>Retirer</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 14, gap: 10, shadowColor: colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2 },
  why: { fontSize: 11, color: colors.textMuted },
  whyBold: { fontWeight: '800' },
  ph: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  av: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avText: { fontWeight: '800', fontSize: 14 },
  avOfficial: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  avMark: { width: 30, height: 30 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  author: { fontSize: 14, fontWeight: '800', color: colors.text },
  ago: { fontSize: 12, color: colors.textMuted },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  bdg: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  bdgText: { fontSize: 11, fontWeight: '800' },
  text: { fontSize: 14, color: colors.text, lineHeight: 20 },
  rec: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  recKg: { fontSize: 40, lineHeight: 40, fontWeight: '800', color: colors.gold.deep },
  recSub: { fontSize: 13, color: colors.textMuted, fontWeight: '700' },
  media: { height: 150, borderRadius: 14, backgroundColor: communityTint('accent').soft, alignItems: 'center', justifyContent: 'center' },
  mediaText: { color: colors.brand, fontWeight: '800', fontSize: 22 },
  answer: { borderLeftWidth: 3, borderLeftColor: colors.green.bar, backgroundColor: colors.green.soft, borderTopRightRadius: 12, borderBottomRightRadius: 12, padding: 10 },
  answerText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  answerBy: { color: colors.green.text, fontWeight: '800' },
  lastComment: { backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
  lastCommentText: { fontSize: 13, lineHeight: 18, color: colors.text },
  lastCommentName: { fontWeight: '800' },
  moreComments: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  acts: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  act: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actOn: { backgroundColor: colors.gold.soft, borderColor: 'transparent' },
  actText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
});
