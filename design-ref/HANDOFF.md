# Power Gym Tunis — UI redesign handoff

Redesign of https://powergym-tau.vercel.app (Expo / React Native web).
**Rule: change the look only. Every existing function stays exactly as it works today.**

## What's in this folder
- `ecrans-png/` — one image per screen (2x, 390 px wide phone), numbered in app order. The visual reference.
- `ecrans-html/` — the same screens as HTML/CSS. Open `Langue.html` in a browser: links between screens work (clickable prototype). Copy exact colors, sizes, spacing and the SVG icons from here.
- `ecrans-html/images/` — photos used in the screens (coachs, gym, products, bodies).
- `ecrans-html/fonts/` — Manrope + Barlow Condensed (.woff2).
- `images-pleine-taille/` — the 4 AI body renders at full size (femme/homme, face/dos).
- Figma (styles, colors, icons, navbar, buttons, first screens): https://www.figma.com/design/7MkL14N5wiJ6C3lWFkdSdt

## Design tokens
| Token | Value |
|---|---|
| bg | #0B0B0C |
| surface / surface-2 / surface-3 | #141416 / #1C1C1F / #26262A |
| border | #2A2A2E |
| text / text-2 / text-3 | #F5F5F5 / #A1A1A6 / #6B6B70 |
| primary (brand red) | #E31E24 — soft bg #3A1214 |
| success / warning | #22C55E / #F5A524 |

- **Fonts:** titles Barlow Condensed 800–900, UPPERCASE (big display titles in italic). Body text Manrope 500–800.
- **Radius:** cards 24 · inputs 16 · buttons, chips, pills 999 (fully round).
- **Icons:** Lucide (lucide-react-native), stroke 2. **No emojis anywhere.**
- **Primary button:** height 56, red, white text 800 15px, shadow `0 8px 24px rgba(227,30,36,.35)`. Secondary: outline 1.5px #3A3A3F.
- **Logo:** text wordmark `POWER` + red `GYM`, `TUNIS` small spaced underneath.

## Navbar (all main screens)
Floating bar: 16px from sides, 22px from bottom, height 72, radius 28, surface + border.
5 items: Accueil · Entraînement · **Scan (red circle 52px, in the middle)** · Boutique · Communauté.
Active item = red icon + small red dash under it. Inactive = #6B6B70.

## Screens (in order)
| # | Screen | Notes |
|---|---|---|
| 01 | Langue | Language choice |
| 02 | Bienvenue | Full-screen gym photo, dark gradient, Se connecter / Créer un compte |
| 03 | Connexion | Login |
| 04–09 | Inscription 1–6 | Sign-up as a questionnaire: **one question per screen** + 6-segment progress bar. Rôle → Nom & WhatsApp → Genre & âge (ruler picker) → Objectif → Horaire & muscles → Code secret (PIN) |
| 10 | Accueil | Club news strip, live affluence ring card, quick actions, classes as big photo cards, coaches card |
| 11 | Infos du club | News list, unread dots, tags (INFO, PROMO, COURS, COACH, ÉVÉNEMENT) |
| 12 | Affluence | Ring (% full) + hourly bars + day chips |
| 13 | Scan | Simple QR scanner frame |
| 14 | Scan · succès | Green check, streak, start session |
| 15 | Profil | |
| 16 | Entraînement (Femme) | Streak, week strip, "Tes muscles", **Mon corps** (see below), last sessions as log cards (no photos), weekly stats |
| 17 | Entraînement (Homme) | Same screen, male body |
| 18 | Muscle · exercices | **Bottom sheet** that slides up when a muscle is tapped. No image. Title + status + stats, search, "Ajouter mon exercice", "Les essentiels" (= the base exercises, `e.base` in code), "Autres exercices" |
| 19 | Séance en cours | |
| 20 | Mon bilan | 7/30-day toggle, total volume card, sets per muscle, records |
| 21 | Historique | Session history as a calendar |
| 22–24 | Boutique · Produit · Panier | Shop with "En solde" row; product + cart pages |
| 25–26 | Coachs · Fiche coach | Coach list as photo cards; coach profile as slide-up sheet |
| 27–28 | Communauté · Page communauté | Featured challenge + forums |

## "Mon corps" (body) — how it works
- 2 images side by side: face + dos. Show the **femme** or **homme** images based on the Femme/Homme toggle (default = gender chosen at sign-up).
- The images are neutral grey. Muscle status is shown by a **soft colored glow** drawn on top in code (absolutely positioned circle, `radial-gradient(closest-side, color, transparent)`, `mix-blend-mode: screen`, `blur(4px)`):
  - green #22C55E = Prêt · orange #F5A524 = Récupération · red #E31E24 = Fatigué · no glow = Pas encore.
  - Positions (in % of the image box): chest 50%/25% · upper back 50%/27% · thighs 39% & 61% / 58% (face), 62% (dos).
- Status comes from the existing logic in the app (same as the current colored body).
- Tapping a muscle zone opens the Muscle · exercices sheet for that group (same as today).
- No favorites feature exists → no stars.

## New features (NOT in the current app — "à coder" only if you decide)
- Coach reviews/ratings on the coach profile (marked "NOUVEAU · À CODER").

Everything else is a restyle of functions that already exist.
