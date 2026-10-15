import { MarketplaceProduct } from '../types/database';

const IMG = {
  tub: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=600',
  tub2: 'https://images.unsplash.com/photo-1593095940071-007dd6a4d3b9?w=600',
  vitamins: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600',
  bar: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=600',
  belt: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600',
  tank: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600',
  shake: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600',
};

const base = { gymId: 'gym-app-01', createdBy: 'owner-1', inStock: true };
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

export const DEFAULT_PRODUCTS: MarketplaceProduct[] = [
  {
    ...base, id: 'prod-1', name: 'Whey Gold Standard 2,27 kg', category: 'Protéine', priceTnd: 280,
    description: '24 g de protéines et 5,5 g de BCAA par dose. Mélange whey isolate premium pour une récupération musculaire optimale.',
    imageUrls: [IMG.tub, IMG.tub2], createdAt: at(1),
  },
  {
    ...base, id: 'prod-2', name: 'ISO-100 Whey Isolate hydrolysée 1,8 kg', category: 'Protéine', priceTnd: 310,
    description: 'Whey isolate ultra-pure à absorption rapide. 0 g de sucre, 0 g de lipides.',
    imageUrls: [IMG.tub2], createdAt: at(2),
  },
  {
    ...base, id: 'prod-3', name: 'Serious Mass Gainer 5,4 kg', category: 'Gainer', priceTnd: 290,
    description: '1 250 kcal par dose avec 50 g de protéines et plus de 250 g de glucides pour prendre du volume rapidement.',
    imageUrls: [IMG.tub], createdAt: at(3),
  },
  {
    ...base, id: 'prod-4', name: 'Mutant Mass Extreme 2500', category: 'Gainer', priceTnd: 320,
    description: 'Conçu pour les prises de masse difficiles : 2 540 kcal par portion journalière, avec de vrais glucides complexes.',
    imageUrls: [IMG.tub2], inStock: false, createdAt: at(4),
  },
  {
    ...base, id: 'prod-5', name: 'Opti-Men multivitamines (90 comprimés)', category: 'Multivitamines', priceTnd: 85,
    description: 'Plus de 75 actifs : vitamines, minéraux, acides aminés et extraits végétaux pensés pour les sportifs.',
    imageUrls: [IMG.vitamins], createdAt: at(5),
  },
  {
    ...base, id: 'prod-6', name: 'Animal Pak – pack vitamines quotidien', category: 'Multivitamines', priceTnd: 140,
    description: 'Le pack d’entraînement iconique : vitamines à haute dose, minéraux, enzymes digestives et antioxydants.',
    imageUrls: [IMG.vitamins], createdAt: at(6),
  },
  {
    ...base, id: 'prod-7', name: 'BCAA 2:1:1 Energy (300 g)', category: 'Pre-Workout', priceTnd: 75, originalPriceTnd: 95, isPromo: true,
    description: 'Acides aminés ramifiés pour l’endurance pendant l’effort et la protection musculaire.',
    imageUrls: [IMG.tub], createdAt: at(7),
  },
  {
    ...base, id: 'prod-8', name: 'Barres protéinées Crunch – boîte de 12', category: 'Snacks & Boissons', priceTnd: 55, originalPriceTnd: 70, isPromo: true,
    description: 'Barres croquantes à 20 g de protéines et peu de sucre. Idéales après l’entraînement.',
    imageUrls: [IMG.bar], createdAt: at(8),
  },
  {
    ...base, id: 'prod-9', name: 'Ceinture de force en cuir', category: 'Accessoires', priceTnd: 95,
    description: 'Ceinture en cuir rembourré de 10 cm pour protéger le bas du dos sur les squats et soulevés de terre lourds.',
    imageUrls: [IMG.belt], createdAt: at(9),
  },
  {
    ...base, id: 'prod-10', name: 'Sangles et bandes de poignet', category: 'Accessoires', priceTnd: 45,
    description: 'Sangles en coton antidérapantes et bandes élastiques pour un grip maximal sur les tirages lourds.',
    imageUrls: [IMG.belt], createdAt: at(10),
  },
  {
    ...base, id: 'prod-11', name: 'Débardeur de performance', category: 'Accessoires', priceTnd: 50,
    description: 'Tissu respirant qui évacue la transpiration, coupe libre pour une mobilité totale des épaules.',
    imageUrls: [IMG.tank], createdAt: at(11),
  },
  {
    ...base, id: 'prod-12', name: 'Shake whey maison (30 g de protéines)', category: 'Snacks & Boissons', priceTnd: 12,
    description: 'Préparé au bar du club : whey isolate mixée avec banane, flocons d’avoine et beurre de cacahuète.',
    imageUrls: [IMG.shake], createdAt: at(12),
  },
  {
    ...base, id: 'prod-13', name: 'Barre Carb Killa – caramel salé', category: 'Snacks & Boissons', priceTnd: 9,
    description: 'Barre croquante triple couche : 21 g de protéines et moins de 2 g de sucre.',
    imageUrls: [IMG.bar], createdAt: at(13),
  },
  {
    ...base, id: 'prod-14', name: 'C4 Ultimate Pre-Workout (30 doses)', category: 'Pre-Workout', priceTnd: 165,
    description: '300 mg de caféine, 3,2 g de bêta-alanine et booster de pump pour une énergie explosive.',
    imageUrls: [IMG.bar], createdAt: at(14),
  },
  {
    ...base, id: 'prod-15', name: 'C4 Energy – boisson gazeuse 500 ml', category: 'Pre-Workout', priceTnd: 8.5,
    description: 'Boisson énergisante prête à boire, sans sucre : 200 mg de caféine et bêta-alanine.',
    imageUrls: [IMG.bar], createdAt: at(15),
  },
];
