import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { Icon } from '../../ui/Icon';
import { Community, MurPost } from '../../../community/murService';
import { clubTheme, communityTint, colors, fonts, radius } from '../../../theme';

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
      {/* header: who, where, when */}
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
            <Text style={styles.author} numberOfLines={1}>{official ? clubTheme.clubName : p.anonymous ? 'Membre anonyme' : p.author}</Text>
            {official && <View style={[styles.bdg, { backgroundColor: colors.brandSoft }]}><Text style={[styles.bdgText, { color: colors.brandText }]}>Officiel</Text></View>}
          </View>
          <Text style={styles.ago} numberOfLines={1}>
            dans <Text style={styles.whyBold}>{c.name}</Text> · {p.ago}
          </Text>
        </View>
        {p.kind === 'question' && (
          <View style={[styles.bdg, { backgroundColor: colors.blue.soft }]}><Text style={[styles.bdgText, { color: colors.blue.text }]}>Question</Text></View>
        )}
      </View>

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
            {!!p.delta && <View style={[styles.bdg, { backgroundColor: colors.track }]}><Text style={[styles.bdgText, { color: colors.text }]}>{p.delta}</Text></View>}
          </View>
        </>
      )}

      {official && !!p.media && (
        <View style={styles.media}>
          <Text style={styles.mediaText}>{p.media}</Text>
        </View>
      )}

      {/* a coach's answer to a question */}
      {p.answer && (
        <View style={styles.answer}>
          <View style={styles.answerHead}>
            <Icon name="shield-checkmark-outline" size={16} color={colors.brandText} />
            <Text style={styles.answerBy}>Répondu par {p.answer.by}</Text>
          </View>
          <Text style={styles.answerText}>{p.answer.text}</Text>
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
        <Pressable
          onPress={onLike}
          accessibilityRole="button"
          accessibilityLabel={`${isReaction ? 'Féliciter' : "J'aime"}, ${n}`}
          accessibilityState={{ selected: liked }}
          hitSlop={6}
          style={styles.act}
        >
          <Icon name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? colors.brand : colors.textSecondary} />
          <Text style={[styles.actText, liked && { color: colors.brandText }]}>{isReaction ? `Féliciter · ${n}` : n}</Text>
        </Pressable>
        <Pressable onPress={onReply} accessibilityRole="button" accessibilityLabel={p.kind === 'question' ? 'Répondre' : 'Commenter'} hitSlop={6} style={styles.act}>
          <Icon name="chatbubble-outline" size={19} color={colors.textSecondary} />
          <Text style={styles.actText}>
            {p.kind === 'question' ? 'Répondre' : 'Commenter'}
            {nComments ? ` · ${nComments}` : ''}
          </Text>
        </Pressable>
        {canManage && (
          <Pressable onPress={onHide} accessibilityRole="button" hitSlop={6} style={[styles.act, { marginLeft: 'auto' }]}>
            <Text style={styles.modText}>Masquer</Text>
          </Pressable>
        )}
        {/* Hiding one post is not always enough: removing the person is the other half. */}
        {canManage && canBan && onBan && (
          <Pressable onPress={onBan} accessibilityRole="button" accessibilityLabel="Retirer ce membre de la communauté" hitSlop={6} style={styles.act}>
            <Text style={[styles.modText, { color: colors.red.text }]}>Retirer</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: 18, gap: 12 },
  whyBold: { fontWeight: '700', color: colors.textSecondary },
  ph: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  av: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avText: { fontWeight: '800', fontSize: 15 },
  avOfficial: { backgroundColor: colors.brand, overflow: 'hidden' },
  avMark: { width: 30, height: 30 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  author: { flexShrink: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  ago: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  bdg: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  bdgText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  text: { fontSize: 15, fontWeight: '500', color: colors.text, lineHeight: 22 },
  rec: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  recKg: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 44, lineHeight: 46, color: colors.text },
  recSub: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  media: { height: 150, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  mediaText: { fontFamily: fonts.heading, fontWeight: 'normal', textTransform: 'uppercase', color: colors.brandText, fontSize: 26 },
  answer: { backgroundColor: colors.brandSoft, borderRadius: 16, padding: 14, gap: 6 },
  answerHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  answerBy: { fontSize: 13, fontWeight: '800', color: colors.brandText },
  answerText: { fontSize: 14, color: colors.text, lineHeight: 21 },
  lastComment: { backgroundColor: colors.bg, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  lastCommentText: { fontSize: 13, lineHeight: 19, color: colors.text },
  lastCommentName: { fontWeight: '800' },
  moreComments: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  acts: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 2 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 32 },
  actText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  modText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
});
