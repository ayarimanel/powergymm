import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { Icon } from '../components/ui/Icon';
import { MarketplaceProduct, ProductReservation, ReservationStatus, ShopCategory, UserProfile } from '../types/database';
import { GymConfigService } from '../config/gymConfig';
import { CartItem, ShopService, formatPrice, isActive } from '../services/shopService';
import { hasPermission } from '../services/permissionsService';
import { buttonShadow, colors, fonts, radius } from '../theme';
import { Avatar } from '../components/community/Avatar';
import { Title } from '../components/ui/Title';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ProductCard } from '../components/shop/ProductCard';
import { ProductSheet } from '../components/shop/ProductSheet';
import { ReservationsSheet } from '../components/shop/ReservationsSheet';
import { ProductFormModal, ProductDraft } from '../components/shop/ProductFormModal';
import { CategoryRail } from '../components/shop/CategoryRail';
import { PromoHero } from '../components/shop/PromoHero';
import { CartSheet } from '../components/shop/CartSheet';
import { CATEGORY_META, ProductCategory } from '../shop/categoryMeta';
import { useScrollToTopOnReselect } from '../navigation/tabEvents';
import { Toast } from '../components/home/Toast';

interface MarketplaceScreenProps {
  user: UserProfile;
}

const CATEGORIES: ProductCategory[] = ['Protéine', 'Gainer', 'Multivitamines', 'Pre-Workout', 'Accessoires', 'Snacks & Boissons'];

type Filter = 'all' | 'promo' | ProductCategory;
type Sort = 'default' | 'priceAsc' | 'priceDesc';
const SORT_LABEL: Record<Sort, string> = { default: 'Nouveautés', priceAsc: 'Prix croissant', priceDesc: 'Prix décroissant' };
const NEXT_SORT: Record<Sort, Sort> = { default: 'priceAsc', priceAsc: 'priceDesc', priceDesc: 'default' };

