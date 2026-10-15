# Power Gym redesign — prompts for Claude Code

Open the folder `powergym/powergym` in VS Code (the one with `App.tsx` and `CLAUDE.md`), start Claude Code, and paste these prompts **one at a time, in order**.

`CLAUDE.md` now loads `design-ref/REDESIGN.md` automatically, so every prompt already knows the rules (look only, no logic changes, no emojis, dark theme, tokens…). You don't need to repeat them.

## How to work each step
1. Paste the prompt. For the big ones marked **PLAN FIRST**, switch Claude Code to *Plan mode* before sending, read its plan, then approve.
2. When it's done, look at the result: `npm run web` (keep it running in a second terminal), open the screen, compare with the PNG in `design-ref/ecrans-png/`.
3. Paste the **check prompt** (bottom of this file) to make Claude Code audit its own diff for anything non-visual.
4. If it looks right: `git add -A && git commit -m "redesign: <screen>"`. If it's wrong: say what's wrong, or throw it away with `git restore . && git clean -fd src assets` (only safe once Prompt 0 has made the first commit — before that it would delete your whole `src`).

Never let it run two screens in one go. Small steps = easy to undo.

---

## Phase 0 — Safety net (do this first, it matters)

Your repo has **no commits yet** and `src/` isn't even tracked, so right now there is nothing to roll back to.

### Prompt 0
```
Before any redesign work: this git repo has no commits yet. Check .gitignore covers node_modules, .env files (root and backend/), dist and .expo. Then stage everything and make a first commit "baseline before redesign", and create and switch to a branch called "redesign". Then run `npx tsc --noEmit`, `npm test` and `npm run check:i18n` and write the results (pass/fail counts, any existing errors) to design-ref/BASELINE.md so we know what was already failing before we started. Do not change any code.
```

---

## Phase 1 — Foundations (whole app changes look, no screen rewritten yet)

### Prompt 1 — Dark tokens
```
Step 1 of the redesign: switch the theme to the dark design tokens in design-ref/HANDOFF.md. Change only src/config/clubTheme.ts and src/theme.ts; keep every exported name and shape the same so no screen breaks.
Mapping: page and header → #0B0B0C; background (cards) → #141416; surface (inputs, secondary bg) → #1C1C1F; surfaceHover/track and barChartDefault → #26262A; surfaceActive → #2E2E33; border → #2A2A2E; divider → #232327; textPrimary #F5F5F5, textSecondary #A1A1A6, textTertiary #6B6B70; primaryLight (brandSoft) → #3A1214; tabInactive → #6B6B70; disabled → #3A3A3F; warning → #F5A524.
The "soft"/"light" tints (success, warning, danger, gold, pink, violet, teal, flame) must become dark tinted backgrounds (e.g. green soft ≈ #12291B) and their "text" colors must become light enough to read on dark (≥4.5:1 on #141416). ink(alpha) should be black-based. cardShadow becomes no shadow (cards = surface + 1px border). buttonShadow = 0 8px 24px rgba(227,30,36,.35).
Then: find places where colors.white is used as a BACKGROUND (not text) and switch them to the card token; fix the ~28 hardcoded hex colors in screens/components so they use tokens; make the StatusBar light-content; anywhere the black-lettering logo (clubTheme.logo) is shown on a now-dark background, use logoOnDark for now.
Run tsc, tests and check:i18n. List anything that now looks wrong (white boxes, unreadable text) that you could not fix with tokens alone.
```

### Prompt 2 — Fonts and title style
```
Step 2: fonts. The design uses Barlow Condensed 800 and 900 (and their italics) for titles, Manrope 500–800 for body. @expo-google-fonts/barlow-condensed is already installed: load BarlowCondensed_800ExtraBold, BarlowCondensed_900Black, BarlowCondensed_800ExtraBold_Italic and BarlowCondensed_900Black_Italic in App.tsx next to the existing ones, add them to clubTheme.fonts (heading → 800, add headingBlack 900, display → 900 italic), and keep Text.tsx's automatic heading mapping working.
Then create src/components/ui/Title.tsx: an uppercase Barlow title with variants "display" (900 italic, big screen titles like SALUT MANEL !), "section" (800, section headers like COURS À RÉSERVER) and "card" (800, card titles like ZUMBA). Sizes and letter-spacing from design-ref/ecrans-html/Main.html. Don't apply it to screens yet.
```

