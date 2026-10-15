import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { CommunityPost, MemberProfile, UserProfile } from '../../types/database';
import { card, colors, ink } from '../../theme';
import { postImages, timeAgoFr } from '../../services/communityService';
import { ProductImage } from '../shop/ProductImage';
import { Avatar, CoachBadge } from './Avatar';

export interface PostCardProps {
  post: CommunityPost;
  profiles: Record<string, MemberProfile>;
  me: UserProfile;
  liked: boolean;
  canApprove: boolean;
  onLike: () => void;
  onDelete: () => void;
  onOpenProfile: (userId: string) => void;
  onOpenComments: (post: CommunityPost) => void;
  onApprove: (post: CommunityPost) => void;
  onToggleResolved: (post: CommunityPost) => void;
  isOwner: boolean;
  reported: boolean;
  onEdit: (post: CommunityPost, caption: string) => void;
  onHide: (post: CommunityPost) => void;
  onReport: (post: CommunityPost) => void;
  /** Author-only: turn commenting on this post on/off. */
  onToggleComments: (post: CommunityPost) => void;
  /** Author-only: hide/show the like count from other members. */
  onToggleLikesHidden: (post: CommunityPost) => void;
}

// ---------- Shared bits ----------

/** Heart with a pop animation. */
const HeartButton: React.FC<{ liked: boolean; count: number; label: string; onPress: () => void; text?: string }> = ({
  liked,
  count,
  label,
  onPress,
  text,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (liked) {
      scale.setValue(0.6);
      Animated.spring(scale, { toValue: 1, damping: 5, stiffness: 260, useNativeDriver: true }).start();
    }
  }, [liked, scale]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon name={liked ? 'heart' : 'heart-outline'} size={24} color={liked ? colors.red.bar : colors.text} />
      </Animated.View>
      <Text style={[styles.actionText, liked && { color: colors.red.text }]}>{text ?? count}</Text>
    </Pressable>
  );
};

const AuthorRow: React.FC<{
  post: CommunityPost;
  author?: MemberProfile;
  isMine: boolean;
  gold?: boolean;
  sub: string;
  onOpenProfile: () => void;
  right?: React.ReactNode;
}> = ({ post, author, isMine, gold, sub, onOpenProfile, right }) => (
  <View style={styles.authorRow}>
    <Pressable onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel={`Profil de ${post.userName}`} style={styles.authorLeft}>
      <Avatar name={post.userName} url={author?.avatarUrl} size={40} gold={gold} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {post.userName}
          </Text>
          {author?.role === 'coach' && <CoachBadge />}
          {isMine && <Text style={styles.you}>Toi</Text>}
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </Pressable>
    {right}
  </View>
);

/** Swipeable photos. Double-tap = like (with a big heart). */
const MediaCarousel: React.FC<{ images: string[]; onDoubleTap: () => void }> = ({ images, onDoubleTap }) => {
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  const last = useRef(0);
  const heart = useRef(new Animated.Value(0)).current;

  const tap = () => {
    const now = Date.now();
    if (now - last.current < 300) {
      onDoubleTap();
      heart.setValue(0);
      Animated.sequence([
        Animated.spring(heart, { toValue: 1, damping: 6, stiffness: 220, useNativeDriver: true }),
        Animated.delay(250),
        Animated.timing(heart, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    last.current = now;
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (w > 0) setIdx(Math.round(e.nativeEvent.contentOffset.x / w));
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={styles.media}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
        {images.map((u, i) => (
          <Pressable key={i} onPress={tap} accessibilityLabel="Photo de la publication (double-touche pour aimer)">
            <ProductImage uri={u} iconSize={48} style={{ width: w || 320, height: w || 320 }} />
          </Pressable>
        ))}
      </ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[styles.bigHeart, { opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.1] }) }] }]}
      >
        <Icon name="heart" size={96} color={colors.white} />
      </Animated.View>

      {images.length > 1 && (
        <>
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {idx + 1}/{images.length}
            </Text>
          </View>
          <View style={styles.dots}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === idx && styles.dotOn]} />
            ))}
          </View>
        </>
      )}
    </View>
  );
};

// ---------- Record card (golden, compact) ----------

