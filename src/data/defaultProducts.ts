import { MarketplaceProduct } from '../types/database';

/**
 * Demo catalogue: real products and prices from housenutrition.tn (Tunis), with their
 * photos loaded from their site. Replace with the club's own products before going live.
 */
const HN = 'https://www.housenutrition.tn/storage/uploads/products/images/';

const base = { gymId: 'gym-app-01', createdBy: 'owner-1', inStock: true };
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

export const DEFAULT_PRODUCTS: MarketplaceProduct[] = [
  // ---- Protéine ----
  {
    ...base, id: 'hn-458', name: 'Isolate Whey Animal 1,81 kg', category: 'Protéine', priceTnd: 350,
    description: 'Whey isolate Animal : environ 25 g de protéines par dose, très peu de sucre et de lipides. Se mélange en quelques secondes, idéale juste après la séance.',
    imageUrls: [HN + 'iso%20animal%201.webp-6912483f0dce5.webp'], createdAt: at(1),
  },
  {
    ...base, id: 'hn-672', name: 'Whey XS Ronnie Coleman 2,26 kg', category: 'Protéine', priceTnd: 195, originalPriceTnd: 230, isPromo: true,
    description: 'La whey de la gamme Ronnie Coleman : 24 g de protéines par dose, bon rapport qualité-prix pour couvrir tes besoins au quotidien.',
    imageUrls: [HN + 'whey%20xs.webp-68bf552642c3a.webp'], createdAt: at(2),
  },
  {
    ...base, id: 'hn-iso-hd', name: 'ISO HD BPI 2,2 kg', category: 'Protéine', priceTnd: 370,
    description: 'Whey isolate et hydrolysée BPI Sports, goût chocolate brownie. Absorption rapide pour la récupération.',
    imageUrls: [HN + 'iso_hd-chocolate_brownie-69serv-ts.webp-68c6ef9fe4407.webp'], createdAt: at(3),
  },
  {
    ...base, id: 'hn-651', name: 'Whey Isolate Scitec Nutrition 700 g', category: 'Protéine', priceTnd: 160, originalPriceTnd: 180, isPromo: true,
    description: 'Le format découverte de l’isolate Scitec : idéal pour essayer avant de passer au grand pot.',
    imageUrls: [HN + '2278_7c8ab32f7dd0.webp-68693b8d125aa.webp'], createdAt: at(4),
  },
  {
    ...base, id: 'hn-elite', name: 'Elite Whey Yava Labs 2 kg', category: 'Protéine', priceTnd: 290,
    description: 'Concentrée et isolate de whey, enrichie en BCAA. Une valeur sûre pour la prise de muscle.',
    imageUrls: [HN + 'elite.webp-694fb5c2f3db0.webp'], createdAt: at(5),
  },
  {
    ...base, id: 'hn-impact', name: 'Premium Whey Enhanced Impact 1,89 kg', category: 'Protéine', priceTnd: 250,
    description: 'Whey premium au goût banoffee, texture crémeuse. Parfaite en shaker ou dans tes pancakes protéinés.',
    imageUrls: [HN + 'enhanced-premium-whey-banoffee-bottle-b-1890kg__preview%20(1).webp-69c40ec3425c2.webp'], createdAt: at(6),
  },
  {
    ...base, id: 'hn-789', name: 'Casein Pro Micellar Bigman 907 g', category: 'Protéine', priceTnd: 120, originalPriceTnd: 150, isPromo: true,
    description: 'Caséine micellaire à digestion lente : à prendre le soir pour nourrir tes muscles pendant la nuit.',
    imageUrls: [HN + '71F7UeurBDL._AC_SX679_.webp-696fa0bf621bc.webp'], createdAt: at(7),
  },
  {
    ...base, id: 'hn-casein', name: '100% Casein Complex Scitec 920 g', category: 'Protéine', priceTnd: 190,
    description: 'Mélange de caséines à libération progressive, pour une récupération longue durée.',
    imageUrls: [HN + '9158_2433224b3a26.webp-6a50c3382e58f.webp'], createdAt: at(8),
  },

  // ---- Gainer ----
  {
    ...base, id: 'hn-486', name: 'King Mass XXL Ronnie Coleman 10 kg', category: 'Gainer', priceTnd: 350, originalPriceTnd: 440, isPromo: true,
    description: 'Le gros format pour les prises de masse difficiles : beaucoup de calories, de glucides et de protéines par dose.',
    imageUrls: [HN + 'Ronnie_Coleman-removebg-preview.webp-6683d7e68b854.webp'], createdAt: at(2),
  },
  {
    ...base, id: 'hn-582', name: 'Hyper Mass BioTech USA 4 kg', category: 'Gainer', priceTnd: 280, originalPriceTnd: 300,
    description: 'Gainer équilibré glucides et protéines, avec créatine. Pour prendre du poids sans trop de sucre.',
    imageUrls: [HN + 'biothypermass.webp-686c208c83690.webp'], createdAt: at(4),
  },
  {
    ...base, id: 'hn-549', name: 'Lean Mass Gainer Warrior 5 kg', category: 'Gainer', priceTnd: 210, originalPriceTnd: 240,
    description: 'Gainer « lean » : une prise de masse plus propre, avec des glucides complexes et peu de sucres rapides.',
    imageUrls: [HN + 'lean%20mass%20nutrition.png-68c3d0722cd1e.png'], createdAt: at(6),
  },
  {
    ...base, id: 'hn-526', name: 'Complex Mass Pro Yava Labs 6 kg', category: 'Gainer', priceTnd: 290, inStock: false,
    description: 'Gainer goût vanille, glucides complexes et protéines de whey. De retour très bientôt.',
    imageUrls: [HN + 'yava_complex_mass_pro_6kg_van.webp-688091ec20cab.webp'], createdAt: at(9),
  },

  // ---- Multivitamines ----
  {
    ...base, id: 'hn-283', name: 'Animal Pak, 30 packs', category: 'Multivitamines', priceTnd: 185, originalPriceTnd: 200,
    description: 'Le pack d’entraînement iconique : vitamines, minéraux, enzymes digestives et antioxydants, un sachet par jour.',
    imageUrls: [HN + 'animal-pak-30-packs-.webp-69120d95051fe.webp'], createdAt: at(3),
  },
  {
    ...base, id: 'hn-496', name: 'Vita XS Ronnie Coleman, 120 capsules', category: 'Multivitamines', priceTnd: 130,
    description: 'Multivitamines complètes pour sportifs, à prendre au petit-déjeuner.',
    imageUrls: [HN + 'Gemini_Generated_Image_3iyevu3iyevu3iye%20(1).webp-69fa2cd555810.webp'], createdAt: at(5),
  },
  {
    ...base, id: 'hn-667', name: 'Vitadapt Complete Nutrex, 90 capsules', category: 'Multivitamines', priceTnd: 129, originalPriceTnd: 150,
    description: 'Vitamines, minéraux et adaptogènes pour l’énergie et la récupération au quotidien.',
    imageUrls: [HN + 'Vitadapt.webp-689c9ab51b9e2.webp'], createdAt: at(7),
  },
  {
    ...base, id: 'hn-532', name: 'Oméga 3 Yava Labs, 90 capsules', category: 'Multivitamines', priceTnd: 90, originalPriceTnd: 100, lowStock: true,
    description: 'Acides gras EPA et DHA pour le cœur, les articulations et la récupération.',
    imageUrls: [HN + 'OMEGA.webp-694bdd3ea1b8c.webp'], createdAt: at(8),
  },

  // ---- Pre-Workout (pré-workout, créatine, acides aminés) ----
  {
    ...base, id: 'hn-61', name: 'C4 Original Cellucor 200 g', category: 'Pre-Workout', priceTnd: 130, originalPriceTnd: 140,
    description: 'Le pré-workout le plus connu : énergie, concentration et congestion. Une dose 20 à 30 minutes avant la séance.',
    imageUrls: [HN.replace('/images/', '/nutritionFacts/') + 'b6760f89-f5fc-45be-bbf8-30afb8453be3.png-695a78589a371.webp-6aa41f1a83dd8.webp'], createdAt: at(1),
  },
  {
    ...base, id: 'hn-745', name: 'C4 Ultimate Cellucor 500 g', category: 'Pre-Workout', priceTnd: 170,
    description: 'La version la plus dosée du C4, pour les séances les plus intenses.',
    imageUrls: [HN + '0f9b98fc-48d5-4f27-8d4d-7fa250a68db7.png-693af02643b30.png'], createdAt: at(4),
  },
  {
    ...base, id: 'hn-666', name: 'Créatine monohydrate Nutrex 1 kg', category: 'Pre-Workout', priceTnd: 249, originalPriceTnd: 300, isPromo: true,
    description: 'Créatine monohydrate pure : 5 g par jour pour plus de force et de puissance. Le complément le plus étudié.',
    imageUrls: [HN + 'Creatine-200.webp-689b68479917d.webp-689c9a234eedb.webp'], createdAt: at(2),
  },
  {
    ...base, id: 'hn-702', name: 'Pure Creatine Animal 300 g', category: 'Pre-Workout', priceTnd: 150, originalPriceTnd: 170, lowStock: true,
    description: 'Créatine monohydrate micronisée Animal, sans goût : se mélange à ta boisson ou à ton shaker.',
    imageUrls: [HN + 'Gemini_Generated_Image_76kao76kao76kao7%20(1).webp-69d63070de654.webp'], createdAt: at(6),
  },
  {
    ...base, id: 'hn-787', name: 'Créatine micronisée Weider 310 g', category: 'Pre-Workout', priceTnd: 100,
    description: 'Créatine micronisée pour une meilleure dissolution. Le bon format pour commencer.',
    imageUrls: [HN + 'WEIDER%20CREA.webp-696f99f2ab853.webp'], createdAt: at(8),
  },
  {
    ...base, id: 'hn-926', name: 'BCAA Xtend 400 g', category: 'Pre-Workout', priceTnd: 119, originalPriceTnd: 140, isPromo: true,
    description: 'BCAA 2:1:1 avec électrolytes, à siroter pendant l’entraînement pour l’endurance et la récupération.',
    imageUrls: [HN + '101-min.webp-694134881809e.webp-6a770e7ec23e7.webp'], createdAt: at(3),
  },
  {
    ...base, id: 'hn-493', name: 'Amino Tone + EAA Ronnie Coleman 540 g', category: 'Pre-Workout', priceTnd: 160,
    description: 'Acides aminés essentiels et BCAA, goût fruité, pour rester hydraté et récupérer plus vite.',
    imageUrls: [HN + 'Gemini_Generated_Image_p9wjfsp9wjfsp9wj.webp-6a328c15e4e7f.webp'], createdAt: at(9),
  },

  // ---- Accessoires ----
  {
    ...base, id: 'hn-straps', name: 'Straps House Nutrition', category: 'Accessoires', priceTnd: 35, originalPriceTnd: 50,
    description: 'Sangles de tirage pour garder ta prise sur les soulevés de terre et le tirage lourd.',
    imageUrls: [HN + 'HN---STRAPS.png-658da0390f68f.webp-65eb0dd225ef2.webp'], createdAt: at(5),
  },
  {
    ...base, id: 'hn-wraps', name: 'Serre-poignets House Nutrition', category: 'Accessoires', priceTnd: 30, originalPriceTnd: 40,
    description: 'Bandes de poignet pour stabiliser tes poignets au développé couché et aux presses.',
    imageUrls: [HN + 'produit_-_2024-05-03T160855.906-removebg-preview.webp-6634f04837635.webp'], createdAt: at(7),
  },

  // ---- Snacks & Boissons ----
  {
    ...base, id: 'hn-crunch', name: 'Crunch Bar Warrior 64 g', category: 'Snacks & Boissons', priceTnd: 12,
    description: 'Barre protéinée croquante chocolat blanc, environ 20 g de protéines. La collation parfaite après la séance.',
    imageUrls: [HN + 'singlebar-WarriorCrunchBarWhiteChocolateCrisp-64g-ProteinPackage-PickandM_grande.webp-69302b5df3b53.png-6938179043021.png'], createdAt: at(1),
  },
  {
    ...base, id: 'hn-dido', name: 'Oat Bar Dido’s 55 g', category: 'Snacks & Boissons', priceTnd: 8,
    description: 'Barre d’avoine moelleuse pour l’énergie avant l’entraînement.',
    imageUrls: [HN + 'image-1400x1400-14.webp-6a4263a5efff3.webp'], createdAt: at(4),
  },
  {
    ...base, id: 'hn-lino', name: 'Oats Bar Lino 70 g', category: 'Snacks & Boissons', priceTnd: 8,
    description: 'Barre aux flocons d’avoine, simple et rassasiante.',
    imageUrls: [HN + '430146_uvlnwtogtvcmtyqk.webp-6a428cd96c6a9.webp'], createdAt: at(6),
  },
  {
    ...base, id: 'hn-742', name: 'Preworkout Shot Cellucor 60 ml', category: 'Snacks & Boissons', priceTnd: 10,
    description: 'Un shot C4 prêt à boire, pratique à glisser dans ton sac.',
    imageUrls: [HN + '7f2e3604-bfb8-4354-a86d-3d08dff890e1.png-693a9d32e0bd9.png'], createdAt: at(2),
  },
  {
    ...base, id: 'hn-673', name: 'L-Carnitine XS 4000 Ronnie Coleman 465 ml', category: 'Snacks & Boissons', priceTnd: 150,
    description: 'L-carnitine liquide goût pomme, à prendre avant le cardio.',
    imageUrls: [HN + 'l%20carnitine%204000%20apple.webp-68bf575392ad1.webp'], createdAt: at(8),
  },
];