### Prompt 3 — Icons (Ionicons → Lucide)
```
Step 3: icons. The design uses Lucide icons, stroke 2 (see the inline SVGs in design-ref/ecrans-html). Install lucide-react-native with npm (react-native-svg is already installed). If npm reports a peer-dependency conflict, stop and tell me — do not use --force or --legacy-peer-deps.
Create src/components/ui/Icon.tsx that accepts the Ionicons names currently used in the app (name, size, color props — same API as Ionicons) and renders the closest Lucide icon with strokeWidth 2, ignoring the -outline / filled difference (active state is shown by color now). In dev, warn once for any name with no mapping and fall back to a neutral icon.
Then replace every `Ionicons` usage in src/ and App.tsx with this Icon component (about 280 usages) — imports and JSX tag only, nothing else on those lines. Give me the full mapping table Ionicons → Lucide at the end, and flag the ones you weren't sure about.
```

### Prompt 4 — Remove emojis from the interface
```
Step 4: remove emojis from the interface (rule: no emojis anywhere in the UI). Find every emoji and pictographic symbol in src/ (✓ ✅ 🔥 💪 👋 🎉 🟢 📅 ★ ♥ etc.).
- UI text (titles, toasts, buttons, labels, hints, pills): remove the emoji. Where it carried meaning, put a Lucide Icon next to the text instead (🔥 → Flame, ✓/✅ → Check, ★ → keep the info but as a label/section, 💬 → MessageCircle, ♥ → Heart, 🟢🟠🔴 → a small colored dot View).
- Remember the i18n keys are the French strings: update src/i18n/en.ts keys to match and run check:i18n.
- Option labels in src/onboarding/habitsFlow.ts (🌅 Tôt · 6h–9h…): remove the emoji from the label text only; keep every id, from/to value and the logic. If a test asserts the exact label, update only that expected string.
- DO NOT change stored data or what members typed: the community emoji (COMMUNITY_EMOJIS) and the special-day emoji in HoursEditor are values saved in the database. Keep saving them exactly as today, but where they are DISPLAYED, render a Lucide icon via a small emoji → icon map (unknown emoji → neutral icon). Posts, comments and bios written by members stay untouched. Demo seed text in services can stay.
- WhatsApp message texts sent to members (ClubConsoleSheet, ReportsAdminSheet) are messages, not UI: leave them.
List every change in a table: file, before, after.
```

### Prompt 5 — Shared components
```
Step 5: shared UI kit, matching design-ref/ecrans-html (look at Main.html, Connexion.html, Boutique.html, Q1Role.html for the exact CSS). Create in src/components/ui/: Button (primary red 56px pill with glow, secondary outline 1.5px #3A3A3F, ghost; loading and disabled states), Card (surface, 1px border, radius 24), Chip/Pill (selectable, radius 999), Tag (small uppercase tags like INFO, PROMO, CARDIO), SectionHeader (Title "section" + optional red link on the right like "Tout voir"), TextField (radius 16, surface-2), SegmentedProgress (the 6-segment sign-up bar), Wordmark (POWER + red GYM, spaced TUNIS underneath; put the words in clubTheme so another club can change them).
Then restyle the existing src/components/home/BottomSheet.tsx and src/journal/ui/kit.tsx to the new look WITHOUT changing their props or behavior (gestures, swipe-to-dismiss, back handling stay identical).
Don't touch any screen yet.
```

### Prompt 6 — Floating navbar — PLAN FIRST
```
Step 6 (plan first): the floating navbar from design-ref/HANDOFF.md ("Navbar" section) and the bottom of design-ref/ecrans-png/10-Main.png: 16px from the sides, 22px from the bottom, height 72, radius 28, surface + border; 5 items Accueil · Entraînement · Scan (red 52px circle in the middle) · Boutique · Communauté; active = red icon + small red dash under it, inactive #6B6B70.
Constraints:
- Coachs leaves the bar but the 'coaches' tab/screen stays exactly as it is; it will be opened from Accueil (quick action + coaches card) with the existing openTab('coaches').
- The centre Scan button must start exactly the same scan flow as today's ScanFab in HomeScreen (openScanner → QrScannerModal → onScanSuccess, and the checkedInToday state). Today's ScanFab also has an onReport action (report a problem / admin reports): that must stay reachable — propose where (e.g. Accueil header menu or Profil) and tell me.
- Keep: owner role without Entraînement, tab history/back, swipe between tabs (in the new order), tab reselect scroll-to-top, safe-area insets, and screen content must not be hidden behind the floating bar (add bottom padding).
Show me the plan with which files change before editing.
```

---

## Phase 2 — Screens, one at a time

Each prompt below follows the same pattern. Paste it, review, run the check prompt, commit.

### Prompt 7 — Langue
```
Restyle the language screen (src/screens/LanguageScreen.tsx) to match design-ref/ecrans-png/01-Langue.png and design-ref/ecrans-html/Langue.html. Use the new ui components. Same behavior.
```

### Prompt 8 — Bienvenue + Connexion
```
Restyle the welcome and login screens to match 02-Bienvenue and 03-Connexion (PNG + HTML in design-ref). Files: src/screens/OnboardingScreen.tsx (welcome + login parts only), src/components/onboarding/WelcomeCover.tsx, BubbleCard.tsx. Keep the background photo from clubTheme.login.backgroundImage (white-label), use the Wordmark component. Every auth call, validation, error message and step transition stays identical. Don't touch the sign-up steps yet.
```

### Prompt 9 — Inscription 1–6 — PLAN FIRST
```
Plan first. The mockup turns sign-up into a questionnaire: one question per screen with a 6-segment progress bar (design-ref 04-Q1Role → 09-Q6Code, PNG + HTML; the ruler age picker is in Q3Genre). Files: src/screens/OnboardingScreen.tsx (sign-up part) and src/screens/HabitsQuestionnaire.tsx.
First, make me a table: each field/question the app asks today (and in which order, which screen, which conditions — e.g. role-dependent questions) → which of the 6 mockup screens it goes on. Same fields, same validation, same final submit calls with the same data, same order of service calls. If the app asks something the mockup doesn't show, it gets its own step in the same style; if the mockup shows something the app doesn't ask, skip it. Back must go to the previous question. Wait for my OK on the table before coding.
```

### Prompt 10 — Accueil — PLAN FIRST
```
Plan first. Restyle the home screen to match design-ref/ecrans-png/10-Main.png and ecrans-html/Main.html: header (Wordmark, streak pill, bell, avatar), big display greeting, club news strip, live affluence ring card + "M'alerter si calme" / "Voir l'affluence", 4 round quick actions (Séance, Coachs, Boutique, Mon bilan), classes as big photo cards with Réserver / Liste d'attente, coaches card. Files: src/screens/HomeScreen.tsx and src/components/home/*, src/components/floor/* used by it.
The current home has more sections than the mockup (it feels like a dashboard — that's what we're fixing). Before coding, list EVERY section/card/button currently on Home for each role (member, coach, owner/admin), and for each one say: kept on Home (where), moved to the Affluence view, moved into a sheet behind a button, or folded into another card. Nothing is deleted; every action stays reachable. Wait for my OK.
```

### Prompt 11 — Infos du club + Affluence
```
Restyle the club news list and the crowd/affluence view to match 11-Infos and 12-Affluence (PNG + HTML). Files: src/components/floor/ClubNewsBar.tsx and whatever opens the news list, src/components/floor/FloorLive.tsx, HeatStrip.tsx, CrowdFlipCard.tsx, ZoneBoard.tsx, src/components/home/BarChart.tsx. News: unread dots, tags INFO/PROMO/COURS/COACH/ÉVÉNEMENT using the Tag component. Affluence: ring (% full), hourly bars, day chips. The hour-scrubbing and "Me prévenir" behavior in HeatStrip stays exactly the same.
```

### Prompt 12 — Scan + succès
```
Restyle the scanner and the after-scan screens to match 13-Scan and 14-ScanOK. Files: src/components/QrScannerModal.tsx, PostScanMuscleSelectModal.tsx, src/components/home/StreakSuccessSheet.tsx, StreakSheet.tsx. Camera handling, code check, muscle selection and streak logic unchanged. Green check + streak + "start session" as in the mockup.
```

### Prompt 13 — Profil
```
Restyle the profile/account sheet to match 15-Profil (PNG + HTML). File: src/components/account/AccountSheet.tsx. Every setting, role-specific item, logout and WhatsApp field stays; group them in the mockup's style.
```

### Prompt 14 — Entraînement + Mon corps — PLAN FIRST
```
Plan first. Restyle the training home to match 16-Entrainement (femme) and 17-EntrainementHomme (PNG + HTML). Files: src/journal/ui/JournalHome.tsx, src/journal/ui/kit.tsx (BodyMap, MuscleIcon, StatusPill…).
"Mon corps": follow the "Mon corps" section of design-ref/HANDOFF.md. Copy the 4 images from design-ref/images-pleine-taille/ to assets/body/. Show face + dos side by side, femme or homme from a Femme/Homme toggle whose default is the user's gender (UserProfile.gender). Draw each muscle's status as a soft glow on top using react-native-svg RadialGradient (works on web and native) — green Prêt / orange Récupération / red Fatigué / none for Pas encore — with the status coming from the existing muscleRecovery logic, nothing new. HANDOFF gives positions for chest, upper back and thighs; take any other positions from Entrainement.html and propose positions for every muscle in MUSCLES that has none. Tapping a zone calls the existing onMuscle(id).
Last sessions become log cards without photos (exercise lines + "Refaire" with the existing onRepeat). Weekly stats as in the mockup. If the mockup shows something the app doesn't compute (e.g. badges), skip it and tell me.
```

### Prompt 15 — Muscle sheet
```
Restyle the muscle bottom sheet to match 18-Muscle (PNG + HTML). File: src/journal/ui/MuscleSheet.tsx. No image. Title + status + stats, search, "Ajouter mon exercice", then "Les essentiels" (= exercises with e.base, replacing the ★) and "Autres exercices". Same onPick/onCreate/onBack/onClose behavior.
```

### Prompt 16 — Séance en cours
```
Restyle the live session to match 19-Seance (PNG + HTML). Files: src/journal/ui/Logger.tsx, src/journal/ui/SessionScreens.tsx (Session, ActiveBar, RestTimer, Summary), src/journal/ui/Journal.tsx (layout only). Set validation, rest timer, add/remove sets and finish logic unchanged.
```

### Prompt 17 — Mon bilan + Historique
```
Restyle "Mon bilan" and the session history to match 20-Bilan and 21-Historique (PNG + HTML). First find where these live today (JournalHome / Journal). Use only numbers the app already computes. If the 7/30-day toggle or the calendar history need data the app doesn't have, tell me before adding anything — a calendar view of the existing history list is fine.
```

### Prompt 18 — Boutique
```
Restyle the shop to match 22-Boutique, 23-Produit and 24-Panier (PNG + HTML). Files: src/screens/MarketplaceScreen.tsx and src/components/shop/*. The app has reservations, not a cart: map the "Panier" look onto the existing reservations flow (ReservationsSheet, OrdersPill) — do not build a cart. "En solde" row only if products already have a promo/sale field. Owner product editing (ProductFormModal) keeps working, styled with the new kit.
```

### Prompt 19 — Coachs
```
Restyle coaches to match 25-Coachs and 26-CoachFiche (PNG + HTML). Files: src/screens/CoachProfilesScreen.tsx and src/components/coaches/*. Coach list as photo cards, coach profile as a slide-up sheet (it already is a sheet). Booking, offers, coach editing and admin validation unchanged. Skip the reviews/ratings block — it's a new feature marked "À CODER".
```

### Prompt 20 — Communauté — PLAN FIRST
```
Plan first. Restyle the community to match 27-Communaute and 28-PageCommunaute (PNG + HTML). Files: src/screens/CommunityScreen.tsx and src/components/community/** (incl. mur/). List every section the community has today (Mur, PR stories, communities bar, composer, comments, members, invites, admin tools…) and where each goes in the new layout. The "featured challenge" only if something existing can fill it; otherwise skip it and tell me. Wait for my OK.
```

---

## Phase 3 — Sweep and final check

### Prompt 21 — Everything the mockup doesn't show
```
Sweep: apply the new look (tokens, ui kit, Title, Icon) to every sheet/modal/screen the mockup doesn't cover — admin and owner tools (FloorAdminScreen, ZoneSettings, HoursEditor, AdminCharts, AdminConfigModal, ClubConsoleSheet, MembersAdminSheet, PermissionsManageSheet, ReportsAdminSheet, ReportProblemSheet), AddToHomeSheet, ReviewPrompt, Toasts, ErrorBoundary, skeletons, empty states. Then search the whole src/ for: remaining emojis in UI text, any `Ionicons`, hardcoded hex colors, white backgrounds, shadows on cards. Report what's left.
```

### Prompt 22 — Final verification
```
Final check of the redesign branch against the baseline commit: run tsc, tests, check:i18n and `npm run build:web`, compare with design-ref/BASELINE.md. Then run `git diff --stat <baseline>..HEAD` and list every changed file that is NOT a screen/component/style/asset/i18n file — for each, explain why it changed. Finally write design-ref/QA-CHECKLIST.md: a click-through list I can follow on my phone for each role (member, coach, owner) covering every flow (signup, login, scan, start/finish a session, muscle sheet, book a class, waitlist, reserve a product, book a coach, post/comment/like, notifications, admin tools).
```

---

## The check prompt (after every step)
```
Audit the uncommitted diff (git diff). List every change that is not purely visual: changed conditions, handlers, props passed, state, effects, service calls, navigation calls, removed elements, removed text that users could need. For each one, either revert it or explain why it is unavoidable. Then confirm tsc, tests and check:i18n pass.
```

## If something goes wrong
- Claude Code edits a file in `src/services`, `src/floor/*.ts`, `src/journal/journal*.ts`, `backend/` or `supabase/` → stop it, say "revert that file, it's off-limits".
- A screen is broken and you want to start over: `git restore . && git clean -fd src assets` (goes back to the last commit; only after Prompt 0).
- It "simplified" something away → ask "where did X go? it must still be reachable".
