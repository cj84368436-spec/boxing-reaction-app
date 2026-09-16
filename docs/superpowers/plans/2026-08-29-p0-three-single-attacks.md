# P0 Three Single Attacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a continuous Lead Jab, Rear Straight, and Lead Hook vertical slice from the first three canonical P0 single combos.

**Architecture:** A new GameClock-driven session schedules three isolated `P0AttackAttemptController` instances from `P0_SEQUENCE`. A shared motion registry and sampler feed the existing projection and BoxerRig, while production and Browser Preview consume the same compiled session.

**Tech Stack:** TypeScript, React Native 0.84, Granite 1.0.43, react-native-svg, Jest, Node test runner

**Spec:** `docs/superpowers/specs/2026-08-29-p0-three-single-attacks-design.md`

## Global Constraints

- Preserve every file under `src/game/**`, `tools/mocap/**`, and all canonical motion JSON bytes.
- Use the first three entries of `P0_SEQUENCE`; do not create a second timing or sequence constant.
- Use one GameClock and do not gate gameplay on React state, animation completion, feedback completion, or timers.
- Do not change dependencies or `package-lock.json`.
- Do not implement combo attacks, ten punches, score, sound, haptics, backend, coach, or final art.

---

### Task 1: Three-single session orchestrator

**Files:**
- Create: `src/app/session/P0ThreeSingleAttackSession.ts`
- Create: `src/app/__tests__/P0ThreeSingleAttackSession.test.ts`

**Interfaces:**
- Consumes: `P0_SEQUENCE`, `P0AttackAttemptController`, `GameClock`, and `motionSourceIds: Readonly<Record<string, string>>`
- Produces: `P0ThreeSingleAttackSession.start()`, `tick()`, `handleInput()`, `retry()`, and `ThreeSingleSessionSnapshot`

- [ ] **Step 1: Write failing session tests**

