# P0 Playable Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Apps in Toss Granite React Native shell that renders the canonical Lead Jab Ready pose as a capsule boxer above four defense buttons.

**Architecture:** Keep `src/game/**` immutable and add a presentation-only React Native layer. Load the canonical JSON directly, transform it through pure sampling/projection/rig functions, then render the resulting commands with the Granite-hosted `react-native-svg` module.

**Tech Stack:** Apps in Toss SDK 2.10.10, Granite 1.0.43, React 19.2.3, React Native 0.84.0, react-native-svg 15.15.3, TypeScript 5.8, Jest 29.

**Spec:** `docs/superpowers/specs/2026-08-28-p0-playable-shell-design.md`

## Global Constraints

- Start from `42378c4770223f363e9d040766604e6727e1a78e` on `feature/p0-playable-shell`.
- Do not modify any file under `src/game/**` or `tools/mocap/**`.
- Do not add attack playback, timing response, defense resolution, score, sound, haptics, server, login, ads, or ranking.
- Use only the Apps in Toss host-shared `react-native-svg` native renderer; do not add Skia, WebView, Three.js, Unity, or a 3D engine.

---

### Task 1: Granite Apps in Toss shell

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `babel.config.cjs`
- Create: `granite.config.ts`
- Create: `index.ts`
- Create: `require.context.ts`
- Create: `react-native.config.cjs`
- Create: `src/_app.tsx`
- Create: `pages/index.tsx`
- Create: `src/router.gen.ts`
- Create: `tsconfig.app.json`

**Interfaces:**
- Consumes: official `create-granite-app` 1.0.43 and Apps in Toss `ait init` 2.10.10 templates.
- Produces: `npm run dev`, `npm run build:app`, and `/` file route.

- [ ] Add the exact SDK 2.x and Granite dependencies and preserve `npm test` as the canonical engine test command.
- [ ] Add official Babel, entry, context, AppsInToss registration, game config, and route wrapper files.
- [ ] Run `npm install` and `npm run typecheck:app` to expose missing shell configuration.

### Task 2: Ready pose pipeline

**Files:**
- Create: `src/app/motion/types.ts`
- Create: `src/app/motion/leadJabReadyPose.ts`
- Create: `src/app/motion/projectFrontPose.ts`
- Create: `src/app/motion/buildBoxerRig.ts`
- Create: `src/app/canonicalEngineImports.ts`
- Create: `src/app/__tests__/motionPipeline.test.ts`
- Create: `src/app/__tests__/canonicalImports.test.ts`

**Interfaces:**
- Consumes: `lead-jab.json`, `P0_ATTACKS`, `P0_SEQUENCE`, `P0_TIMING`, `GameClock`.
- Produces: `sampleReadyPose(): SampledPose`, `projectFrontPose(pose): ProjectedPose`, `fitProjectedPose(pose, width, height): ScreenPose`, `buildBoxerRig(pose): RigCommand[]`.

- [ ] Write Jest tests that require 19 finite Ready joints and successful imports of all four canonical modules.
- [ ] Run the focused tests and confirm failure because the app modules do not exist.
- [ ] Implement JSON loading, 0ms sampling, front projection, viewport fitting, and finite rig commands.
- [ ] Run focused tests and confirm they pass.

### Task 3: P0 game screen and capsule renderer

**Files:**
- Create: `src/app/components/BoxerRig.tsx`
- Create: `src/app/components/DefenseControls.tsx`
- Create: `src/app/screens/P0GameScreen.tsx`
- Create: `src/app/__tests__/P0GameScreen.test.tsx`
- Create: `src/pages/index.tsx`
- Modify: `pages/index.tsx`

**Interfaces:**
- Consumes: `buildBoxerRig()` output and the ready pose pipeline.
- Produces: default `P0GameScreen` route with title, boxer, and LEFT / RIGHT / BACK / GUARD buttons.

- [ ] Write a screen test for the title, four buttons, boxer marker, and pressed-state feedback.
- [ ] Run the focused test and confirm failure because the screen does not exist.
- [ ] Implement the screen, stage, SVG capsule rig, and press feedback without engine dispatch.
- [ ] Run focused tests and confirm they pass.

### Task 4: Full verification and seal check

**Files:**
- Modify: `.gitignore`
- Create: `jest.config.cjs`
- Create: `scripts/apply-granite-windows-path-patch.mjs`
- Create: `jest.setup.ts`

**Interfaces:**
- Consumes: complete shell and existing canonical suite.
- Produces: test/build/dev evidence and a clean feature commit.

- [ ] Run `npm test` and require 47/47 canonical Node tests plus all app contracts.
- [ ] Run `npm run typecheck:app` and require exit code 0.
- [ ] Run `npm run build:app` and require an Apps in Toss artifact.
- [ ] Start `npm run dev`, capture successful Metro readiness, then stop the server.
- [ ] Compare `src/game/**`, `tools/mocap/**`, and baseline tag against `42378c4`; require no diff.
- [ ] Commit all intended files on `feature/p0-playable-shell` and require clean `git status`.
