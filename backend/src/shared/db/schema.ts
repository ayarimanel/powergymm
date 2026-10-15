/**
 * Typed mirror of supabase/migrations/*.sql, used for queries only.
 * The SQL migration stays the source of truth (it owns constraints, RLS, auth FKs).
 * Each block is owned by one module; other modules must not query it directly.
 */
import {
  boolean, date, integer, jsonb, numeric, pgTable, primaryKey, smallint, text, time, timestamp, uuid,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const day = (name: string) => date(name, { mode: 'string' });

// ── clubs ──
export const gyms = pgTable('gyms', {
  id: id(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  city: text('city'),
  country: text('country').notNull().default('TN'),
  timezone: text('timezone').notNull().default('Africa/Tunis'),
  currency: text('currency').notNull().default('TND'),
  logoUrl: text('logo_url'),
  primaryColor: text('primary_color').notNull().default('#0284C7'),
  openingHour: smallint('opening_hour').notNull().default(6),
  closingHour: smallint('closing_hour').notNull().default(22),
  maxCapacity: integer('max_capacity').notNull().default(80),
  classesEnabled: boolean('classes_enabled').notNull().default(true),
  enforceMemberships: boolean('enforce_memberships').notNull().default(false),
  checkInCode: text('check_in_code').notNull(),
  openDays: smallint('open_days').array().notNull().default([0, 1, 2, 3, 4, 5, 6]),
  durationsSold: text('durations_sold').array().notNull().default(['1m', '3m', '6m', '1y', 'pass']),
  endOfMonthBilling: boolean('end_of_month_billing').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const announcements = pgTable('announcements', {
  id: id(),
  gymId: uuid('gym_id').notNull(),
  kind: text('kind', { enum: ['aid', 'iftar', 'closure', 'hours', 'event', 'info'] }).notNull().default('info'),
  title: text('title').notNull(),
  message: text('message').notNull(),
  whenLabel: text('when_label'),
  urgent: boolean('urgent').notNull().default(false),
  startsAt: ts('starts_at'),
  endsAt: ts('ends_at'),
  createdBy: uuid('created_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

// ── identity ──
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  gymId: uuid('gym_id').notNull(),
  role: text('role', { enum: ['member', 'coach', 'owner'] }).notNull().default('member'),
  fullName: text('full_name').notNull(),
  gender: text('gender', { enum: ['male', 'female'] }),
  birthYear: smallint('birth_year'),
  goal: text('goal'),
  trainingSlot: text('training_slot', { enum: ['morning', 'afternoon', 'evening'] }),
  usualMuscles: text('usual_muscles').array().notNull().default([]),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  whatsapp: text('whatsapp'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const staffPermissions = pgTable('staff_permissions', {
  userId: uuid('user_id').notNull(),
  gymId: uuid('gym_id').notNull(),
  permission: text('permission', {
    enum: ['manage_classes', 'manage_products', 'manage_announcements', 'manage_coaches', 'validate_records', 'manage_staff', 'manage_members', 'moderate_wall', 'manage_floor', 'view_analytics'],
  }).notNull(),
  grantedBy: uuid('granted_by'),
  grantedAt: ts('granted_at').notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId, t.permission] })]);

// ── memberships ──
export const memberships = pgTable('memberships', {
  id: id(),
  gymId: uuid('gym_id').notNull(),
  userId: uuid('user_id').notNull(),
  planName: text('plan_name').notNull().default('Mensuel'),
  startsOn: day('starts_on').notNull(),
  endsOn: day('ends_on').notNull(),
  priceMillimes: integer('price_millimes').notNull().default(0),
  createdBy: uuid('created_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

// ── attendance ──
export const checkIns = pgTable('check_ins', {
  id: id(),
  gymId: uuid('gym_id').notNull(),
  userId: uuid('user_id').notNull(),
  muscles: text('muscles').array().notNull().default([]),
  source: text('source', { enum: ['door_qr', 'manual'] }).notNull().default('door_qr'),
  status: text('status', { enum: ['active', 'completed', 'expired'] }).notNull().default('active'),
  startedAt: ts('started_at').notNull().defaultNow(),
  endedAt: ts('ended_at'),
  localDay: day('local_day').notNull(),
});

// ── classes ──
export const groupClasses = pgTable('group_classes', {
  id: id(),
  gymId: uuid('gym_id').notNull(),
  title: text('title').notNull(),
  coachId: uuid('coach_id'),
  weekday: smallint('weekday').notNull(),
  startTime: time('start_time').notNull(),
  durationMin: smallint('duration_min').notNull(),
  capacity: smallint('capacity').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const classSessions = pgTable('class_sessions', {
  id: id(),
  gymId: uuid('gym_id').notNull(),
  classId: uuid('class_id').notNull(),
  sessionDate: day('session_date').notNull(),
  status: text('status', { enum: ['scheduled', 'cancelled'] }).notNull().default('scheduled'),
  cancelReason: text('cancel_reason'),
  cancelledBy: uuid('cancelled_by'),
});

export const classBookings = pgTable('class_bookings', {
  sessionId: uuid('session_id').notNull(),
  userId: uuid('user_id').notNull(),
  gymId: uuid('gym_id').notNull(),
  bookedAt: ts('booked_at').notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.sessionId, t.userId] })]);

// ── coaching ──
export const coachProfiles = pgTable('coach_profiles', {
  userId: uuid('user_id').primaryKey(),
  gymId: uuid('gym_id').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  headline: text('headline'),
  bio: text('bio').notNull().default(''),
  specialties: text('specialties').array().notNull().default([]),
  yearsExperience: smallint('years_experience').notNull().default(0),
  certifications: text('certifications').array().notNull().default([]),
  availabilityDays: smallint('availability_days').array().notNull().default([]),
  availabilityHours: text('availability_hours'),
  acceptingClients: boolean('accepting_clients').notNull().default(true),
  floorCoach: boolean('floor_coach').notNull().default(false),
  liveState: text('live_state', { enum: ['here', 'away'] }),
  liveStateAt: ts('live_state_at'),
  bannerUrl: text('banner_url'),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: ts('reviewed_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const coachPlans = pgTable('coach_plans', {
  id: id(),
  coachId: uuid('coach_id').notNull(),
  gymId: uuid('gym_id').notNull(),
  title: text('title').notNull(),
  priceMillimes: integer('price_millimes').notNull(),
  billingPeriod: text('billing_period').notNull(),
  features: text('features').array().notNull().default([]),
  popular: boolean('popular').notNull().default(false),
  position: smallint('position').notNull().default(0),
});

export const coachTransformations = pgTable('coach_transformations', {
  id: id(),
  coachId: uuid('coach_id').notNull(),
  gymId: uuid('gym_id').notNull(),
  clientName: text('client_name').notNull(),
  beforeUrl: text('before_url').notNull(),
  afterUrl: text('after_url').notNull(),
  duration: text('duration').notNull(),
  result: text('result').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

// ── community ──
export type PrDetails = { exercise: string; weightKg: number; reps: number; previousKg?: number };

export const posts = pgTable('posts', {
  id: id(),
  gymId: uuid('gym_id').notNull(),
  authorId: uuid('author_id').notNull(),
  category: text('category', { enum: ['chat', 'workout', 'meal', 'pr', 'question'] }).notNull().default('chat'),
  caption: text('caption').notNull().default(''),
  imageUrls: text('image_urls').array().notNull().default([]),
  pr: jsonb('pr').$type<PrDetails>(),
  prValidatedBy: uuid('pr_validated_by'),
  prValidatedAt: ts('pr_validated_at'),
  commentsDisabled: boolean('comments_disabled').notNull().default(false),
  likesHidden: boolean('likes_hidden').notNull().default(false),
  resolved: boolean('resolved').notNull().default(false),
  status: text('status', { enum: ['published', 'removed'] }).notNull().default('published'),
  likesCount: integer('likes_count').notNull().default(0),
  commentsCount: integer('comments_count').notNull().default(0),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const postComments = pgTable('post_comments', {
  id: id(),
  postId: uuid('post_id').notNull(),
  gymId: uuid('gym_id').notNull(),
  authorId: uuid('author_id').notNull(),
  text: text('text').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const postLikes = pgTable('post_likes', {
  postId: uuid('post_id').notNull(),
  userId: uuid('user_id').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.postId, t.userId] })]);

export const postReports = pgTable('post_reports', {
  id: id(),
  postId: uuid('post_id').notNull(),
  gymId: uuid('gym_id').notNull(),
  reporterId: uuid('reporter_id').notNull(),
  reason: text('reason').notNull(),
  status: text('status', { enum: ['open', 'dismissed', 'actioned'] }).notNull().default('open'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

// ── journal ── (ids come from the phone; see 20261001000000_journal_workouts.sql)
const MUSCLE_ENUM = ['chest', 'back', 'shoulders', 'arms', 'legs', 'cardio'] as const;

export const workouts = pgTable('workouts', {
  id: uuid('id').primaryKey(),
  gymId: uuid('gym_id').notNull(),
  userId: uuid('user_id').notNull(),
  date: ts('date').notNull(),
  startedAt: ts('started_at').notNull(),
  endedAt: ts('ended_at'),
  live: boolean('live').notNull().default(true),
  migrated: boolean('migrated').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  deletedAt: ts('deleted_at'),
});

export const workoutSets = pgTable('workout_sets', {
  id: id(),
  workoutId: uuid('workout_id').notNull(),
  exerciseId: text('exercise_id').notNull(),
  muscle: text('muscle', { enum: MUSCLE_ENUM }),
  order: smallint('order').notNull(),
  kg: numeric('kg', { precision: 8, scale: 2, mode: 'number' }).notNull().default(0),
  reps: smallint('reps').notNull().default(0),
  minutes: numeric('minutes', { precision: 5, scale: 1, mode: 'number' }).notNull().default(0),
  km: numeric('km', { precision: 6, scale: 2, mode: 'number' }).notNull().default(0),
  isPr: boolean('is_pr').notNull().default(false),
  legacy: boolean('legacy').notNull().default(false),
});

export const customExercises = pgTable('custom_exercises', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  muscle: text('muscle', { enum: MUSCLE_ENUM }).notNull(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['weight', 'body', 'cardio'] }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

// ── shop ──
export const PRODUCT_CATEGORIES = ['Protéine', 'Gainer', 'Multivitamines', 'Pre-Workout', 'Accessoires', 'Snacks & Boissons'] as const;

export const products = pgTable('products', {
  id: id(),
  gymId: uuid('gym_id').notNull(),
  name: text('name').notNull(),
  category: text('category', { enum: PRODUCT_CATEGORIES }).notNull(),
  description: text('description').notNull().default(''),
  priceMillimes: integer('price_millimes').notNull(),
  originalPriceMillimes: integer('original_price_millimes'),
  imageUrls: text('image_urls').array().notNull().default([]),
  inStock: boolean('in_stock').notNull().default(true),
  lowStock: boolean('low_stock').notNull().default(false),
  archivedAt: ts('archived_at'),
  createdBy: uuid('created_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const reservations = pgTable('reservations', {
  id: id(),
  gymId: uuid('gym_id').notNull(),
  productId: uuid('product_id').notNull(),
  userId: uuid('user_id').notNull(),
  quantity: smallint('quantity').notNull(),
  unitPriceMillimes: integer('unit_price_millimes').notNull(),
  status: text('status', { enum: ['pending', 'ready', 'picked_up', 'cancelled'] }).notNull().default('pending'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

// ── notifications ──
export const notifications = pgTable('notifications', {
  id: id(),
  gymId: uuid('gym_id').notNull(),
  recipientId: uuid('recipient_id').notNull(),
  actorId: uuid('actor_id'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: ts('created_at').notNull().defaultNow(),
  readAt: ts('read_at'),
});

export const pushDevices = pgTable('push_devices', {
  id: id(),
  userId: uuid('user_id').notNull(),
  expoToken: text('expo_token').notNull(),
  platform: text('platform', { enum: ['ios', 'android', 'web'] }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
});

// ── member habits ("Bienvenue" questionnaire) ──
// Declared by the member, not billing truth: see 20261002000000_member_habits.sql.
export const memberProfiles = pgTable('member_profiles', {
  gymId: uuid('gym_id').notNull(),
  userId: uuid('user_id').notNull(),
  usualDays: smallint('usual_days').array().notNull().default([]),
  usualDaysVaries: boolean('usual_days_varies').notNull().default(false),
  usualSlot: text('usual_slot', { enum: ['early', 'morning', 'noon', 'afternoon', 'evening', 'late', 'varies'] }),
  trainingStyle: text('training_style', { enum: ['split', 'upper_lower', 'full_body', 'cardio', 'classes', 'beginner'] }),
  focusMuscles: text('focus_muscles').array().notNull().default([]),
  subscriptionPaidAt: day('subscription_paid_at'),
  subscriptionPaidAtSource: text('subscription_paid_at_source', { enum: ['estimate', 'confirmed'] }),
  subscriptionPaidAtMarginDays: smallint('subscription_paid_at_margin_days').notNull().default(0),
  subscriptionDuration: text('subscription_duration', { enum: ['1m', '3m', '6m', '1y', 'pass'] }),
  subscriptionEndsAt: day('subscription_ends_at'),
  onboardingStatus: text('onboarding_status', { enum: ['new', 'partial', 'done', 'snoozed'] }).notNull().default('new'),
  onboardingSnoozeCount: smallint('onboarding_snooze_count').notNull().default(0),
  onboardingNextAt: day('onboarding_next_at'),
  habitsCheckAskedAt: day('habits_check_asked_at'),
  renewalRemindersSent: smallint('renewal_reminders_sent').notNull().default(0),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.gymId, t.userId] })]);
