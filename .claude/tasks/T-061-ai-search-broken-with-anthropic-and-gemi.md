---
id: T-061
title: AI search broken with Anthropic and Gemini (ai 5 rejects v3 models)
sprint: 2026-09-28
urgent: false
status: done
owner: security-deps
rolled: 0
order: -16
created: 2026-10-04
---
## Goal
Found by security-deps during T-059 (2026-10-04): AI search with the Anthropic or Gemini provider is already broken on main — the `ai` package v5 rejects the v3 language models those provider packages now return. OpenAI is fixed by T-059's PR #88. Details in the T-059 task note. Fix so AI search works again with Anthropic, Gemini and OpenAI (align the `ai` SDK and @ai-sdk/* provider versions), with a test per provider (mocked) and a quick real check if a key is configured.

## Notes
- 2026-10-04: security-deps (2026-10-04): PR #90 https://github.com/radio-crestin/church-hub/pull/90, rebased on main 5179069f. Commits 102d5000 (fix: @ai-sdk/anthropic ^2.0.84 and @ai-sdk/google ^2.0.77, the v2 line that matches ai 5 with the same provider-utils 3.0.28; openai.chat() for openai/custom, since @ai-sdk/openai 2 otherwise uses the Responses API that custom servers lack; maxTokens → maxOutputTokens in 5 calls, because ai 5 silently ignored the limits; LanguageModel type; unit test ai-providers.test.ts per provider with mocked HTTP) and 5658cb88 (e2e ai-search-providers.spec.ts + helpers/mock-ai-provider.ts, a local mock Anthropic/Gemini API). Covers song AI search, Bible AI search and lyrics correction (all use createAiModel). Verified: on the pre-fix code both the unit test and the e2e fail with "Unsupported model version v3"; after the fix unit 4/4, e2e 4/4, server 419 pass, songs/health e2e pass. Not verified: a real call with live keys (no key in env); PR build pending. Side note: the songs UI swallows AI search errors silently (out of scope).
branch: fix/ai-search-anthropic-gemini
pr: #90 https://github.com/radio-crestin/church-hub/pull/90
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@2ddde3cd624ac50a3166a678d5d6d907b36734ff/pr-demos-fix-ai-search-anthropic-gemini/AI-song-search-with-Anthropic-before-.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@2ddde3cd624ac50a3166a678d5d6d907b36734ff/pr-demos-fix-ai-search-anthropic-gemini/AI-song-search-with-Anthropic-after-.mp4
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-add6b7e61ffd50215/.review-build/T-061/church-hub-T-061.app
- 2026-10-04: build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-90/church-hub-macos-arm64-pr-90-5658cb8.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-90/church-hub-windows-x64-pr-90-5658cb8.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-90/church-hub-linux-x64-pr-90-5658cb8.AppImage (PR #90 build green on 3 OSes at 5658cb8)
- 2026-10-04: AI search works again with Anthropic and Gemini (provider packages back on the 2.x line ai 5 supports; maxOutputTokens fix; OpenAI/custom on Chat Completions). PR #90 merged (91772ae2). Tested against mock APIs only.

## PR
- branch:
- pr:
- video:
