import React, { useEffect, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { MarketplaceProduct, ShopCategory } from '../../types/database';
import { colors } from '../../theme';
import { useBackHandler } from '../../navigation/backStack';
import { useSwipeToDismiss } from '../useSwipeToDismiss';
import { ProductImage } from './ProductImage';

export type ProductDraft = Pick<
  MarketplaceProduct,
  'name' | 'category' | 'description' | 'priceTnd' | 'originalPriceTnd' | 'isPromo' | 'inStock' | 'lowStock' | 'imageUrls'
>;

interface Props {
  visible: boolean;
  product: MarketplaceProduct | null; // null → new product
  categories: ShopCategory[];
  onClose: () => void;
  onSave: (draft: ProductDraft) => void;
}

const num = (s: string) => parseFloat(s.replace(',', '.'));

export const ProductFormModal: React.FC<Props> = ({ visible, product, categories, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ShopCategory>(categories[0]);
  const [price, setPrice] = useState('');
  const [promo, setPromo] = useState(false);
  const [oldPrice, setOldPrice] = useState('');
  const [inStock, setInStock] = useState(true);
  const [lowStock, setLowStock] = useState(false);
  const [desc, setDesc] = useState('');
  const [images, setImages] = useState<string[]>(['']);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setName(product?.name ?? '');
    setCategory(product?.category ?? categories[0]);
    setPrice(product ? String(product.priceTnd) : '');
    setPromo(!!product?.isPromo);
    setOldPrice(product?.originalPriceTnd ? String(product.originalPriceTnd) : '');
    setInStock(product?.inStock ?? true);
    setLowStock(product?.lowStock ?? false);
    setDesc(product?.description ?? '');
    setImages(product?.imageUrls.length ? product.imageUrls : ['']);
  }, [visible, product]);

  const save = () => {
    const e: Record<string, string> = {};
    const p = num(price);
    const o = num(oldPrice);
    if (!name.trim()) e.name = 'Donne un nom au produit.';
    if (!(p > 0)) e.price = 'Entre un prix supérieur à 0.';
    if (promo && !(o > p)) e.oldPrice = 'L’ancien prix doit être supérieur au prix actuel.';
    setErrors(e);
    if (Object.keys(e).length) return;

    onSave({
      name: name.trim(),
      category,
      description: desc.trim(),
      priceTnd: p,
      originalPriceTnd: promo ? o : undefined,
      isPromo: promo,
      inStock,
      lowStock,
      imageUrls: images.map(u => u.trim()).filter(Boolean),
    });
  };

  useBackHandler(visible, onClose);
  const swipe = useSwipeToDismiss(onClose);

  const pct = promo && num(oldPrice) > num(price) && num(price) > 0 ? Math.round((1 - num(price) / num(oldPrice)) * 100) : 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Animated.View style={[styles.root, swipe.style]}>
        <View {...swipe.panHandlers} style={styles.header}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" style={styles.closeBtn}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{product ? 'Modifier le produit' : 'Nouveau produit'}</Text>
          <View style={{ width: 44 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            {/* Photos */}
            <Text style={styles.label}>Photos (liens d’images)</Text>
            {images.map((u, i) => (
              <View key={i} style={styles.imgRow}>
                <ProductImage uri={u.trim() || undefined} style={styles.imgThumb} iconSize={20} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={u}
                  onChangeText={t => setImages(prev => prev.map((x, j) => (j === i ? t : x)))}
                  placeholder="https://…"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                {images.length > 1 && (
                  <Pressable
                    onPress={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Retirer cette photo"
                    style={styles.removeBtn}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.red.text} />
                  </Pressable>
                )}
              </View>
            ))}
            {images.length < 5 && (
              <Pressable onPress={() => setImages(prev => [...prev, ''])} accessibilityRole="button" style={styles.addImg}>
                <Ionicons name="add" size={18} color={colors.text} />
                <Text style={styles.addImgText}>Ajouter une photo</Text>
              </Pressable>
            )}

            {/* Name */}
            <Text style={styles.label}>Nom du produit</Text>
            <TextInput
              style={[styles.input, !!errors.name && styles.inputError]}
              value={name}
              onChangeText={setName}
              placeholder="Ex : Whey Isolate 2 kg"
              placeholderTextColor={colors.textMuted}
            />
            {!!errors.name && <Text style={styles.error}>{errors.name}</Text>}

            {/* Category */}
            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.chips}>
              {categories.map(c => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === c }}
                  style={[styles.chip, category === c && styles.chipOn]}
                >
                  <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            {/* Price */}
            <Text style={styles.label}>Prix (TND)</Text>
            <TextInput
              style={[styles.input, !!errors.price && styles.inputError]}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="120"
              placeholderTextColor={colors.textMuted}
            />
            {!!errors.price && <Text style={styles.error}>{errors.price}</Text>}

            {/* Promo */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Produit en promo</Text>
                <Text style={styles.switchSub}>Affiche l’ancien prix barré et le pourcentage de remise.</Text>
              </View>
              <Switch
                value={promo}
                onValueChange={setPromo}
                trackColor={{ true: colors.red.bar, false: colors.disabled }}
                thumbColor={colors.white}
              />
            </View>
            {promo && (
              <>
                <Text style={styles.label}>Ancien prix (TND)</Text>
                <TextInput
                  style={[styles.input, !!errors.oldPrice && styles.inputError]}
                  value={oldPrice}
                  onChangeText={setOldPrice}
                  keyboardType="decimal-pad"
                  placeholder="150"
                  placeholderTextColor={colors.textMuted}
                />
                {!!errors.oldPrice ? (
                  <Text style={styles.error}>{errors.oldPrice}</Text>
                ) : pct > 0 ? (
                  <Text style={styles.hint}>Remise affichée : -{pct}%</Text>
                ) : null}
              </>
            )}

            {/* Stock */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Disponible en stock</Text>
                <Text style={styles.switchSub}>Désactive pour afficher « Rupture » et bloquer les réservations.</Text>
              </View>
              <Switch
                value={inStock}
                onValueChange={setInStock}
                trackColor={{ true: colors.green.bar, false: colors.disabled }}
                thumbColor={colors.white}
              />
            </View>

            {/* Low stock (manual flag, not tied to any quantity count) */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Stock faible</Text>
                <Text style={styles.switchSub}>À activer toi-même quand il en reste peu : affiche une alerte côté club.</Text>
              </View>
              <Switch
                value={lowStock}
                onValueChange={setLowStock}
                trackColor={{ true: colors.amber.bar, false: colors.disabled }}
                thumbColor={colors.white}
              />
            </View>

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }]}
              value={desc}
              onChangeText={setDesc}
              multiline
              placeholder="Composition, saveur, conseils d’utilisation…"
              placeholderTextColor={colors.textMuted}
            />
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={save} accessibilityRole="button" style={styles.saveBtn}>
              <Text style={styles.saveText}>{product ? 'Enregistrer' : 'Publier dans la boutique'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: Platform.OS === 'android' ? 24 : 0,
  },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  form: { padding: 20, paddingBottom: 32, maxWidth: 640, width: '100%', alignSelf: 'center' },
  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginTop: 18, marginBottom: 8 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  inputError: { borderColor: colors.red.bar },
  error: { color: colors.red.text, fontSize: 13, fontWeight: '600', marginTop: 6 },
  hint: { color: colors.green.text, fontSize: 13, fontWeight: '700', marginTop: 6 },

  imgRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  imgThumb: { width: 48, height: 48, borderRadius: 12 },
  removeBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  addImg: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addImgText: { fontSize: 14, fontWeight: '700', color: colors.text },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: colors.white },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.bg,
  },
  switchTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  switchSub: { fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  // Brand blue = the one primary action
  saveBtn: { height: 52, borderRadius: 26, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
