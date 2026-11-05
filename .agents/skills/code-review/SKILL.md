---
name: code-review
description: Review a MauriceCraft pull request, branch, or diff against its requirements and repository standards. Use for PR reviews, go/no-go decisions, re-reviews, or "review since" requests.
---

# Review a change against the spec and the standards

Use this as the **entry point** for a PR review. The two independent questions are: **Did we build the requested behavior?** and **Did we build it safely for this repository?** Keep the answers separate so good style cannot disguise a missing feature.

1. **Read the intent.** Read the PR description and linked issues, acceptance criteria, review threads, and any relevant docs. Read `AGENTS.md`, `.github/instructions/code-review.instructions.md`, `CONTRIBUTING.md`, and `docs/ARCHITECTURE.md`. If no formal spec exists, use the stated user-facing goal; say what remains unverified rather than inventing requirements.
2. **Establish the actual diff.** Compare against the PR's target branch and merge-base, not an arbitrary old commit. For a local branch use `git diff <base>...HEAD`; for a PR use its current head SHA and base. For stacked PRs, review against the intended parent branch. Inspect related callers and tests, not just changed hunks.
3. **Review the spec axis.** Map each requested behavior to implementation and observable evidence. Look for missing steps, edge cases, behavior that was not requested, and changes to game feel. Check whether screenshots of UI changes come from the _running game_ rather than design mockups.
4. **Review the standards axis.** Apply `AGENTS.md`, the review instructions and relevant skills. Use [Code review and quality](../code-review-and-quality/SKILL.md) for correctness, architecture, security and performance. Use [Game regression review](../review-game-regressions/SKILL.md) whenever gameplay, controls, saves, world generation, rendering, PWA or deployment changes.
5. **Verify evidence.** Check the current commit's CI results (not a superseded run). Expect `npm run check` for gameplay and UI changes; expect `npm run test:e2e` for browser/input/save/startup changes. Check regression tests exercise observable behavior, existing review threads have been addressed or clearly explained, and any merge conflicts or known failures are reported. Do not claim a command ran unless there is evidence.
6. **Report only actionable findings.** First verify each suspected defect against guards, callers, and tests. Distinguish problems introduced by the diff from pre-existing debt. Avoid duplicate comments, guesses, format-only nits already caught by tooling, and fabricated findings. No findings is a valid outcome.

## Output

Report **Spec** and **Standards** separately, with the strongest findings first within each. Each finding needs:

- **Severity**: Critical (data loss/security/broken core gameplay), Required (real correctness or regression risk), Optional, or Nit.
- **Location**: exact changed file and line or smallest relevant range.
- **Why it matters**: a plausible reproduction or failure path.
- **Suggested repair**: a concrete fix and the test that would prove it.

Close with a **GO / NO-GO / NOT VERIFIED** judgment. NO-GO means a Critical or Required defect, unresolved blocker, or failed required check; NOT VERIFIED means essential evidence could not be checked. Call out unknowns, tests not run, and screenshots missing for changed visuals. Do not approve or merge automatically as part of a review unless explicitly asked.

This approach is tailored to MauriceCraft from the widely used two-axis review pattern in [Matt Pocock's code-review skill](https://github.com/mattpocock/skills/tree/main/skills/engineering/code-review).
