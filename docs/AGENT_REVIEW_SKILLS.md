# Agent code review skills

MauriceCraft keeps reusable agent skills in [`.github/skills/`](../.github/skills/), following the [Agent Skills format](https://agentskills.io/). They are instructions for coding agents, **not** GitHub Actions jobs, a new bot, or a replacement for ESLint, Vitest, or Playwright. No extra package installation is required.

## Choose a review

| Skill | Use it when | Source of approach |
| --- | --- | --- |
| [`code-review`](../.github/skills/code-review/SKILL.md) | Reviewing a PR, diff, branch, or re-review; compare requirements against implementation and repo rules | [Matt Pocock's code-review](https://github.com/mattpocock/skills/tree/main/skills/engineering/code-review) |
| [`code-review-and-quality`](../.github/skills/code-review-and-quality/SKILL.md) | Inspecting correctness, readability, architecture, security, performance | [Addy Osmani's code-review-and-quality](https://github.com/addyosmani/agent-skills/tree/main/skills/code-review-and-quality) |
| [`review-game-regressions`](../.github/skills/review-game-regressions/SKILL.md) | Touching gameplay, existing worlds, chunk generation, mobile controls, rendering, or offline updates | MauriceCraft's own [architecture](ARCHITECTURE.md) and [testing](TESTING.md) rules |

The first two are **short, MauriceCraft-specific adaptations of popular review workflows**, not verbatim copies or automatically synchronized upstream skills. They avoid irrelevant React/server rules and do not assume an agent has subagent support. The original projects are MIT-licensed; follow their links for the complete upstream skills and license terms.

The default [PR review instructions](../.github/instructions/code-review.instructions.md) and [AGENTS.md](../AGENTS.md) tell agents when to load these guides. A reviewing agent should preserve the distinction between "matches the spec" and "follows repository standards," and return a GO / NO-GO / NOT VERIFIED result with evidence.

Example prompt:

> Review PR #123 in maniator/MauriceCraft using code-review and the applicable specialized review skills. Compare against the linked issue and target branch, inspect current CI and unresolved threads, and flag only actionable problems with precise file/line references. Check saved-world safety and mobile regressions if relevant. Report GO / NO-GO / NOT VERIFIED, tests checked, and any missing evidence. Do not merge or resolve threads without checking them.

These skills deliberately add no automation or CI steps. The project's actual quality gates remain `npm run check` and, for browser-related changes, `npm run test:e2e`. See [Testing](TESTING.md).