const RecordCard: React.FC<PostCardProps> = ({ post, profiles, me, liked, canApprove, onLike, onOpenProfile, onOpenComments, onApprove }) => {
  const d = post.prDetails!;
  const author = profiles[post.userId];
  const approved = post.prApproval?.status === 'approved';
  const delta = d.prevWeightKg ? d.weightKg - d.prevWeightKg : 0;
  const isMine = post.userId === me.id;
  const [confirming, setConfirming] = useState(false);
  const comments = post.comments?.length ?? 0;
  const images = postImages(post);

  return (
    <View style={[styles.gold, approved && styles.goldApproved]}>
      <View style={styles.goldTop}>
        {/* medal */}
        <View style={[styles.medal, !approved && styles.medalPending]}>
          <Icon name="trophy" size={22} color={approved ? colors.gold.ink : colors.gold.deep} />
          {approved && (
            <View style={styles.medalCheck}>
              <Icon name="checkmark" size={11} color={colors.white} />
            </View>
          )}
        </View>

        <Pressable onPress={() => onOpenProfile(post.userId)} accessibilityRole="button" style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text style={styles.goldName} numberOfLines={1}>
              {post.userName}
            </Text>
            {author?.role === 'coach' && <CoachBadge />}
            {isMine && <Text style={styles.goldYou}>Toi</Text>}
          </View>
          <Text style={styles.goldExercise} numberOfLines={1}>
            {d.exercise} · {timeAgoFr(post.createdAt)}
          </Text>
        </Pressable>

        <View style={styles.goldWeightCol}>
          <Text style={styles.goldWeight}>
            {d.weightKg}
            <Text style={styles.goldUnit}> kg</Text>
          </Text>
          <Text style={styles.goldReps}>× {d.reps} rep{d.reps > 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* status chips */}
      <View style={styles.goldChips}>
        {approved ? (
          <View style={styles.sealChip}>
            <Icon name="shield-checkmark" size={15} color={colors.gold.text} />
            <Text style={styles.sealText}>Validé par {post.prApproval?.approvedByName ?? 'un coach'}</Text>
          </View>
        ) : (
          <View style={styles.pendingChip}>
            <Icon name="hourglass-outline" size={14} color={colors.gold.text} />
            <Text style={styles.pendingText}>En attente de validation</Text>
          </View>
        )}
        {delta > 0 && (
          <View style={styles.deltaChip}>
            <Icon name="trending-up" size={14} color={colors.green.text} />
            <Text style={styles.deltaText}>+{delta} kg</Text>
          </View>
        )}
      </View>

      {!!post.caption && (
        <Text style={styles.goldCaption} numberOfLines={2}>
          {post.caption}
        </Text>
      )}

      {images.length > 0 && <ProductImage uri={images[0]} style={styles.goldProof} iconSize={28} />}

      <View style={styles.goldFooter}>
        <Pressable
          onPress={onLike}
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          accessibilityLabel="Féliciter"
          style={({ pressed }) => [styles.congrats, liked && styles.congratsOn, pressed && { opacity: 0.8 }]}
        >
          <Icon name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? colors.gold.ink : colors.gold.text} />
          <Text style={[styles.congratsText, liked && { color: colors.gold.ink }]}>
            {liked ? 'Félicité' : 'Féliciter'} · {post.likesCount}
          </Text>
        </Pressable>

        <Pressable onPress={() => onOpenComments(post)} accessibilityRole="button" accessibilityLabel="Commentaires" style={styles.goldIconBtn}>
          <Icon name="chatbubble-outline" size={20} color={colors.gold.text} />
          <Text style={styles.goldIconText}>{comments}</Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        {canApprove && !approved && !isMine &&
          (confirming ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable onPress={() => setConfirming(false)} accessibilityRole="button" style={styles.smallGhost}>
                <Text style={styles.smallGhostText}>Annuler</Text>
              </Pressable>
              <Pressable onPress={() => onApprove(post)} accessibilityRole="button" style={styles.validateBtn}>
                <Icon name="checkmark" size={16} color={colors.gold.ink} />
                <Text style={styles.validateText}>Confirmer</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setConfirming(true)} accessibilityRole="button" style={styles.validateBtn}>
              <Icon name="shield-checkmark-outline" size={16} color={colors.gold.ink} />
              <Text style={styles.validateText}>Valider</Text>
            </Pressable>
          ))}
      </View>
    </View>
  );
};

// ---------- Regular / question post ----------

const CATEGORY_LABEL: Record<string, string> = { workout: 'Séance', meal: 'Repas', question: 'Question', chat: 'Message' };

