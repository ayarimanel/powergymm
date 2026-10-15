import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/database';
import { MurPost } from '../../community/murService';
import { colors } from '../../theme';
import { timeAgoFr } from '../../services/communityService';
import { BottomSheet, SheetScrollView } from '../home/BottomSheet';
import { Avatar } from './Avatar';

interface Props {
  post: MurPost | null;
  me: UserProfile;
  /** Moderators of the community can clean any comment too. */
  canModerate: boolean;
  onClose: () => void;
  onAdd: (postId: string, text: string) => void;
  onDelete: (postId: string, commentId: string) => void;
  onDeleteAll: (postId: string) => void;
  onToggleLike: (postId: string, commentId: string) => void;
}

/** Comments on a Mur post, with the message box pinned at the bottom. */
export const CommentsSheet: React.FC<Props> = ({ post, me, canModerate, onClose, onAdd, onDelete, onDeleteAll, onToggleLike }) => {
  const [text, setText] = useState('');
  const [shown, setShown] = useState<MurPost | null>(post);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    if (post) setShown(post);
  }, [post]);
  useEffect(() => {
    if (post) {
      setText('');
      setConfirmDeleteId(null);
      setConfirmAll(false);
    }
  }, [post?.id]);

  const p = shown;
  const isQuestion = p?.kind === 'question';
  const comments = p?.comments ?? [];
  const isPostOwner = !!p?.authorId && p.authorId === me.id;
  const canCleanAll = (isPostOwner || canModerate) && comments.length > 0;

  const send = () => {
    if (!p || !text.trim()) return;
    onAdd(p.id, text.trim());
    setText('');
  };

  const summary = (x: MurPost) =>
    x.text ||
    (x.kind === 'record' ? `Record : ${x.lift} ${x.kg} kg × ${x.reps}` : 'Publication');

  return (
    <BottomSheet
      visible={!!post}
      onClose={onClose}
      snaps={[0.92]}
      header={
        <View style={styles.headRow}>
          <Text style={styles.title} accessibilityRole="header">
            {isQuestion ? 'Réponses' : 'Commentaires'}
            {comments.length ? <Text style={styles.count}> · {comments.length}</Text> : null}
          </Text>
          {canCleanAll &&
            (confirmAll ? (
              <Pressable
                onPress={() => {
                  if (p) onDeleteAll(p.id);
                  setConfirmAll(false);
                }}
                accessibilityRole="button"
                style={styles.confirmDelete}
              >
                <Text style={styles.confirmDeleteText}>Tout supprimer ?</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setConfirmAll(true)} accessibilityRole="button" hitSlop={6} style={styles.clearBtn}>
                <Ionicons name="trash-outline" size={15} color={colors.red.text} />
                <Text style={styles.clearText}>Tout effacer</Text>
              </Pressable>
            ))}
        </View>
      }
    >
      {() =>
        p ? (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SheetScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              {/* the post being discussed */}
              <View style={styles.original}>
                <Text style={styles.originalName}>{p.anonymous ? 'Membre anonyme' : p.author ?? 'Membre'}</Text>
                <Text style={styles.originalText} numberOfLines={4}>{summary(p)}</Text>
              </View>

              {comments.length === 0 && (
                <View style={styles.empty}>
                  <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>{isQuestion ? 'Pas encore de réponse' : 'Pas encore de commentaire'}</Text>
                  <Text style={styles.emptySub}>{isQuestion ? 'Aide ce membre : ta réponse compte.' : 'Sois le premier à réagir.'}</Text>
                </View>
              )}

              {comments.map(c => {
                const mine = c.authorId === me.id;
                const canDelete = mine || isPostOwner || canModerate;
                const liked = c.likes.includes(me.id);
                return (
                  <View key={c.id} style={styles.row}>
                    <Avatar name={c.author} url={c.avatarUrl} size={36} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name}>{c.author}</Text>
                        {mine && <Text style={styles.you}>toi</Text>}
                        <Text style={styles.time}>{timeAgoFr(c.createdAt)}</Text>
                      </View>
                      <Text style={styles.text}>{c.text}</Text>
                      <Pressable
                        onPress={() => onToggleLike(p.id, c.id)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityState={{ selected: liked }}
                        accessibilityLabel="J’aime ce commentaire"
                        style={styles.commentLikeBtn}
                      >
                        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={15} color={liked ? colors.red.bar : colors.textMuted} />
                        <Text style={[styles.commentLikeText, liked && { color: colors.red.text }]}>{c.likes.length > 0 ? c.likes.length : 'J’aime'}</Text>
                      </Pressable>
                    </View>
                    {canDelete &&
                      (confirmDeleteId === c.id ? (
                        <Pressable
                          onPress={() => {
                            onDelete(p.id, c.id);
                            setConfirmDeleteId(null);
                          }}
                          accessibilityRole="button"
                          style={styles.confirmDelete}
                        >
                          <Text style={styles.confirmDeleteText}>Supprimer</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => setConfirmDeleteId(c.id)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={mine ? 'Supprimer mon commentaire' : 'Supprimer ce commentaire'}
                          style={styles.deleteBtn}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                        </Pressable>
                      ))}
                  </View>
                );
              })}
            </SheetScrollView>

            <View style={styles.inputBar}>
              <Avatar name={me.fullName} url={me.avatarUrl} size={36} />
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder={isQuestion ? 'Écris ta réponse…' : 'Ajouter un commentaire…'}
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
                accessibilityLabel="Ton message"
              />
              <Pressable onPress={send} disabled={!text.trim()} accessibilityRole="button" accessibilityLabel="Envoyer" style={[styles.send, !text.trim() && styles.sendOff]}>
                <Ionicons name="send" size={18} color={colors.white} />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        ) : null
      }
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  count: { color: colors.textMuted },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.red.soft },
  clearText: { fontSize: 12, fontWeight: '800', color: colors.red.text },
  list: { paddingHorizontal: 20, paddingBottom: 16 },
  original: { padding: 12, borderRadius: 14, backgroundColor: colors.bg, marginBottom: 12 },
  originalName: { fontSize: 14, fontWeight: '800', color: colors.text },
  originalText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  emptySub: { fontSize: 14, color: colors.textMuted },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 14, fontWeight: '800', color: colors.text },
  you: { fontSize: 11, fontWeight: '800', color: colors.brandText, backgroundColor: colors.brandSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  time: { fontSize: 12, color: colors.textMuted },
  text: { fontSize: 15, lineHeight: 21, color: colors.text, marginTop: 2 },
  commentLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start', paddingVertical: 2 },
  commentLikeText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  deleteBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  confirmDelete: { height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.red.bar, justifyContent: 'center' },
  confirmDeleteText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  input: { flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 22, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: colors.text },
  // Brand blue = the one primary action
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: colors.disabled },
});
