# Power Gym redesign — rules for every change

We are restyling the app to match the mockup in `design-ref/`. **We change the look only. Every function stays exactly as it works today.**

## Where the design is
- `design-ref/ecrans-png/NN-Name.png` — the picture of each screen (390 px phone, 2x). Look at it first.
- `design-ref/ecrans-html/Name.html` — the same screen as HTML/CSS. Copy exact colors, sizes, spacing, radii and SVG shapes from here.
- `design-ref/HANDOFF.md` — tokens, navbar, screen list, how "Mon corps" works. Read it before any screen.
- `design-ref/images-pleine-taille/` — the 4 body renders (femme/homme, face/dos).
- Photos in `design-ref/ecrans-html/images/` (coachs, products) are placeholder content: real data still comes from the services. Do not hardcode them.

## Hard rules (never break these)
1. Do not change: services (`src/services`), hooks, `src/journal/journal*.ts`, `src/floor/*.ts` logic, `src/onboarding/*.ts` logic, `src/community/*.ts`, types, backend, supabase, tests' logic.
2. In components and screens, only touch: JSX layout, styles, icons, static text. Keep every `useState`/`useEffect`, handler, prop, condition (role checks, owner/coach/member branches), service call and navigation call exactly as it is. If a restyle needs a handler moved to a different element, keep the same handler.
3. Nothing gets deleted. If the app has a section/button the mockup does not show, keep it and style it in the new language, then tell me where it went. If the mockup shows something the app does not have (e.g. coach reviews, favourites), skip it and tell me.
4. Colors only through `src/theme.ts` tokens (built from `src/config/clubTheme.ts`). No new hardcoded hex in screens.
5. Text the user sees goes through the existing i18n: in this app the **keys are the French strings** (`src/i18n/en.ts` maps French → English). If you change a French string, update the matching key in `en.ts` and run `npm run check:i18n`.
6. After each step run `npx tsc --noEmit`, `npm test` and `npm run check:i18n`. All must pass as before. If a test fails only because a UI string lost an emoji, update that expected string — never change logic to make a test pass.
7. One screen (or one group) per step. Small diffs. At the end of each step, list: files changed, anything you could not match, anything kept/moved/skipped.

## Design language (summary — exact values in HANDOFF.md and the HTML)
- **Dark theme.** bg `#0B0B0C` · surface `#141416` · surface-2 `#1C1C1F` · surface-3 `#26262A` · border `#2A2A2E` · text `#F5F5F5` / `#A1A1A6` / `#6B6B70` · brand red `#E31E24`, soft red bg `#3A1214` · success `#22C55E` · warning `#F5A524`.
- **Red is rare:** the main action of a screen, the active tab, live/alert accents, the "Fatigué" status. Everything else is neutral greys.
- **Type:** titles Barlow Condensed 800–900 UPPERCASE (big display titles italic 900). Body Manrope 500–800.
- **Radius:** cards 24 · inputs 16 · buttons, chips, pills 999.
- **Cards:** flat surface + 1px border, no drop shadows. Primary button is the only thing with a glow.
- **Icons:** Lucide via `src/components/ui/Icon.tsx`, stroke 2. **No emojis in the interface.** (Content written by members — posts, comments, bios — keeps whatever they typed.)
- **Calmer layout:** fewer boxes, more spacing, big section titles with a small red "Voir / Tout voir" link on the right instead of extra cards and badges.
- **Logo:** text wordmark POWER + red GYM, small spaced TUNIS under it (component `Wordmark`, values from `clubTheme`).