const KpiTile: React.FC<{ icon: string; value: number; label: string; tint?: { bar: string; soft: string; text: string }; onPress?: () => void }> = ({ icon, value, label, tint, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={!onPress}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={`${label} : ${value}`}
    style={styles.kpi}
  >
    <Icon name={icon as any} size={18} color={tint && value > 0 ? tint.text : colors.textSecondary} />
    <Text style={[styles.kpiValue, tint && value > 0 && { color: tint.text }]}>{value}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </Pressable>
);

export const MarketplaceScreen: React.FC<MarketplaceScreenProps> = ({ user }) => {
  const scrollRef = useScrollToTopOnReselect('shop');
  const isOwner = user.role === 'owner';
  const canManage = isOwner || hasPermission(user, 'manageProducts');

  const [products, setProducts] = useState<MarketplaceProduct[] | null>(null);
  const [reservations, setReservations] = useState<ProductReservation[]>([]);
  const [gymName, setGymName] = useState('');
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('default');

  const [activeId, setActiveId] = useState<string | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [form, setForm] = useState<{ open: boolean; product: MarketplaceProduct | null }>({ open: false, product: null });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    ShopService.getProducts().then(setProducts);
    ShopService.getReservations().then(setReservations);
    ShopService.getCart(user.id).then(setCart);
    GymConfigService.getConfig().then(c => setGymName(c.name));
  }, []);

  const persist = useCallback((next: MarketplaceProduct[]) => {
    setProducts(next);
    ShopService.saveProducts(next);
  }, []);

  const myReservations = useMemo(() => reservations.filter(r => r.userId === user.id), [reservations, user.id]);
  const myActiveReservations = useMemo(() => myReservations.filter(isActive), [myReservations]);
  const visibleReservations = canManage ? reservations : myReservations;
  const badgeCount = canManage
    ? reservations.filter(r => r.status === 'pending').length
    : myActiveReservations.length;

  // Members: green badge on "Mes commandes" once an order waits at the desk.
  const ordersReady = !canManage && myActiveReservations.some(r => r.status === 'ready');

  const productList = products ?? [];

  const promoProducts = useMemo(
    () => productList.filter(p => p.isPromo && p.inStock && p.originalPriceTnd && p.originalPriceTnd > p.priceTnd).slice(0, 5),
    [productList]
  );

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { all: productList.length, promo: 0 } as Record<Filter, number>;
    for (const c of CATEGORIES) base[c] = 0;
    for (const p of productList) {
      if (p.isPromo) base.promo += 1;
      if (p.category !== 'Tous') base[p.category] = (base[p.category] ?? 0) + 1;
    }
    return base;
  }, [productList]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = productList.filter(p => {
      const okFilter = filter === 'all' ? true : filter === 'promo' ? !!p.isPromo : p.category === filter;
      const okQuery = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      return okFilter && okQuery;
    });
    const sorted = [...list];
    if (sort === 'priceAsc') sorted.sort((a, b) => a.priceTnd - b.priceTnd);
    if (sort === 'priceDesc') sorted.sort((a, b) => b.priceTnd - a.priceTnd);
    return sorted.sort((a, b) => Number(b.inStock) - Number(a.inStock));
  }, [productList, query, filter, sort]);

  const activeProduct = productList.find(p => p.id === activeId) ?? null;

  // The cart, with each line's current product (lines whose product was removed drop out).
  const cartLines = useMemo(
    () => cart.flatMap(c => {
      const product = productList.find(p => p.id === c.productId);
      return product ? [{ product, quantity: c.quantity }] : [];
    }),
    [cart, productList]
  );
  const cartCount = cartLines.reduce((a, l) => a + l.quantity, 0);
  const cartTotal = cartLines.reduce((a, l) => a + l.quantity * l.product.priceTnd, 0);
  const activeCategoryTint = filter !== 'all' && filter !== 'promo' ? CATEGORY_META[filter]?.tint : null;

  // ---- Actions ----
  const updateCart = (next: CartItem[]) => {
    setCart(next);
    ShopService.saveCart(user.id, next);
  };

  const addToCart = (p: MarketplaceProduct, qty: number) => {
    const has = cart.some(c => c.productId === p.id);
    updateCart(has ? cart.map(c => (c.productId === p.id ? { ...c, quantity: c.quantity + qty } : c)) : [...cart, { productId: p.id, quantity: qty }]);
    setActiveId(null);
    setToast('Ajouté au panier');
  };

  const setCartQty = (productId: string, quantity: number) =>
    updateCart(quantity <= 0 ? cart.filter(c => c.productId !== productId) : cart.map(c => (c.productId === productId ? { ...c, quantity } : c)));

  const order = async () => {
    const lines = cartLines.filter(l => l.product.inStock);
    if (!lines.length) return;
    setReservations(await ShopService.placeOrder(user, lines));
    setCart([]);
    setShowCart(false);
    setToast('Commande envoyée ! Retire-la à l’accueil du club');
  };

  const setStatus = async (id: string, status: ReservationStatus) => {
    setReservations(await ShopService.setReservationStatus(id, status));
  };

  const saveProduct = (draft: ProductDraft) => {
    if (!products) return;
    if (form.product) {
      persist(products.map(p => (p.id === form.product!.id ? { ...p, ...draft } : p)));
      setToast('Produit mis à jour');
    } else {
      persist([
        { ...draft, id: 'prod-' + Date.now(), gymId: user.gymId, createdBy: user.id, createdAt: new Date().toISOString() },
        ...products,
      ]);
      setToast('Produit publié');
    }
    setForm({ open: false, product: null });
  };

  const deleteProduct = (p: MarketplaceProduct) => {
    if (!products) return;
    persist(products.filter(x => x.id !== p.id));
    setActiveId(null);
    setToast('Produit supprimé');
  };

  const toggleStock = (p: MarketplaceProduct, inStock: boolean) =>
    products && persist(products.map(x => (x.id === p.id ? { ...x, inStock } : x)));

  const clearFilters = () => { setQuery(''); setFilter('all'); };

  const activeSectionTitle = filter === 'all'
    ? 'Tous les produits'
    : filter === 'promo' ? 'En promo'
    : CATEGORY_META[filter]?.short ?? filter;

  return (
    <View style={styles.screen}>
      {/* Header (design-ref Boutique): who I am · the club shop · my reservations */}
      <View style={styles.header}>
        <View style={styles.avatarRing}>
          <Avatar name={user.fullName} url={user.avatarUrl} size={42} />
        </View>
        {/* The page title left for the logo band on top (TopBanner) */}
        <View style={{ flex: 1 }} accessible accessibilityRole="header" accessibilityLabel={`Boutique du club${gymName ? `, ${gymName}` : ''}`} />
        <Pressable
          onPress={() => setShowOrders(true)}
          accessibilityRole="button"
          accessibilityLabel={canManage ? 'Commandes' : `Mes commandes${badgeCount ? `, ${badgeCount} en cours${ordersReady ? ', prête à retirer' : ''}` : ''}`}
          style={styles.headerBtn}
        >
          <Icon name={canManage ? 'clipboard-outline' : 'receipt-outline'} size={22} color={colors.text} />
          {badgeCount > 0 && (
            <View style={[styles.badge, ordersReady && { backgroundColor: colors.green.bar }]}><Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text></View>
          )}
        </Pressable>
        {!canManage && (
          <Pressable onPress={() => setShowCart(true)} accessibilityRole="button" accessibilityLabel={`Panier, ${cartCount} article${cartCount > 1 ? 's' : ''}`} style={styles.headerBtn}>
            <Icon name="bag-handle-outline" size={22} color={colors.text} />
            {cartCount > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{cartCount > 9 ? '9+' : cartCount}</Text></View>
            )}
          </Pressable>
        )}
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Search and categories scroll away with the products */}
        <View style={styles.topControls}>
          <View style={styles.searchWrap}>
            <Icon name="search-outline" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Protéine, gainer, ceinture…"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Chercher un produit"
            />
            {!!query && (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
                <Icon name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Categories as chips */}
          <View style={styles.railWrap}>
            <CategoryRail active={filter} counts={counts} onSelect={setFilter} />
          </View>
        </View>

        {/* En solde */}
        {filter === 'all' && !query && promoProducts.length > 0 && (
          <View style={{ gap: 14 }}>
            <SectionHeader title="En solde" actionLabel="Tout voir" onAction={() => setFilter('promo')} />
            <PromoHero products={promoProducts} onPress={p => setActiveId(p.id)} />
          </View>
        )}

        {/* Owner KPIs */}
        {canManage && products && (
          <View style={styles.kpis}>
            <KpiTile icon="cube-outline" value={products.length} label="Produits" />
            <KpiTile icon="alert-circle-outline" value={products.filter(p => !p.inStock).length} label="Rupture" tint={{ bar: colors.red.bar, soft: colors.red.soft, text: colors.red.text }} />
            <KpiTile icon="flame-outline" value={products.filter(p => p.lowStock && p.inStock).length} label="Faible" tint={{ bar: colors.amber.bar, soft: colors.amber.soft, text: colors.amber.text }} />
            <KpiTile icon="time-outline" value={reservations.filter(r => r.status === 'pending').length} label="À traiter" tint={{ bar: colors.amber.bar, soft: colors.amber.soft, text: colors.amber.text }} onPress={() => setShowOrders(true)} />
          </View>
        )}

        {/* Section header */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionTitleWrap}>
            <Title variant="section" numberOfLines={1} style={{ flexShrink: 1 }}>{activeSectionTitle}</Title>
            <Text style={styles.sectionCount}>· {filtered.length}</Text>
          </View>
          <Pressable onPress={() => setSort(NEXT_SORT[sort])} accessibilityRole="button" accessibilityLabel={`Trier : ${SORT_LABEL[sort]}`} style={styles.sortBtn}>
            <Icon name="swap-vertical" size={14} color={colors.textSecondary} />
            <Text style={styles.sortText}>{SORT_LABEL[sort]}</Text>
          </Pressable>
        </View>

        {/* Skeleton */}
        {!products && (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map(i => <View key={i} style={styles.skeletonCard} />)}
          </View>
        )}

        {/* Grid */}
        {products && (
          <View style={styles.grid}>
            {filtered.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                isOwner={canManage}
                onPress={() => setActiveId(p.id)}
                onEdit={() => setForm({ open: true, product: p })}
                onToggleStock={v => toggleStock(p, v)}
              />
            ))}
          </View>
        )}

        {/* Empty state */}
        {products && filtered.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="basket-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Aucun produit trouvé</Text>
            <Text style={styles.emptySub}>Essaie un autre mot-clé ou une autre catégorie.</Text>
            <Pressable onPress={clearFilters} accessibilityRole="button" style={styles.clearBtn}>
              <Text style={styles.clearText}>Effacer les filtres</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Toast message={toast} onHide={() => setToast(null)} />

      {/* Members: the cart, always one tap away once it has something in it */}
      {!canManage && cartCount > 0 && (
        <Pressable
          onPress={() => setShowCart(true)}
          accessibilityRole="button"
          accessibilityLabel={`Voir le panier, ${cartCount} article${cartCount > 1 ? 's' : ''}, ${formatPrice(cartTotal)}`}
          style={({ pressed }) => [styles.cartBar, pressed && { transform: [{ scale: 0.98 }] }]}
        >
          <View style={styles.cartCount}><Text style={styles.cartCountText}>{cartCount}</Text></View>
          <Text style={styles.cartBarText}>Voir le panier</Text>
          <Text style={styles.cartBarTotal}>{formatPrice(cartTotal)}</Text>
        </Pressable>
      )}

      {canManage && (
        <Pressable
          onPress={() => setForm({ open: true, product: null })}
          accessibilityRole="button"
          accessibilityLabel="Ajouter un produit"
          style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          <Icon name="add" size={22} color={colors.white} />
          <Text style={styles.fabText}>Produit</Text>
        </Pressable>
      )}

      <ProductSheet
        product={activeProduct}
        isOwner={canManage}
        onClose={() => setActiveId(null)}
        onReserve={addToCart}
        onEdit={p => { setActiveId(null); setForm({ open: true, product: p }); }}
        onDelete={deleteProduct}
      />
      <ReservationsSheet
        visible={showOrders}
        onClose={() => setShowOrders(false)}
        mode={canManage ? 'owner' : 'member'}
        reservations={visibleReservations}
        onSetStatus={setStatus}
      />
      <CartSheet
        visible={showCart}
        lines={cartLines}
        onClose={() => setShowCart(false)}
        onSetQty={setCartQty}
        onOrder={order}
        onOpenOrders={() => { setShowCart(false); setShowOrders(true); }}
      />
      <ProductFormModal
        visible={form.open}
        product={form.product}
        categories={CATEGORIES}
        onClose={() => setForm({ open: false, product: null })}
        onSave={saveProduct}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, backgroundColor: colors.header },
  avatarRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, lineHeight: 22 },
  subtitle: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, lineHeight: 16 },
  headerBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.bg },
  badge: { position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.page },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },

  cartBar: { position: 'absolute', left: 16, right: 16, bottom: 16, height: 58, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 8, paddingRight: 22, backgroundColor: colors.brand, ...buttonShadow },
  cartCount: { minWidth: 42, height: 42, borderRadius: 21, paddingHorizontal: 8, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  cartCountText: { fontSize: 16, fontWeight: '800', color: colors.brand },
  cartBarText: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.white },
  cartBarTotal: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 22, color: colors.white },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 16, borderRadius: radius.input, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text, height: '100%' as any },

  railWrap: { paddingBottom: 8 },
  /** Cancels the content padding: search and chips keep their own side margins. */
  topControls: { marginHorizontal: -16, marginTop: -16 },

  content: { padding: 16, paddingBottom: 96, gap: 18, maxWidth: 720, width: '100%', alignSelf: 'center' },

  kpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 2 },
  kpiValue: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 24, color: colors.text },
  kpiLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700' },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitleWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  sectionCount: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 22, color: colors.textMuted },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 4 },
  sortText: { fontSize: 14, color: colors.text, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  skeletonCard: { width: '48.5%', height: 260, borderRadius: 20, backgroundColor: colors.track },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.textSecondary },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', maxWidth: 300 },
  clearBtn: { marginTop: 12, height: 44, paddingHorizontal: 22, borderRadius: 22, borderWidth: 1.5, borderColor: colors.disabled, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 14, fontWeight: '700', color: colors.text },

  fab: {
    position: 'absolute', right: 16, bottom: 16,
    height: 52, paddingHorizontal: 20, borderRadius: 26,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.brand,
    ...buttonShadow,
  },
  fabText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});
