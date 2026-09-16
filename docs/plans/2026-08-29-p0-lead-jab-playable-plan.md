# P0 Lead Jab Playable Implementation Plan

> Base: `61828b0d743215b1b350ad27e5a4d5f53b0f882b`
> Branch: `feature/p0-lead-jab-playable`

## Task 1: Lock the controller contract with failing tests

- Add integration tests for canonical timing, state flow, routing, resolver outcomes, early/late/multi input, no input, retry, telemetry, and clock-only resolution.
- Run the focused suite and confirm it fails because the controller does not exist.

## Task 2: Implement the thin single-jab controller

- Add the app-layer session/controller and local telemetry types.
- Compose `P0_ATTACKS`, `P0_TIMING`, `GameStateMachine`, `InputRouter`, `DefenseResolver`, and `GameClock` without changing `src/game/**`.
- Run the focused suite to green, then refactor without changing behavior.

## Task 3: Expand canonical motion sampling

- Add time-based Lead Jab sampling through the existing canonical timeline interpolation.
- Add failing motion tests for cue, impact, recovery clamping, and finite rig output.
- Update `BoxerRig` to accept the sampled pose and keep SVG projection/rig generation finite.

## Task 4: Connect the React Native screen

- Drive UI snapshots with `requestAnimationFrame` sampling of the injected clock.
- Connect `Pressable.onPressIn` to the session controller.
- Add defense presentation, outcome card, local debug panel, and retry.
- Update screen interaction tests for all user-visible states.

## Task 5: Update the development Browser Preview

- Copy the shell worktree's uncommitted preview assets into this worktree only.
- Add the package scripts in this branch.
- Update preview contracts first, then implement canonical motion playback, inputs, defense feedback, results, and retry.
- Run the server and contract checks only; browser interaction and visual quality are user-verified manually.

## Task 6: Verify and commit

- Run focused tests, full `npm test`, app typecheck, motion audit, preview tests, and Granite `ait build`.
- Inspect the produced `.ait` package and run the dev server where possible.
- Compare `src/game/**`, motion assets, baseline tag, master, and shell refs against their protected commits.
- Commit only to the feature branch and leave the sibling worktree clean.
