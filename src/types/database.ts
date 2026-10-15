import type { SocialLinks } from '../community/socials';
export type { SocialLinks };

export type UserRole = 'member' | 'coach' | 'owner';

export type GenderType = 'male' | 'female';

export type TrainingTimeSlot = 'morning' | 'afternoon' | 'evening';

export type MuscleGroup = 
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'legs'
  | 'cardio';

export type CoachApprovalStatus = 'approved' | 'pending_approval' | 'rejected';

/**
 * Ad hoc rights the owner can hand to a specific member without making them a
 * full Coach or Owner. Kept separate from `role` on purpose — a permission can
 * be granted or revoked any time, a role change is a bigger step.
 */
export interface StaffPermissions {
  /** Publish/edit the class schedule. */
  manageClasses?: boolean;
  /** Add/edit shop products, flag low stock, fulfill reservations. */
  manageProducts?: boolean;
  /** Post "Infos du club" announcements. */
  manageNotifications?: boolean;
  /** Accept/refuse coach applications. */
  manageCoaches?: boolean;
  /** Validate records posted on the Wall, like an approved coach would. */
  coachFeatures?: boolean;
  /** Remove or ban a member from the whole club, and renew memberships. */
  manageMembers?: boolean;
  /** Hide posts and settle reports anywhere on the Wall, not just one community. */
  moderateWall?: boolean;
  /** Opening hours, zones, capacity, the entrance QR. */
  manageFloor?: boolean;
  /** See the club's numbers: sign-ups, members lost, money in. */
  viewAnalytics?: boolean;
  /**
   * Hand out and take back the rights above, for a manager who runs the staff.
   * Deliberately limited: a grantee can only pass on what he already holds, and
   * only the club owner can give this one away.
   */
  manageStaff?: boolean;
}

export interface UserProfile {
  id: string;
  /** Sign-in identifier (unique on the club). With the phone number, it's how a member signs in again. */
  username?: string;
  gymId: string;
  role: UserRole;
  fullName: string;
  gender: GenderType;
  age: number;
  usualTrainingTime: TrainingTimeSlot;
  usualMuscleGroups: MuscleGroup[];
  visitStreak: number;
  /** Highest visitStreak ever reached. */
  bestStreak?: number;
  lastCheckInDate?: string; // YYYY-MM-DD
  avatarUrl?: string;
  isApprovedCoach?: boolean;
  coachStatus?: CoachApprovalStatus;
  whatsappNumber?: string;
  createdAt: string;
  bio?: string;
  /** Social accounts the member chose to show on his profile. Optional, always. */
  socials?: SocialLinks;
  /** Main goal picked at sign-up, e.g. "Prendre du muscle". */
  goal?: string;
  /** Extra rights the owner granted this member, if any. */
  permissions?: StaffPermissions;
}

export interface CheckInRecord {
  id: string;
  userId: string;
  userFullName: string;
  gymId: string;
  muscleGroup: MuscleGroup;
  checkInTime: string; // ISO string
  expiresAt: string;    // ISO string (present for PRESENCE_MINUTES, see src/floor/crowd.ts)
  /** Set once the member scans out; ends presence immediately even if expiresAt hasn't passed. */
  endedAt?: string;
}

export interface HourlyOccupancy {
  hour: number;        // e.g. 18 for 18:00
  label: string;       // "18:00"
  occupancyCount: number;
  percentage: number;  // 0 to 100 relative to gym max volume
  isCurrentHour: boolean;
}

export interface MuscleOccupancy {
  muscleGroup: MuscleGroup;
  label: string;
  activeCount: number;
  percentage: number;
  status: 'packed' | 'busy' | 'moderate' | 'open';
}

export type ShopCategory =
  | 'Tous'
  | 'Protéine'
  | 'Gainer'
  | 'Multivitamines'
  | 'Pre-Workout'
  | 'Accessoires'
  | 'Snacks & Boissons';

export type ReservationStatus = 'pending' | 'ready' | 'picked_up' | 'cancelled';

