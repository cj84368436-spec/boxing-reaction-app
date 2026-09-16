# P0 Lead Jab Playable Design

## Scope

This vertical slice runs exactly one canonical `LEAD_JAB_HEAD` attack. It adds no other punch, combo, score session, sound, haptic, server, or account behavior.

## Architecture

`P0LeadJabSession` lives in the app layer and composes the sealed engine without rewriting it:

```text
P0GameScreen
  -> GameClock.nowMs() on Pressable.onPressIn
  -> P0LeadJabSession.handleInput()
  -> routeInput()
  -> detectMultiInput()
  -> resolveDefense()
  -> DefenseOutcome
```

The controller uses the canonical `GameStateMachine` for `READY -> COUNTDOWN -> ATTACK_PREP -> RESPONSE_WINDOW -> RESOLVE -> FINISHED`. A short app-only Ready lead-in is scheduled with the gameplay clock. No timer completion or animation completion advances gameplay.

## Clock and motion

The controller captures one `attackStartAtMs` from the injected `GameClock`. Both paths use it:

- motion: `elapsedMs = nowMs - attackStartAtMs`
- input: absolute response window values derived from that same start

`requestAnimationFrame` only asks the controller for another clock-derived snapshot. The canonical motion JSON timeline maps `0 / 120 / 480 / 760ms` to source frames and interpolates finite 19-joint XYZ data. `visualRecoveryMs` remains presentation-only.

## Resolution rules

- The first valid input for the attack instance is retained until impact.
- A second different valid input within `P0_TIMING.simultaneousInputMs` becomes `MULTI_INPUT` and resolves to `HIT`.
- Early or late input remains visible in local telemetry but cannot become a valid defense.
- At impact, a valid single input is passed to the canonical `DefenseResolver`.
- At impact with no valid input, the result is `NO_INPUT -> HIT`; no fake button value is created.

## UI

The portrait screen keeps the existing HUD, ring, SVG boxer, and four large thumb-zone buttons. It adds:

- clock-driven Lead Jab playback in `BoxerRig`
- subtle cue/window status
- short defense presentation for LEFT, RIGHT, BACK, and GUARD
- restrained PERFECT, SAFE, or HIT result card
- RETRY, which creates a new instance and clears previous input/result state

Defense motion is presentation feedback only and never feeds back into the controller.

## Telemetry

The app controller exposes one local debug record containing attack ID, instance ID, start/cue/impact scheduled and actual times, optional input time/button, input status, reaction time, outcome, and canonical motion source ID. Nothing is sent to a server.

## Browser Preview

The development-only Preview is copied from the shell worktree without modifying that worktree. It continues to load the canonical JSON directly and mirrors the playable flow for quick PC visual QA. It is explicitly labeled as not being the Granite runtime.

## Verification boundary

Automated tests prove engine composition, timing boundaries, retry isolation, finite motion/rig output, Browser Preview contracts, typechecking, and Granite packaging. Browser and Sandbox/device visual quality remain separately reported; a browser preview does not substitute for Toss Sandbox.
