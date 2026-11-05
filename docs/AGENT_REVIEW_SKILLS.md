# Agent code review skills

MauriceCraft keeps reusable agent skills in [`.agents/skills/`](../.agents/skills/), following the [Agent Skills format](https://agentskills.io/). They are instructions for coding agents, **not** GitHub Actions jobs, a new bot, or a replacement for ESLint, Vitest, or Playwright. No extra package installation is required.

## One source of truth across agents

The **canonical skill definitions** live in `.agents/skills/<skill-name>/SKILL.md` so Codex and GitHub Copilot can discover them directly. Claude Code looks under `.claude/skills/`, so each `.claude/skills/<skill-name>` entry is a **relative Git symlink** pointing to its canonical `.agents/skills/` directory. There are no duplicated skill bodies.

The root `CLAUDE.md` imports the shared `AGENTS.md` using Claude Code's supported `@AGENTS.md` import syntax. Copilot's repository instructions stay in `.github/` because they are Copilot-specific, but the reusable skills are not.

This layout follows [GitHub Copilot's skill discovery](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills), [Codex's skill locations](https://learn.chatgpt.com/docs/build-skills), and [Claude Code's symlinked skill-folder support](https://code.claude.com/docs/en/skills). On platforms or tools that do not follow Git symlinks, Claude should read the canonical files directly from `.agents/skills/`. On Windows, use a Git checkout that supports symbolic links for native Claude skill discovery.

## Choose a review

| Skill                                                                           | Use it when                                                                                            | Source of approach                                                                                                           |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| [`code-review`](../.agents/skills/code-review/SKILL.md)                         | Reviewing a PR, diff, branch, or re-review; compare requirements against implementation and repo rules | [Matt Pocock's code-review](https://github.com/mattpocock/skills/tree/main/skills/engineering/code-review)                   |
| [`code-review-and-quality`](../.agents/skills/code-review-and-quality/SKILL.md) | Inspecting correctness, readability, architecture, security, performance                               | [Addy Osmani's code-review-and-quality](https://github.com/addyosmani/agent-skills/tree/main/skills/code-review-and-quality) |
| [`review-game-regressions`](../.agents/skills/review-game-regressions/SKILL.md) | Touching gameplay, existing worlds, chunk generation, mobile controls, rendering, or offline updates   | MauriceCraft's own [architecture](ARCHITECTURE.md) and [testing](TESTING.md) rules                                           |

The first two are **short, MauriceCraft-specific adaptations of popular review workflows**, not verbatim copies or automatically synchronized upstream skills. They avoid irrelevant React/server rules and do not assume an agent has subagent support. The original projects are MIT-licensed; follow their links for the complete upstream skills and license terms.

The default [PR review instructions](../.github/instructions/code-review.instructions.md) and [AGENTS.md](../AGENTS.md) tell agents when to load these guides. A reviewing agent should preserve the distinction between "matches the spec" and "follows repository standards," and return a GO / NO-GO / NOT VERIFIED result with evidence.

Example prompt:

> Review PR #123 in maniator/MauriceCraft using code-review and the applicable specialized review skills. Compare against the linked issue and target branch, inspect current CI and unresolved threads, and flag only actionable problems with precise file/line references. Check saved-world safety and mobile regressions if relevant. Report GO / NO-GO / NOT VERIFIED, tests checked, and any missing evidence. Do not merge or resolve threads without checking them.

These skills deliberately add no automation or CI steps. The project's actual quality gates remain `npm run check` and, for browser-related changes, `npm run test:e2e`. See [Testing](TESTING.md).
