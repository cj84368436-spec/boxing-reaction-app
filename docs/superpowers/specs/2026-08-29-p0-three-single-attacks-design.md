# P0 Three Single Attacks Design

## Goal

Extend the playable shell from one blocking Lead Jab attempt to the first three canonical single combos: Lead Jab, Rear Straight, and Lead Hook. Outcomes never stop the run; only the third resolved attack completes the session.

## Architecture

`P0AttackAttemptController` remains the executor for one attack and continues to own InputRouter, DefenseResolver, timing windows, NO_INPUT, outcome, and per-attack telemetry. A new `P0ThreeSingleAttackSession` selects `P0_SEQUENCE.slice(0, 3)`, derives absolute attack starts from each combo's last impact plus `recoveryAfterMs`, creates one isolated attempt controller per attack, and ticks all scheduled attempts from one GameClock.

All attempts are scheduled when the run starts. A late frame therefore advances every due attempt from the current absolute clock without waiting for React state, animation completion, feedback completion, or timers. Each retry increments the run ID and rebuilds every attack instance and telemetry record.

## Motion and presentation

A motion registry maps canonical attack IDs to the three existing JSON assets and a shared sampler. The existing front projection and BoxerRig remain shared. Depth presentation uses a bounded hand-to-torso perspective ratio for glove size and forearm thickness, identically for Jab, Straight, and Hook; canonical motion, FK, timing, and coordinates are unchanged.

Production React Native and Browser Preview use the same compiled `P0ThreeSingleAttackSession`. Browser-only code remains limited to DOM input binding and rendering.

## UI flow

The screen flow is READY, three continuous attacks, and SESSION COMPLETE. Each resolved attack creates a 320ms non-modal HUD feedback pill. The next attack remains clock-driven underneath that feedback. After the Hook, the feedback pill is shown first, followed by a three-row result card and Retry.

The four defense controls stay in the bottom thumb zone. DEFEND styling remains strictly bounded by `nowMs <= responseEndAtMs`. Player defense animation is presentation-only and never determines an outcome.

## Protected boundaries

- No changes under `src/game/**` or `tools/mocap/**`.
- No dependency or lockfile changes.
- No combo attacks or remaining P0 sequence entries are executed.
- No score, sound, haptics, backend, coach, or final art.

## Verification

Tests cover canonical sequence selection, literal attack timing, absolute catch-up, outcome continuation, input isolation, run/instance IDs, telemetry order, Retry, all three motion assets, finite depth presentation, UI feedback/result flow, Preview shared-controller identity, and the existing DEFEND boundary. Final verification runs `npm test`, Preview contracts, app typecheck, `git diff --check`, and `npm.cmd run build:app`.
