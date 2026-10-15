import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Activity, AlarmClock, Equal, Play, Sun, Apple, Bike, HandFist, Sprout, ThumbsUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, Asterisk, AtSign, Award,
  Bell, Box, Building, Calendar, Camera, ChartColumn, ChartLine, ChartNoAxesColumn, Check, ChevronDown,
  ChevronLeft, ChevronRight, ChevronUp, Circle, CircleAlert, CircleCheck, CircleCheckBig, CircleDot,
  CirclePlus, CircleQuestionMark, CircleUser, CircleX, ClipboardList, Clock, CloudOff, Code, Copy,
  CreditCard, Download, Droplet, Dumbbell, Ellipsis, ExternalLink, Eye, EyeOff, Flag, Flame, Flashlight,
  Footprints, GraduationCap, Grid3x3, Heart, HeartPulse, Hourglass, House, Image, Images, Info, KeyRound,
  Languages, LayoutGrid, Lightbulb, Link, Lock, LockOpen, LogIn, LogOut, Maximize2, Megaphone,
  MessageCircle, MessageCircleMore, MessagesSquare, Minus, Moon, PersonStanding, Phone, Pin,
  Plus, Power, QrCode, Radio, RefreshCw, Save, Search, Send, Settings, Share, Shield, ShieldCheck,
  ShoppingBag, ShoppingBasket, Snowflake, Sparkles, SquareCheck, SquarePen, Star, Store, Tag, Tags,
  Thermometer, Timer, Trash, TrendingUp, TriangleAlert, Trophy, User, Users, Utensils, Venus, Mars,
  VideoOff, Wrench, X, Zap,
} from 'lucide-react-native';

/** Every name the app already uses: the Ionicons names, so call sites did not change. */
export type IconName = keyof typeof Ionicons.glyphMap;

type Lucide = typeof Check;

/** Ionicons base name (without -outline / -sharp) → closest Lucide icon. */
const MAP: Record<string, Lucide> = {
  add: Plus,
  alarm: AlarmClock,
  'add-circle': CirclePlus,
  alert: CircleAlert,
  'alert-circle': CircleAlert,
  analytics: ChartLine,
  apps: LayoutGrid,
  'arrow-back': ArrowLeft,
  'arrow-down': ArrowDown,
  'arrow-forward': ArrowRight,
  'arrow-up': ArrowUp,
  at: AtSign,
  'bag-check': ShoppingBag,
  'bag-handle': ShoppingBag,
  'bar-chart': ChartColumn,
  barbell: Dumbbell,
  basket: ShoppingBasket,
  body: PersonStanding,
  bicycle: Bike,
  bulb: Lightbulb,
  business: Building,
  calendar: Calendar,
  call: Phone,
  camera: Camera,
  card: CreditCard,
  chatbubble: MessageCircle,
  'chatbubble-ellipses': MessageCircleMore,
  chatbubbles: MessagesSquare,
  checkbox: SquareCheck,
  checkmark: Check,
  'checkmark-circle': CircleCheck,
  'checkmark-done-circle': CircleCheckBig,
  'chevron-back': ChevronLeft,
  'chevron-down': ChevronDown,
  'chevron-forward': ChevronRight,
  'chevron-up': ChevronUp,
  clipboard: ClipboardList,
  close: X,
  'close-circle': CircleX,
  'cloud-offline': CloudOff,
  code: Code,
  construct: Wrench,
  copy: Copy,
  create: SquarePen,
  cube: Box,
  download: Download,
  'ellipsis-horizontal': Ellipsis,
  ellipse: Circle,
  eye: Eye,
  'eye-off': EyeOff,
  female: Venus,
  fitness: HeartPulse,
  flag: Flag,
  flame: Flame,
  flash: Zap,
  flashlight: Flashlight,
  grid: LayoutGrid,
  'hand-left': HandFist,
  heart: Heart,
  'help-circle': CircleQuestionMark,
  home: House,
  hourglass: Hourglass,
  image: Image,
  images: Images,
  'information-circle': Info,
  key: KeyRound,
  leaf: Sprout,
  keypad: Grid3x3,
  language: Languages,
  link: Link,
  'lock-closed': Lock,
  'lock-open': LockOpen,
  'log-in': LogIn,
  'log-out': LogOut,
  'logo-whatsapp': MessageCircle, // as in the mockup (CoachFiche "Réserver via WhatsApp")
  'logo-google': Star, // "leave a Google review"
  male: Mars,
  medical: Asterisk,
  megaphone: Megaphone,
  moon: Moon,
  notifications: Bell,
  nutrition: Apple,
  open: ExternalLink,
  people: Users,
  person: User,
  'person-circle': CircleUser,
  pin: Pin,
  play: Play,
  power: Power,
  pricetag: Tag,
  pricetags: Tags,
  pulse: Activity,
  'qr-code': QrCode,
  radio: Radio,
  'radio-button-off': Circle,
  'radio-button-on': CircleDot,
  refresh: RefreshCw,
  'reorder-two': Equal,
  remove: Minus,
  resize: Maximize2,
  restaurant: Utensils,
  ribbon: Award,
  save: Save,
  school: GraduationCap,
  search: Search,
  send: Send,
  settings: Settings,
  share: Share,
  shield: Shield,
  'shield-checkmark': ShieldCheck,
  snow: Snowflake,
  sparkles: Sparkles,
  star: Star,
  'stats-chart': ChartNoAxesColumn,
  storefront: Store,
  sunny: Sun,
  'swap-vertical': ArrowUpDown,
  sync: RefreshCw,
  thermometer: Thermometer,
  time: Clock,
  timer: Timer,
  trash: Trash,
  'thumbs-up': ThumbsUp,
  'trending-up': TrendingUp,
  trophy: Trophy,
  'videocam-off': VideoOff,
  walk: Footprints,
  warning: TriangleAlert,
  water: Droplet,
};

/**
 * Social-network logos: Lucide ships no brand icons, so these keep the brand glyph
 * (profile social links must stay recognisable).
 */
const BRANDS = new Set(['logo-instagram', 'logo-snapchat', 'logo-tiktok', 'logo-facebook']);

const warned = new Set<string>();

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * The app's icon: Lucide, stroke 2, called with the Ionicons names the app already used.
 * Outline and filled Ionicons map to the same Lucide icon: active states are shown by color.
 */
export const Icon: React.FC<Props> = ({ name, size = 24, color, style, accessibilityLabel, testID }) => {
  if (BRANDS.has(name)) {
    return <Ionicons name={name} size={size} color={color} style={style as any} accessibilityLabel={accessibilityLabel} testID={testID} />;
  }
  const base = String(name).replace(/-(outline|sharp)$/, '');
  const L = MAP[base];
  if (!L && __DEV__ && !warned.has(base)) {
    warned.add(base);
    console.warn(`[Icon] no Lucide mapping for "${name}", showing a neutral icon`);
  }
  const Comp = L ?? Circle;
  return (
    <Comp
      size={size}
      color={color}
      strokeWidth={2}
      style={style}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    />
  );
};
