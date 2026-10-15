import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { MarketplaceProduct, ProductReservation, ReservationStatus, ShopCategory, UserProfile } from '../types/database';
import { GymConfigService } from '../config/gymConfig';
import { ShopService, isActive } from '../services/shopService';
import { hasPermission } from '../services/permissionsService';
import { colors } from '../theme';
import { ProductCard } from '../components/shop/ProductCard';
import { ProductSheet } from '../components/shop/ProductSheet';
import { ReservationsSheet } from '../components/shop/ReservationsSheet';
import { ProductFormModal, ProductDraft } from '../components/shop/ProductFormModal';
import { CategoryRail } from '../components/shop/CategoryRail';
import { PromoHero } from '../components/shop/PromoHero';
import { OrdersPill } from '../components/shop/OrdersPill';
import { CATEGORY_META, ProductCategory } from '../shop/categoryMeta';
import { useScrollToTopOnReselect } from '../navigation/tabEvents';
import { Toast } from '../components/home/Toast';

interface MarketplaceScreenProps {
  user: UserProfile;
}

const CATEGORIES: ProductCategory[] = ['Protéine', 'Gainer', 'Multivitamines', 'Pre-Workout', 'Accessoires', 'Snacks & Boissons'];

type Filter = 'all' | 'promo' | ProductCategory;
type Sort = 'default' | 'priceAsc' | 'priceDesc';
const SORT_LABEL: Record<Sort, string> = { default: 'Nouveautés', priceAsc: 'Prix ↑', priceDesc: 'Prix ↓' };
const NEXT_SORT: Record<Sort, Sort> = { default: 'priceAsc', priceAsc: 'priceDesc', priceDesc: 'default' };

const KpiTile: React.FC<{ icon: string; value: number; label: string; tint?: { bar: string; soft: string; text: string }; onPress?: () => void }> = ({ icon, value, label, tint, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={!onPress}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={`${label} : ${value}`}
    style={[styles.kpi, tint && value > 0 && { backgroundColor: tint.soft }]}
  >
    <Ionicons name={icon as any} size={18} color={tint && value > 0 ? tint.text : colors.textSecondary} />
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
  const [form, setForm] = useState<{ open: boolean; product: MarketplaceProduct | null }>({ open: false, product: null });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    ShopService.getProducts().then(setProducts);
    ShopService.getReservations().then(setReservations);
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
  const activeCategoryTint = filter !== 'all' && filter !== 'promo' ? CATEGORY_META[filter]?.tint : null;

  // ---- Actions ----
  const reserve = async (p: MarketplaceProduct, qty: number) => {
    setReservations(await ShopService.reserve(user, p, qty));
    setActiveId(null);
    setToast('Réservé ! Retire-le à l’accueil du club');
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logo}>
          <Ionicons name="bag-handle" size={16} color={colors.brand} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>Boutique</Text>
          {!!gymName && <Text style={styles.subtitle} numberOfLines={1}>{gymName}</Text>}
        </View>
        <Pressable onPress={() => setShowSearch(v => !v)} accessibilityRole="button" accessibilityLabel="Rechercher" style={styles.headerBtn}>
          <Ionicons name={showSearch ? 'close' : 'search-outline'} size={22} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => setShowOrders(true)}
          accessibilityRole="button"
          accessibilityLabel={canManage ? 'Commandes' : 'Mes réservations'}
          style={styles.headerBtn}
        >
          <Ionicons name={canManage ? 'clipboard-outline' : 'bag-check-outline'} size={22} color={colors.text} />
          {badgeCount > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text></View>
          )}
        </Pressable>
      </View>

      {showSearch && (
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Chercher un produit…"
            placeholderTextColor={colors.textMuted}
            autoFocus
            accessibilityLabel="Chercher un produit"
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      )}

      {/* Category rail (colored bubbles) — sticky-feeling section */}
      <View style={styles.railWrap}>
        <CategoryRail active={filter} counts={counts} onSelect={setFilter} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Members: order status pill */}
        {!canManage && myActiveReservations.length > 0 && (
          <OrdersPill reservations={myActiveReservations} onPress={() => setShowOrders(true)} />
        )}

        {/* Promo hero */}
        {filter === 'all' && !query && promoProducts.length > 0 && (
          <PromoHero products={promoProducts} onPress={p => setActiveId(p.id)} />
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
            {activeCategoryTint && <View style={[styles.sectionDot, { backgroundColor: activeCategoryTint.bar }]} />}
            {filter === 'promo' && <Ionicons name="pricetag" size={14} color={colors.red.text} />}
            <Text style={styles.sectionTitle}>{activeSectionTitle}</Text>
            <Text style={styles.sectionCount}>· {filtered.length}</Text>
          </View>
          <Pressable onPress={() => setSort(NEXT_SORT[sort])} accessibilityRole="button" accessibilityLabel={`Trier : ${SORT_LABEL[sort]}`} style={styles.sortBtn}>
            <Ionicons name="swap-vertical" size={14} color={colors.textSecondary} />
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
              <Ionicons name="basket-outline" size={32} color={colors.textMuted} />
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

      {canManage && (
        <Pressable
          onPress={() => setForm({ open: true, product: null })}
          accessibilityRole="button"
          accessibilityLabel="Ajouter un produit"
          style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          <Ionicons name="add" size={22} color={colors.white} />
          <Text style={styles.fabText}>Produit</Text>
        </Pressable>
      )}

      <ProductSheet
        product={activeProduct}
        isOwner={canManage}
        onClose={() => setActiveId(null)}
        onReserve={reserve}
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

  header: { height: 68, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 16, paddingRight: 8, backgroundColor: colors.header },
  logo: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, lineHeight: 20 },
  subtitle: { fontSize: 12, color: colors.textMuted, lineHeight: 14 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: colors.red.bar, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.card },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '800' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, marginHorizontal: 16, marginTop: 10, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, height: '100%' as any },

  // Same grey as the header: header and categories read as one top block.
  railWrap: { backgroundColor: colors.header, borderBottomWidth: 1, borderBottomColor: colors.border },

  content: { padding: 16, paddingBottom: 96, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },

  kpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 2 },
  kpiValue: { fontSize: 20, fontWeight: '900', color: colors.text },
  kpiLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700' },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  sectionCount: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sortText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  skeletonCard: { width: '48.5%', height: 240, borderRadius: 20, backgroundColor: colors.track },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.textSecondary },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', maxWidth: 300 },
  clearBtn: { marginTop: 12, height: 44, paddingHorizontal: 22, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 14, fontWeight: '700', color: colors.text },

  fab: {
    position: 'absolute', right: 16, bottom: 16,
    height: 48, paddingHorizontal: 18, borderRadius: 24,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.brand,
    shadowColor: colors.text, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 6,
  },
  fabText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});
