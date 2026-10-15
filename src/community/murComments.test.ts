import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));

import { MurComments, MurPost } from './murService';

const post: MurPost = { id: 'p1', cid: 'general', kind: 'question', authorId: 'owner-of-post', author: 'Sami', init: 'S', ago: 'à l’instant', likes: 0, comments: [] };
const say = (p: MurPost, authorId: string, text: string) => MurComments.add(p, { authorId, author: authorId, text });

const lina = { id: 'lina', canModerate: false };
const author = { id: 'owner-of-post', canModerate: false };
const mod = { id: 'mod', canModerate: true };

describe('Mur comments', () => {
  const thread = say(say(say(post, 'lina', 'Bravo !'), 'karim', 'Solide 💪'), 'owner-of-post', 'Merci !');
  const [linaC, karimC] = thread.comments!;

  it('anyone can comment and like a comment (and unlike it)', () => {
    expect(thread.comments).toHaveLength(3);
    const liked = MurComments.toggleLike(thread, karimC.id, 'lina');
    expect(liked.comments![1].likes).toEqual(['lina']);
    expect(MurComments.toggleLike(liked, karimC.id, 'lina').comments![1].likes).toEqual([]);
  });

  it('you can delete your own comment, not someone else’s', () => {
    expect(MurComments.remove(thread, linaC.id, lina).comments).toHaveLength(2);
    expect(MurComments.remove(thread, karimC.id, lina).comments).toHaveLength(3);
  });

  it('the post’s author can delete any comment, or all of them', () => {
    expect(MurComments.remove(thread, karimC.id, author).comments).toHaveLength(2);
    expect(MurComments.removeAll(thread, author).comments).toHaveLength(0);
    expect(MurComments.removeAll(thread, lina).comments).toHaveLength(3);
  });

  it('a community moderator can clean the thread too', () => {
    expect(MurComments.removeAll(thread, mod).comments).toHaveLength(0);
  });
});
