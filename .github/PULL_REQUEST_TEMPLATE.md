## Summary

<!-- What changed and why? Keep this short and clear. -->

## How to test

<!-- Exact steps a reviewer can run/play to verify this. Include both desktop and mobile notes when relevant. -->

## Checklist

- [ ] I kept browser world saves backward compatible (`blockcraft-worlds` database, world format, IDs, and keys unchanged unless explicitly versioned and migration-safe).
- [ ] I verified the change still works on desktop controls and phone/touch controls (when relevant).
- [ ] I ran `npm run check`.
- [ ] I ran `npm run test:e2e` for UI/control/save/startup changes, or explained why it was not needed.
- [ ] I updated docs/tests that changed behavior or contributor workflow.
- [ ] I did not include generated `dist/` output, secrets, or unrelated refactors.

## Risks and follow-ups

<!-- Call out anything reviewers should watch for (performance, save compatibility, mobile UX, etc.). -->
