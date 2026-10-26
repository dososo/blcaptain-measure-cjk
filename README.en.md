# Measure (分寸)

[中文](README.md) · **English**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE) ![Agent Skill](https://img.shields.io/badge/Agent-Skill-9e4b3b.svg) [![npm](https://img.shields.io/badge/npm-measure--cjk-7e8c6b.svg)](https://www.npmjs.com/package/measure-cjk)

> A Chinese typography skill for coding agents (Claude Code, Codex, …), plus a linter, `measure-cjk`, that proves the result.

**Live showcase:** <https://dososo.github.io/blcaptain-measure-cjk/site/>

## What it checks

Spacing between Chinese and Latin/digits, full-width punctuation, line-start prohibition, line length, line height, letter spacing, faux italics, minimum font size, CJK font stacks, and font licensing (four tiers, each backed by a link to the official license text and a verification date). Two modes: a static mode that reads source files offline, and a render mode (`--render`) that measures the page in a real browser at six widths and attaches a screenshot to every error. `card` exports 1080×1440 Xiaohongshu cards using only fonts licensed for commercial images.

## Does it help?

Same agent, same model, 30 Chinese page prompts, with and without the skill, scored by measure's own render-mode linter (2026-10-26):

| | Codex (gpt-6-astra) | Claude Code (claude-opus-5-5) |
|---|---|---|
| Pages with zero errors (all rules) | 0/30 → 30/30 | 0/30 → 27/30 |
| Pages with zero errors (excluding T02, T04) | 0/30 → 30/30 | 15/30 → 27/30 |
| Paired comparison (excluding T02, T04) | 30 better, 0 same, 0 worse; p < 0.0001 | 14 better, 14 same, 2 worse; p = 0.0042 |

The score measures compliance with measure's own rules, not aesthetics. For Claude Code, five pages are Xiaohongshu cards whose only remaining issue is T11, which currently judges cards by browser pixels; treating them as compliant gives 9/18/3, p ≈ 0.146 (not significant). Details: [`docs/verification/w2/northstar/`](docs/verification/w2/northstar/).

## Install

| Agent | Skill |
|---|---|
| Claude Code | `/plugin marketplace add dososo/blcaptain-measure-cjk`, then `/plugin install measure@blcaptain-measure-cjk` |
| Codex | `codex plugin marketplace add dososo/blcaptain-measure-cjk`, then `codex plugin add measure@blcaptain-measure-cjk` |
| Others | `npx skills add dososo/blcaptain-measure-cjk` (Node ≥ 22.20) |

The linter is published separately:

```bash
npm install -g measure-cjk
measure-cjk lint dist/ --render     # render mode needs Playwright (optional dependency)
```

## Themes

Six themes, one file each (≤ 8 KB): Broadsheet, Manual, Archive, Quarterly, Songke (traditional), Dososo (traditional). See [`skills/measure/references/themes/`](skills/measure/references/themes/).

## License

Code: Apache-2.0. Docs, rule texts, themes and `data/`: CC BY 4.0. The font license table is not legal advice.

Author: BLCaptain ([@dososo](https://github.com/dososo)).
