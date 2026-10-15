import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { CoachPricingPlan, CoachProfile } from '../../types/database';
import { PLAN_LIMITS, planError, withPlans } from '../../coaching/offers';
import { BottomSheet, SheetScrollView } from '../home/BottomSheet';
import { Btn, J, k, tabular } from '../../journal/ui/kit';
import { OfferCard } from './OfferCard';
import { colors } from '../../theme';

interface Props {
  visible: boolean;
  coach: CoachProfile | null;
  onClose: () => void;
  /** Saves immediately: every add / edit / delete. */
  onChange: (next: CoachProfile, message: string) => void;
}

/** The coach writes his own plans: a name, what it is, a price. */
export const CoachOffersSheet: React.FC<Props> = ({ visible, coach, onClose, onChange }) => {
  const [editing, setEditing] = useState<CoachPricingPlan | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setEditing(coach?.pricingPlans?.length ? null : 'new');
      setConfirmDelete(null);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!coach) return null;
  const plans = coach.pricingPlans ?? [];

  const save = (plan: CoachPricingPlan) => {
    let list = plans.some(p => p.id === plan.id) ? plans.map(p => (p.id === plan.id ? plan : p)) : [...plans, plan];
    if (plan.isPopular) list = list.map(p => (p.id === plan.id ? p : { ...p, isPopular: false })); // one highlight at a time
    onChange(withPlans(coach, list), editing === 'new' ? 'Plan publié' : 'Plan mis à jour');
    setEditing(null);
  };
  const remove = (id: string) => {
    onChange(withPlans(coach, plans.filter(p => p.id !== id)), 'Plan supprimé');
    setConfirmDelete(null);
  };

  return (
    <BottomSheet variant="sheet"
      visible={visible}
      onClose={onClose}
      snaps={[0.94]}
      header={
        <View>
          <Text style={s.title} accessibilityRole="header">{editing ? (editing === 'new' ? 'Nouveau plan' : 'Modifier le plan') : 'Mes plans'}</Text>
          <Text style={k.sub}>Présente ton coaching avec tes mots et fixe ton prix.</Text>
        </View>
      }
    >
      {() => (
        <SheetScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {editing ? (
            <PlanForm initial={editing === 'new' ? null : editing} isFirst={!plans.length} onCancel={plans.length ? () => setEditing(null) : onClose} onSave={save} />
          ) : (
            <>
              {plans.map(p => (
                <View key={p.id} style={{ marginTop: p.isPopular ? 10 : 0 }}>
                  <OfferCard offer={p} onEdit={() => setEditing(p)} onDelete={() => setConfirmDelete(p.id)} />
                  {confirmDelete === p.id && (
                    <View style={s.confirm}>
                      <Text style={s.confirmText}>Supprimer « {p.title} » ?</Text>
                      <Btn small variant="danger" label="Supprimer" onPress={() => remove(p.id)} />
                      <Btn small variant="ghost" label="Non" onPress={() => setConfirmDelete(null)} />
                    </View>
                  )}
                </View>
              ))}
              <Btn full variant="soft" label="+ Ajouter un plan" onPress={() => setEditing('new')} />
            </>
          )}
        </SheetScrollView>
      )}
    </BottomSheet>
  );
};

const PlanForm: React.FC<{ initial: CoachPricingPlan | null; isFirst: boolean; onCancel: () => void; onSave: (p: CoachPricingPlan) => void }> = ({ initial, isFirst, onCancel, onSave }) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? initial?.features?.join(' · ') ?? '');
  const [price, setPrice] = useState(initial ? String(initial.priceTnd).replace('.', ',') : '');
  const [popular, setPopular] = useState(!!initial?.isPopular);
  const [error, setError] = useState<string | null>(null);

  const priceNum = parseFloat(price.replace(',', '.')) || 0;
  const draft: CoachPricingPlan = {
    id: initial?.id ?? `plan-${Date.now()}`,
    title: title.trim(),
    description: description.trim() || undefined,
    priceTnd: priceNum,
    isPopular: popular,
  };

  const submit = () => {
    const err = planError(draft);
    setError(err);
    if (!err) onSave(draft);
  };

  return (
    <View>
      <Text style={s.lbl}>Nom du plan</Text>
      <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Ex : Suivi 1 mois" placeholderTextColor={J.muted} maxLength={PLAN_LIMITS.title} />

      <Text style={s.lbl}>Parle de ton plan</Text>
      <TextInput
        style={[s.input, s.multi]}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={PLAN_LIMITS.description}
        placeholder={'Combien de séances, ce que tu fais avec le membre, ce qui est inclus…\nEx : 3 séances par semaine pendant 1 mois, programme et suivi nutrition.'}
        placeholderTextColor={J.muted}
      />
      <Text style={s.count}>{description.length} / {PLAN_LIMITS.description}</Text>

      <Text style={s.lbl}>Prix</Text>
      <View style={s.priceRow}>
        <TextInput
          style={[s.input, s.priceInput, tabular]}
          value={price}
          onChangeText={t => setPrice(t.replace(/[^0-9.,]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={J.muted}
          accessibilityLabel="Prix en dinars"
        />
        <Text style={s.currency}>DT</Text>
      </View>

      <View style={s.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.switchTitle}>Mettre en avant</Text>
          <Text style={k.sub}>Affiche « Le plus choisi » sur ce plan.</Text>
        </View>
        <Switch value={popular} onValueChange={setPopular} trackColor={{ true: J.goldBright, false: colors.disabled }} thumbColor={colors.white} accessibilityLabel="Mettre en avant" />
      </View>

      {!!title.trim() && (
        <>
          <Text style={[s.lbl, { marginTop: 18 }]}>Aperçu pour les membres</Text>
          <View style={{ marginTop: popular ? 10 : 0 }}>
            <OfferCard offer={draft} />
          </View>
        </>
      )}

      {!!error && <Text style={s.err}>{error}</Text>}
      <View style={s.btns}>
        <Btn variant="ghost" label={isFirst ? 'Plus tard' : 'Annuler'} onPress={onCancel} style={{ flex: 1 }} />
        <Btn label={initial ? 'Enregistrer' : 'Publier le plan'} onPress={submit} style={{ flex: 1.6 }} />
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: J.fg },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  confirmText: { fontSize: 13, color: J.muted, flexShrink: 1 },
  lbl: { fontSize: 12, fontWeight: '800', color: J.muted, marginTop: 14, marginBottom: 6 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: J.line, backgroundColor: J.surface2, paddingHorizontal: 14, fontSize: 16, color: J.fg },
  multi: { minHeight: 120, paddingTop: 12, textAlignVertical: 'top', lineHeight: 21 },
  count: { fontSize: 11, color: J.muted, textAlign: 'right', marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceInput: { flex: 1, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  currency: { fontSize: 18, fontWeight: '900', color: J.fg },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  switchTitle: { fontSize: 15, fontWeight: '800', color: J.fg },
  err: { color: J.tiredText, fontSize: 13, fontWeight: '700', marginTop: 12 },
  btns: { flexDirection: 'row', gap: 10, marginTop: 18 },
});
