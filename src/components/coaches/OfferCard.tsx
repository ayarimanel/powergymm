import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { CoachPricingPlan } from '../../types/database';
import { fmtTnd, planText } from '../../coaching/offers';
import { J, tabular } from '../../journal/ui/kit';
import { colors } from '../../theme';

interface Props {
  offer: CoachPricingPlan;
  selected?: boolean;
  onPress?: () => void;
  /** Coach's own editor: edit / delete instead of a radio. */
  onEdit?: () => void;
  onDelete?: () => void;
}

/** A coach's plan: name, price, and what the coach wrote about it. */
export const OfferCard: React.FC<Props> = ({ offer, selected, onPress, onEdit, onDelete }) => {
  const text = planText(offer);
  const body = (
    <>
      {offer.isPopular && (
        <View style={s.popular}>
          <Icon name="star" size={10} color={colors.white} />
          <Text style={s.popularText}>Le plus choisi</Text>
        </View>
      )}
      <View style={s.top}>
        <Text style={s.title}>{offer.title}</Text>
        <Text style={[s.price, tabular]}>{fmtTnd(offer.priceTnd)}</Text>
        {onPress && (
          <View style={[s.radio, selected && s.radioOn]}>
            {selected && <View style={s.radioDot} />}
          </View>
        )}
      </View>
      {!!text && <Text style={s.text}>{text}</Text>}
      {(onEdit || onDelete) && (
        <View style={s.actions}>
          {onEdit && (
            <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Modifier ${offer.title}`} hitSlop={6} style={s.action}>
              <Icon name="create-outline" size={16} color={J.fg} />
              <Text style={s.actionText}>Modifier</Text>
            </Pressable>
          )}
          {onDelete && (
            <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel={`Supprimer ${offer.title}`} hitSlop={6} style={s.action}>
              <Icon name="trash-outline" size={16} color={J.tiredText} />
              <Text style={[s.actionText, { color: J.tiredText }]}>Supprimer</Text>
            </Pressable>
          )}
        </View>
      )}
    </>
  );
  const style = [s.card, offer.isPopular && s.cardPopular, selected && s.cardSelected];
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: !!selected }} style={({ pressed }) => [...style, pressed && { opacity: 0.9 }]}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
};

const s = StyleSheet.create({
  card: { backgroundColor: J.surface, borderWidth: 1.5, borderColor: J.line, borderRadius: 18, padding: 14, gap: 8 },
  cardPopular: { borderColor: J.goldBright, paddingTop: 18 },
  cardSelected: { borderColor: J.accent, backgroundColor: J.accentSoft },
  popular: { position: 'absolute', top: -10, left: 14, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: J.goldBright, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  popularText: { color: colors.white, fontSize: 10.5, fontWeight: '900' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: J.fg },
  price: { fontSize: 20, fontWeight: '900', color: J.fg },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: J.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: J.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: J.accent },
  text: { fontSize: 13.5, lineHeight: 20, color: J.muted },
  actions: { flexDirection: 'row', gap: 16, borderTopWidth: 1, borderTopColor: J.line, paddingTop: 10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32 },
  actionText: { fontSize: 13, fontWeight: '800', color: J.fg },
});
