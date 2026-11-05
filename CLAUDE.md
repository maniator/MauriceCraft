# MauriceCraft instructions for Claude Code

@AGENTS.md

The canonical reusable skills are in `.agents/skills/`. The entries in `.claude/skills/` are symlinks to those same skill directories, not copies. Use the relevant skill when fixing bugs, adding features, testing, or reviewing PRs.

Keep project-wide guidance in `AGENTS.md`; do not maintain another set of rules here.
