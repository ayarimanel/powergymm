# Run the redesign step by step

You (Claude Code) will work through design-ref/PROMPTS.md from Prompt 0 to Prompt 22, in order, one prompt at a time. The user does not want to type each prompt. You drive; the user approves.

## For each prompt
1. Say in one line which prompt you are starting and what it changes.
2. If the prompt is marked PLAN FIRST: do not edit anything yet. Show the plan (files, what moves where, the tables it asks for) and ASK the user to approve. Wait.
3. Do the prompt.
4. Run the "check prompt" from PROMPTS.md on your own diff: revert anything that is not purely visual.
5. Run `npx tsc --noEmit`, `npm test`, `npm run check:i18n`. Compare with design-ref/BASELINE.md. A new failure = fix it (visually only) or stop and ask.
6. If you can, start the web app and screenshot the screen you changed (e.g. with Playwright), and compare it with the PNG in design-ref/ecrans-png. If you can't, say which screen the user should glance at.
7. Give a short report:
   - what changed (files),
   - what you kept/moved because the mockup doesn't show it,
   - what you skipped because the app doesn't have it,
   - anything that looked odd.
8. ASK the user (with a multiple-choice question when possible): "Commit and go to Prompt N+1" / "Fix something first" / "Undo this step". Wait for the answer.
9. On "commit": `git add -A && git commit -m "redesign: prompt N - <short name>"`, then continue with the next prompt.
   On "undo": go back to the last commit (only new files from this step get removed), then ask what to do.

## STOP and ask the user — never decide alone — when:
- a change would alter any behavior: a condition, a handler, state, a service call, navigation, what a role can see or do, saved data, text sent to members;
- a file in src/services, src/floor/*.ts, src/journal/journal*.ts, src/onboarding/*.ts, src/community/*.ts, src/types, backend/ or supabase/ would need to change;
- something would disappear from the screen and you are not sure where it should go;
- the mockup, HANDOFF.md, REDESIGN.md or PROMPTS.md contradict each other or the code, or a note doesn't make sense for this app;
- the mockup shows a feature that doesn't exist (don't build it — tell the user);
- an npm install fails or asks for --force / --legacy-peer-deps;
- you are unsure about anything. When in doubt, ask. Asking is always cheaper than changing a function.

Never run more than one prompt before asking. Never push to a remote. Never deploy.
