import AsyncStorage from '@react-native-async-storage/async-storage';
import { MarketplaceProduct, ProductReservation, ReservationStatus, UserProfile } from '../types/database';
import { DEFAULT_PRODUCTS } from '../data/defaultProducts';

const PRODUCTS_KEY = '@gym_app_shop_products_v1';
const RESERVATIONS_KEY = '@gym_app_shop_reservations_v1';

const read = async <T,>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = async (key: string, value: unknown) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('shopService write error', e);
  }
};

// ---- Helpers ----

export const discountPct = (p: MarketplaceProduct) =>
  p.originalPriceTnd && p.originalPriceTnd > p.priceTnd
    ? Math.round((1 - p.priceTnd / p.originalPriceTnd) * 100)
    : 0;

export const formatPrice = (n: number, currency = 'TND') =>
  `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')} ${currency}`;

export const isActive = (r: ProductReservation) => r.status === 'pending' || r.status === 'ready';

export const RESERVATION_LABEL: Record<ReservationStatus, string> = {
  pending: 'En attente',
  ready: 'Prête à retirer',
  picked_up: 'Retirée',
  cancelled: 'Annulée',
};

// ---- Service ----

export const ShopService = {
  getProducts: async (): Promise<MarketplaceProduct[]> => {
    const stored = await read<MarketplaceProduct[]>(PRODUCTS_KEY);
    if (stored) return stored;
    await write(PRODUCTS_KEY, DEFAULT_PRODUCTS);
    return DEFAULT_PRODUCTS;
  },

  saveProducts: (products: MarketplaceProduct[]) => write(PRODUCTS_KEY, products),

  getReservations: async (): Promise<ProductReservation[]> => (await read<ProductReservation[]>(RESERVATIONS_KEY)) ?? [],

  reserve: async (
    user: UserProfile,
    product: MarketplaceProduct,
    quantity: number
  ): Promise<ProductReservation[]> => {
    const now = new Date().toISOString();
    const reservation: ProductReservation = {
      id: 'res-' + Date.now(),
      gymId: user.gymId,
      productId: product.id,
      productName: product.name,
      productImage: product.imageUrls[0],
      unitPriceTnd: product.priceTnd,
      quantity,
      userId: user.id,
      userName: user.fullName,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    const next = [reservation, ...(await ShopService.getReservations())];
    await write(RESERVATIONS_KEY, next);
    return next;
  },

  setReservationStatus: async (id: string, status: ReservationStatus): Promise<ProductReservation[]> => {
    const next = (await ShopService.getReservations()).map(r =>
      r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r
    );
    await write(RESERVATIONS_KEY, next);
    return next;
  },
};