Cover literal order `LEAD_JAB_HEAD`, `REAR_STRAIGHT_HEAD`, `LEAD_HOOK_HEAD`; scheduled starts `0`, `1180`, `2420` from a zero lead-in; unique run-scoped IDs; HIT continuation; clock catch-up; completion only after Hook; telemetry order; and Retry run reset.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd run test:app -- --runTestsByPath src/app/__tests__/P0ThreeSingleAttackSession.test.ts`

Expected: FAIL because `P0ThreeSingleAttackSession` does not exist.

- [ ] **Step 3: Implement the minimal orchestrator**

Build run plans directly from `P0_SEQUENCE.slice(0, 3)`. For each combo, schedule its attack at `comboStartAtMs + attackStartOffsetsMs[attackIndex]`, then advance the next combo start by the last attack offset, last attack impact, and `recoveryAfterMs`.

- [ ] **Step 4: Run focused and existing session tests**

Run: `npm.cmd run test:app -- --runTestsByPath src/app/__tests__/P0ThreeSingleAttackSession.test.ts src/app/__tests__/P0AttackAttemptController.test.ts src/app/__tests__/P0LeadJabSession.test.ts`

Expected: all selected suites PASS.

### Task 2: Shared motion registry and depth presentation

**Files:**
- Create: `src/app/motion/sampleMotionPose.ts`
- Create: `src/app/motion/p0MotionRegistry.ts`
- Modify: `src/app/motion/leadJabReadyPose.ts`
- Modify: `src/app/motion/types.ts`
- Modify: `src/app/motion/buildBoxerRig.ts`
- Modify: `src/app/components/BoxerRig.tsx`
- Modify: `src/app/__tests__/motionPipeline.test.ts`

**Interfaces:**
- Produces: `getP0MotionAsset(attackId)`, `getP0MotionSourceIds()`, `sampleP0AttackPose(attackId, elapsedMs)`
- Produces: one bounded perspective rule using `hand.scale / chest.scale` for every glove and forearm

- [ ] **Step 1: Add failing three-asset and depth tests**

Assert all three Ready/cue/impact samples have 19 finite joints, unknown attack IDs fail, every rig command is finite, and increasing a synthetic hand depth scale increases its glove and forearm presentation within the bounded ratio.

- [ ] **Step 2: Run motion tests and verify RED**

Run: `npm.cmd run test:app -- --runTestsByPath src/app/__tests__/motionPipeline.test.ts`

Expected: FAIL because the registry and generic sampler do not exist.

- [ ] **Step 3: Generalize the sampler and apply bounded depth scaling**

Move interpolation into `sampleMotionPose.ts`, import each canonical JSON once in `p0MotionRegistry.ts`, keep Lead Jab compatibility exports thin, and multiply glove diameter and forearm thickness by clamped shared perspective ratios.

- [ ] **Step 4: Run motion tests**

Expected: the full motion suite PASS with finite output.

### Task 3: Continuous production screen

**Files:**
- Modify: `src/app/screens/P0GameScreen.tsx`
- Modify: `src/app/__tests__/P0GameScreen.test.tsx`

**Interfaces:**
- Consumes: `P0ThreeSingleAttackSession`, `sampleP0AttackPose`, and a 320ms presentation-only feedback duration
- Produces: three-step HUD, non-modal feedback, final three-row summary, and Retry

- [ ] **Step 1: Replace single-Jab UI assertions with failing continuous-flow tests**

Assert Jab feedback at 480ms without Retry, Straight continuation and motion identity, HIT continuation, Hook completion, final summary after feedback, new run ID on Retry, four defense controls, and the 450/451ms DEFEND boundary.

- [ ] **Step 2: Run screen tests and verify RED**

Run: `npm.cmd run test:app -- --runTestsByPath src/app/__tests__/P0GameScreen.test.tsx`

Expected: FAIL because the screen still blocks on the first result.

- [ ] **Step 3: Implement the continuous screen**

Drive pose, status, feedback, progress, controls, and final result only from session snapshots and the injected GameClock. Keep defense controls at least 44pt and retain safe-area layout.

- [ ] **Step 4: Run screen and app type tests**

Run: `npm.cmd run test:app -- --runTestsByPath src/app/__tests__/P0GameScreen.test.tsx`

Run: `npm.cmd run typecheck:app`

Expected: both commands PASS.

### Task 4: Shared Browser Preview integration

**Files:**
- Modify: `tsconfig.preview-session.json`
- Modify: `tools/browser-preview/preview-session.mjs`
- Modify: `tools/browser-preview/preview.html`
- Modify: `tools/browser-preview/test-preview-contract.mjs`

**Interfaces:**
- Consumes: compiled `P0ThreeSingleAttackSession` and three fetched canonical motion source IDs
- Produces: Browser Preview flow Ready → Jab → Straight → Hook → result → Retry without gameplay overrides

- [ ] **Step 1: Add failing Preview shared-session and HTTP asset contracts**

Assert the Preview adapter inherits the compiled shared session without overriding gameplay methods, all three motion JSON files are served, and a clock-driven run continues through HIT to completion and Retry.

- [ ] **Step 2: Run Preview tests and verify RED**

Run: `npm.cmd run test:preview`

Expected: FAIL because Preview still imports the single-Jab session.

- [ ] **Step 3: Compile and connect the shared session**

Add the orchestrator to `tsconfig.preview-session.json`, fetch the three allowlisted motion assets, pass their source IDs to the shared session, and select DOM animation assets by `snapshot.currentAttack.attackId`.

- [ ] **Step 4: Run Preview tests**

Expected: Preview contracts PASS without browser automation.

### Task 5: Final verification and commit

**Files:**
- Verify all modified files

- [ ] **Step 1: Run full verification**

Run: `npm.cmd test`

Run: `npm.cmd run test:preview`

Run: `npm.cmd run typecheck:app`

Run: `git diff --check`

- [ ] **Step 2: Run Granite build**

Run: `npm.cmd run build:app`

Expected: Android and iOS report 0 errors and 0 warnings and create `boxing-talent-test.ait`.

- [ ] **Step 3: Verify protected paths and refs**

Run: `git diff --name-only p0-game-engine-baseline -- src/game tools/mocap`

Expected: no output.

- [ ] **Step 4: Commit the feature branch**

Run: `git add docs/superpowers src/app tools/browser-preview tsconfig.preview-session.json && git commit -m "feat: play first three P0 single attacks"`

Expected: commit on `feature/p0-three-single-attacks`; master and foundation refs unchanged.
