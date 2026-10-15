/**
 * Image uploads go straight from the phone to Supabase Storage through a
 * short-lived signed URL, so large files never pass through the API.
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requirePermission, type Actor } from '../../shared/auth/actor.js';
import { actorOf } from '../../shared/auth/plugin.js';
import type { App } from '../../shared/http.js';

export interface StorageSigner {
  signUpload(bucket: string, path: string): Promise<{ signedUrl: string; token: string }>;
  publicUrl(bucket: string, path: string): string;
}

export function supabaseStorageSigner(url: string, serviceRoleKey: string): StorageSigner {
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async signUpload(bucket, path) {
      const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path);
      if (error || !data) throw error ?? new Error('could not sign upload');
      return { signedUrl: data.signedUrl, token: data.token };
    },
    publicUrl: (bucket, path) => client.storage.from(bucket).getPublicUrl(path).data.publicUrl,
  };
}

const KINDS = {
  avatar: 'avatars',
  post: 'posts',
  product: 'products',
  coach: 'coaches',
} as const;
type Kind = keyof typeof KINDS;

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' } as const;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Only shop images need a permission. Coach images are open to members too:
 * applicants upload their banner and transformations before being approved.
 */
function assertAllowed(actor: Actor, kind: Kind) {
  if (kind === 'product') requirePermission(actor, 'manage_products');
}

export function uploadsRoutes(app: App, storage: StorageSigner) {
  app.post('/v1/uploads/sign', {
    preHandler: app.requireActor,
    schema: {
      tags: ['uploads'],
      body: z.object({
        kind: z.enum(['avatar', 'post', 'product', 'coach']),
        contentType: z.enum(Object.keys(TYPES) as [keyof typeof TYPES, ...(keyof typeof TYPES)[]]),
        bytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES, 'Images must be 8 MB or smaller.'),
      }),
    },
  }, async (req, reply) => {
    const actor = actorOf(req);
    const { kind, contentType } = req.body;
    assertAllowed(actor, kind);
    const bucket = KINDS[kind];
    const path = `${actor.gymId}/${actor.id}/${randomUUID()}.${TYPES[contentType]}`;
    const signed = await storage.signUpload(bucket, path);
    return reply.code(201).send({ bucket, path, ...signed, publicUrl: storage.publicUrl(bucket, path) });
  });
}
