---
name: code-review-and-quality
description: Examine a MauriceCraft code change for correctness, simplicity, architecture, security, and performance. Use when reviewing PRs, substantial refactors, or code from another agent; pair with code-review for spec coverage.
---

# Five-axis code quality review

Apply these checks **to the changed behavior and its callers**, not as a speculative audit of the whole application. Prefer a few high-confidence defects over dozens of stylistic comments.

## 1. Correctness

- Trace the changed path from input to world state and UI output. Check false/empty values, boundaries, asynchronous failures, timing, and state transitions.
- Look for behavior inconsistencies across Creative/Survival/Adventure/Spectator, Overworld/Nether, paused/playing, new/existing saves.
- Verify inventory counts, item pickup, mining cooldowns, placement vs attack, collision and mob interactions stay coherent.
- A passing unit test is not enough if it bypasses the actual browser integration. Read the assertions and make sure the reported regression would fail without the fix.

## 2. Readability and scope

- Prefer a direct typed function and clear names to a clever, indirection-heavy solution.
- Flag real duplication, obsolete branches, and abstractions introduced without a current use.
- Keep a bug fix's scope narrow. Don't mix unrelated cleanup into a gameplay repair.
- Respect the repository's **500-effective-line production TypeScript lint limit**; tests are exempt. File splitting should create meaningful boundaries, not scatter one giant function across wrappers.

## 3. Architecture

- `src/game/bootstrap.ts` composes systems; do not move new game rules there.
- Keep world rules and seed algorithms deterministic and independently testable.
- Keep rendering/DOM, game simulation, input, and Dexie storage responsibilities separate; watch for import cycles or module side effects.
- Verify lazy imports do not defer critical input, storage, or PWA update-safety wiring. No React-specific advice: MauriceCraft uses TypeScript, Three.js and Vite.

## 4. Security and data integrity

- Treat imported `.mcraft` files, command input, world names, and persisted data as untrusted: bound sizes, validate formats, and fail without data loss.
- Check HTML/text rendering for injection, and guard against unsafe paths or secrets in code and workflows.
- Inspect dependency changes for needless packages and risky install/runtime behavior.
- Never recommend deleting or resetting `blockcraft-worlds` to hide a failure. A broken save/load path is a blocking defect.

## 5. Performance

- Look for unbounded scans, per-frame allocations, duplicated raycasts, quadratic work, and synchronous chunk/mesh generation on the hot path.
- Consider mobile memory/GPU limits, world streaming budgets, and touch latency.
- For supposed speedups, request comparable before/after measurements. Do not present theoretical wins as measured results.
- For bundle changes, check actual startup vs lazy-loaded chunks and offline precache behavior.

## Review discipline

Read tests before declaring coverage. Inspect the nearest existing caller and error handling before filing a finding. Give a concrete fix and a focused test. If CI is failing, determine whether it is caused by the PR, pre-existing, or not yet known; never call stale checks current.

Use **Critical / Required / Optional / Nit** as defined by the parent [code-review skill](../code-review/SKILL.md). The review may be empty if everything is sound. Do not require changes solely because they are stylistically different from your preference.

Adapted for MauriceCraft from the five-axis review approach in [Addy Osmani's code-review-and-quality skill](https://github.com/addyosmani/agent-skills/tree/main/skills/code-review-and-quality).