export interface ProductReservation {
  id: string;
  gymId: string;
  productId: string;
  productName: string;
  productImage?: string;
  unitPriceTnd: number;
  quantity: number;
  userId: string;
  userName: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceProduct {
  id: string;
  gymId: string;
  name: string;
  category: ShopCategory;
  description: string;
  priceTnd: number;
  originalPriceTnd?: number;
  isPromo?: boolean;
  imageUrls: string[];
  inStock: boolean;
  /** Manually flagged by whoever manages the shop — not derived from a quantity count. */
  lowStock?: boolean;
  createdBy: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  gymId: string;
  title: string;
  content: string;
  isUrgent: boolean;
  createdByRole: UserRole;
  createdAt: string;
}

export type PostCategory = 'chat' | 'workout' | 'meal' | 'pr' | 'question';

export interface PostComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  likesCount: number;
}

/** Coach validation of a personal record (golden badge). */
export interface PrApproval {
  status: 'pending' | 'approved';
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
}

/** Public member card shown on the wall (avatar, bio, role). */
/**
 * The social accounts a member chooses to show on his profile.
 * Stored as handles, never full URLs: the app builds the link, so a pasted
 * address cannot send another member somewhere unexpected.
 */

export interface MemberProfile {
  userId: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  bio?: string;
  socials?: SocialLinks;
}

export interface CommunityPost {
  id: string;
  gymId: string;
  userId: string;
  userName: string;
  caption: string;
  imageUrl?: string;
  imageUrls?: string[];
  category?: PostCategory;
  /** Community this post belongs to (undefined = general club feed, still shown in "Pour toi"). */
  communityId?: string;
  isPR?: boolean;
  prDetails?: {
    exercise: string;
    weightKg: number;
    reps: number;
    prevWeightKg?: number;
  };
  prApproval?: PrApproval;
  comments?: PostComment[];
  resolved?: boolean; // question answered
  canDelete?: boolean;
  likesCount: number;
  createdAt: string;
  /** The author turned commenting off. */
  commentsDisabled?: boolean;
  /** The author hid like counts from other members (they can still like/unlike). */
  likesHidden?: boolean;
}

export interface TransformationItem {
  clientName: string;
  beforeUrl: string;
  afterUrl: string;
  duration: string;
  result: string;
}

/** A personal-training plan the coach writes himself: a name, what it is, a price. */
export interface CoachPricingPlan {
  id: string;
  title: string;
  /** The coach explains his plan in his own words (séances, programme, suivi…). */
  description?: string;
  priceTnd: number;
  isPopular?: boolean;
  /** Older plans: free-text period ("par mois") and bullet points, shown when there's no description. */
  billingPeriod?: string;
  features?: string[];
}

export interface CoachProfile {
  id: string;
  fullName: string;
  bio: string;
  yearsExperience: number;
  specialties: string[];
  /** Lowest price per séance of the coach's offers ("à partir de"), 0 = no personal training. Kept in sync by the offers editor. */
  hourlyRateTnd: number;
  /** Offers private séances. Missing on older profiles: derived from hourlyRateTnd / offers. */
  personalCoaching?: boolean;
  contactPhone: string;
  whatsappNumber?: string;
  whatsappLink?: string;
  isAcceptingClients: boolean;
  avatarUrl?: string;
  bannerUrl?: string;
  beforeAfterTransformations?: TransformationItem[];
  pricingPlans?: CoachPricingPlan[];
  /** Linked app account (a coach edits only their own profile). */
  userId?: string;
  /** One-line pitch shown under the name, e.g. "Force & hypertrophie". */
  headline?: string;
  certifications?: string[];
  /** Days the coach trains members: 'Lun' … 'Dim'. */
  availabilityDays?: string[];
  /** Free text, e.g. "17:00 – 21:00". */
  availabilityHours?: string;
  clientsCount?: number;
  /** Floor coach ("coach plateau"): walks the gym floor to watch members and guide them. */
  onFloor?: boolean;
  /** 'pending' = application waiting for the owner's approval. */
  status?: 'approved' | 'pending';
  /** Manual "I'm here / I stepped out" override on top of the usual schedule (expires after a few hours). */
  liveStatus?: { state: 'here' | 'away'; setAt: string };
}

export interface MachineLog {
  id: string;
  userId: string;
  machineName: string;
  photoUrl?: string;
  weightKg: number;
  reps: number;
  updatedAt: string;
}