export const PostCard: React.FC<PostCardProps> = props => {
  const { post, profiles, me, liked, onLike, onDelete, onOpenProfile, onOpenComments, onToggleResolved } = props;
  const [confirming, setConfirming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.post.caption);

  if ((post.isPR || post.category === 'pr') && post.prDetails) return <RecordCard {...props} />;

  const author = profiles[post.userId];
  const isMine = post.userId === me.id;
  const images = postImages(post);
  const comments = post.comments ?? [];
  const isQuestion = post.category === 'question';
  const coachAnswered = comments.some(c => profiles[c.userId]?.role === 'coach');
  const label = post.category ? CATEGORY_LABEL[post.category] : undefined;

  const canModerate = props.isOwner && !isMine;
  const menu = confirming ? (
    <View style={styles.confirmRow}>
      <Pressable onPress={() => setConfirming(false)} accessibilityRole="button" style={styles.smallGhost}>
        <Text style={styles.smallGhostText}>Annuler</Text>
      </Pressable>
      <Pressable onPress={onDelete} accessibilityRole="button" style={styles.deleteBtn}>
        <Text style={styles.deleteText}>Supprimer</Text>
      </Pressable>
    </View>
  ) : (
    <Pressable onPress={() => setMenuOpen(o => !o)} accessibilityRole="button" accessibilityLabel="Plus d’options" style={styles.iconBtn}>
      <Icon name="ellipsis-horizontal" size={20} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <View style={styles.card}>
      <View style={styles.pad}>
        <AuthorRow
          post={post}
          author={author}
          isMine={isMine}
          sub={`${label && !isQuestion ? label + ' · ' : ''}${timeAgoFr(post.createdAt)}${props.isOwner && props.reported ? ' · signalée' : ''}`}
          onOpenProfile={() => onOpenProfile(post.userId)}
          right={menu}
        />

        {menuOpen && isMine && (
          <View style={styles.menuPanel}>
            <Pressable onPress={() => { setMenuOpen(false); setDraft(post.caption); setEditing(true); }} accessibilityRole="button" style={styles.menuItem}>
              <Icon name="create-outline" size={20} color={colors.text} />
              <Text style={styles.menuText}>Modifier</Text>
            </Pressable>
            <Pressable onPress={() => { setMenuOpen(false); props.onToggleComments(post); }} accessibilityRole="button" style={styles.menuItem}>
              <Icon name={post.commentsDisabled ? 'chatbubbles-outline' : 'chatbubble-ellipses-outline'} size={20} color={colors.text} />
              <Text style={styles.menuText}>{post.commentsDisabled ? 'Réactiver les commentaires' : 'Désactiver les commentaires'}</Text>
            </Pressable>
            <Pressable onPress={() => { setMenuOpen(false); props.onToggleLikesHidden(post); }} accessibilityRole="button" style={styles.menuItem}>
              <Icon name={post.likesHidden ? 'heart-outline' : 'eye-off-outline'} size={20} color={colors.text} />
              <Text style={styles.menuText}>{post.likesHidden ? 'Afficher le nombre de likes' : 'Masquer le nombre de likes'}</Text>
            </Pressable>
            <Pressable onPress={() => { setMenuOpen(false); setConfirming(true); }} accessibilityRole="button" style={styles.menuItem}>
              <Icon name="trash-outline" size={20} color={colors.red.text} />
              <Text style={[styles.menuText, { color: colors.red.text }]}>Supprimer</Text>
            </Pressable>
          </View>
        )}

        {menuOpen && !isMine && (
          <View style={styles.menuPanel}>
            <Pressable onPress={() => { setMenuOpen(false); props.onHide(post); }} accessibilityRole="button" style={styles.menuItem}>
              <Icon name="eye-off-outline" size={20} color={colors.text} />
              <Text style={styles.menuText}>Masquer cette publication</Text>
            </Pressable>
            <Pressable onPress={() => { setMenuOpen(false); props.onReport(post); }} disabled={props.reported} accessibilityRole="button" style={styles.menuItem}>
              <Icon name="flag-outline" size={20} color={props.reported ? colors.textMuted : colors.red.text} />
              <Text style={[styles.menuText, { color: props.reported ? colors.textMuted : colors.red.text }]}>{props.reported ? 'Déjà signalée au club' : 'Signaler au club'}</Text>
            </Pressable>
            {canModerate && (
              <Pressable onPress={() => { setMenuOpen(false); setConfirming(true); }} accessibilityRole="button" style={styles.menuItem}>
                <Icon name="trash-outline" size={20} color={colors.red.text} />
                <Text style={[styles.menuText, { color: colors.red.text }]}>Supprimer (modération)</Text>
              </Pressable>
            )}
          </View>
        )}

        {editing && (
          <View style={styles.editBox}>
            <TextInput style={styles.editInput} value={draft} onChangeText={setDraft} multiline maxLength={400} autoFocus accessibilityLabel="Modifier le texte" />
            <View style={styles.editBtns}>
              <Pressable onPress={() => setEditing(false)} accessibilityRole="button" style={styles.smallGhost}>
                <Text style={styles.smallGhostText}>Annuler</Text>
              </Pressable>
              <Pressable onPress={() => { props.onEdit(post, draft.trim()); setEditing(false); }} accessibilityRole="button" style={styles.saveEdit}>
                <Text style={styles.saveEditText}>Enregistrer</Text>
              </Pressable>
            </View>
          </View>
        )}

        {isQuestion && (
          <View style={styles.qRow}>
            <View style={styles.qPill}>
              <Icon name="help-circle" size={16} color={colors.brandDark} />
              <Text style={styles.qPillText}>Question</Text>
            </View>
            {post.resolved ? (
              <View style={[styles.qPill, { backgroundColor: colors.green.soft }]}>
                <Icon name="checkmark-circle" size={16} color={colors.green.text} />
                <Text style={[styles.qPillText, { color: colors.green.text }]}>Résolu</Text>
              </View>
            ) : coachAnswered ? (
              <View style={[styles.qPill, { backgroundColor: colors.gold.soft }]}>
                <Icon name="school-outline" size={16} color={colors.gold.text} />
                <Text style={[styles.qPillText, { color: colors.gold.text }]}>Répondu par un coach</Text>
              </View>
            ) : null}
          </View>
        )}

        {isQuestion && !editing && !!post.caption && <Text style={styles.qText}>{post.caption}</Text>}
      </View>

      {images.length > 0 && <MediaCarousel images={images} onDoubleTap={() => !liked && onLike()} />}

      <View style={styles.pad}>
        {/* actions */}
        <View style={styles.actions}>
          <HeartButton liked={liked} count={post.likesCount} label="J’aime" onPress={onLike} text={post.likesHidden && !isMine ? 'J’aime' : undefined} />
          {post.commentsDisabled && !isMine ? (
            <View style={styles.actionBtn}>
              <Icon name="chatbubble-outline" size={23} color={colors.textMuted} />
              <Text style={[styles.actionText, { color: colors.textMuted }]}>Désactivés</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => onOpenComments(post)}
              accessibilityRole="button"
              accessibilityLabel="Commentaires"
              style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
            >
              <Icon name="chatbubble-outline" size={23} color={colors.text} />
              <Text style={styles.actionText}>{comments.length}</Text>
            </Pressable>
          )}
        </View>

        {!isQuestion && !editing && !!post.caption && (
          <Text style={styles.caption}>
            <Text style={styles.captionName}>{post.userName} </Text>
            {post.caption}
          </Text>
        )}

        {isQuestion ? (
          <View style={styles.qFooter}>
            {!(post.commentsDisabled && !isMine) && (
              <Pressable onPress={() => onOpenComments(post)} accessibilityRole="button" style={styles.answerBtn}>
                <Icon name="chatbubbles-outline" size={18} color={colors.text} />
                <Text style={styles.answerText}>{comments.length ? `Voir les réponses (${comments.length})` : 'Répondre'}</Text>
              </Pressable>
            )}
            {isMine && (
              <Pressable onPress={() => onToggleResolved(post)} accessibilityRole="button" style={styles.resolveBtn}>
                <Text style={styles.resolveText}>{post.resolved ? 'Rouvrir' : 'Marquer résolu'}</Text>
              </Pressable>
            )}
          </View>
        ) : post.commentsDisabled && !isMine ? null : comments.length > 0 ? (
          <Pressable onPress={() => onOpenComments(post)} accessibilityRole="button" style={styles.viewComments}>
            <Text style={styles.viewCommentsText}>Voir les {comments.length} commentaire{comments.length > 1 ? 's' : ''}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => onOpenComments(post)} accessibilityRole="button" style={styles.viewComments}>
            <Text style={styles.viewCommentsText}>Ajouter un commentaire…</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // ----- shared -----
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '800', color: colors.text, flexShrink: 1 },
  you: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, backgroundColor: colors.track, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 8 },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  confirmRow: { flexDirection: 'row', gap: 6 },
  smallGhost: { height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  smallGhostText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  menuPanel: { marginTop: 8, padding: 4, borderRadius: 14, backgroundColor: colors.bg },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46, paddingHorizontal: 12 },
  menuText: { fontSize: 15, fontWeight: '700', color: colors.text },
  editBox: { marginTop: 10, gap: 8 },
  editInput: { minHeight: 80, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, padding: 12, fontSize: 15, color: colors.text, textAlignVertical: 'top' },
  editBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  saveEdit: { height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.text, justifyContent: 'center' },
  saveEditText: { fontSize: 13, fontWeight: '800', color: colors.white },
  deleteBtn: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.red.bar, justifyContent: 'center' },
  deleteText: { fontSize: 13, fontWeight: '800', color: colors.white },

  // ----- regular card -----
  card: { ...card, overflow: 'hidden' },
  pad: { paddingHorizontal: 14, paddingVertical: 12 },
  media: { width: '100%', backgroundColor: colors.track },
  bigHeart: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', top: 12, right: 12, backgroundColor: ink(0.7), borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  counterText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  dots: { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotOn: { backgroundColor: colors.white, width: 18 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: -6 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 6 },
  actionText: { fontSize: 15, fontWeight: '700', color: colors.text },
  caption: { fontSize: 15, lineHeight: 22, color: colors.text, marginTop: 2 },
  captionName: { fontWeight: '800' },
  viewComments: { minHeight: 36, justifyContent: 'center' },
  viewCommentsText: { fontSize: 14, color: colors.textMuted },

  // question
  qRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  qPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.brandSoft, borderRadius: 14, paddingHorizontal: 10, height: 28 },
  qPillText: { fontSize: 13, fontWeight: '800', color: colors.brandDark },
  qText: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: colors.text, marginTop: 10 },
  qFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  answerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, borderColor: colors.text },
  answerText: { fontSize: 14, fontWeight: '800', color: colors.text },
  resolveBtn: { height: 44, paddingHorizontal: 8, justifyContent: 'center' },
  resolveText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },

  // ----- golden record card (compact) -----
  gold: {
    backgroundColor: colors.gold.bg,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.gold.border,
    padding: 14,
    shadowColor: colors.gold.deep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  goldApproved: { borderColor: colors.gold.bar, borderWidth: 2 },
  goldTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medal: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.gold.bar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalPending: { backgroundColor: colors.gold.soft, borderWidth: 1.5, borderColor: colors.gold.border },
  medalCheck: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.green.bar,
    borderWidth: 2,
    borderColor: colors.gold.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldName: { fontSize: 15, fontWeight: '800', color: colors.gold.text, flexShrink: 1 },
  goldYou: { fontSize: 12, fontWeight: '700', color: colors.gold.text, backgroundColor: colors.gold.soft, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 8 },
  goldExercise: { fontSize: 13, color: colors.gold.deep, fontWeight: '600', marginTop: 2 },
  goldWeightCol: { alignItems: 'flex-end' },
  goldWeight: { fontSize: 30, lineHeight: 34, fontWeight: '900', color: colors.gold.text },
  goldUnit: { fontSize: 15, fontWeight: '800', color: colors.gold.deep },
  goldReps: { fontSize: 13, fontWeight: '700', color: colors.gold.deep },

  goldChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  sealChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.gold.bar },
  sealText: { fontSize: 13, fontWeight: '800', color: colors.gold.ink },
  pendingChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.gold.soft },
  pendingText: { fontSize: 13, fontWeight: '700', color: colors.gold.text },
  deltaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.card },
  deltaText: { fontSize: 13, fontWeight: '800', color: colors.green.text },

  goldCaption: { fontSize: 14, lineHeight: 20, color: colors.gold.text, marginTop: 10 },
  goldProof: { width: '100%', height: 140, borderRadius: 14, marginTop: 10 },

  goldFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  congrats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.gold.deep,
  },
  congratsOn: { backgroundColor: colors.gold.bar, borderColor: colors.gold.bar },
  congratsText: { fontSize: 14, fontWeight: '800', color: colors.gold.text },
  goldIconBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, paddingHorizontal: 8 },
  goldIconText: { fontSize: 14, fontWeight: '700', color: colors.gold.text },
  validateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.gold.bar,
  },
  validateText: { fontSize: 14, fontWeight: '800', color: colors.gold.ink },
});
