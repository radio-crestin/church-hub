---
id: T-067
title: Request a feature — screenshot first, write a note, gently encouraged to annotate; land T-001
sprint: 2026-10-05
urgent: true
status: doing
owner: feature-request-2
rolled: 0
order: -1
created: 2026-10-05
---
## Goal
User 05/10: «in the task to request a feature/feedback have something like this where a screenshot is taken and the user can write something and also is encourage nicely to annotate the screenshot». Builds on T-001 (Request a feature: element picker, screenshot with drawing, notes, email → worker → GitHub issue + R2 + WhatsApp). T-001 was closed but its branch feat/request-a-feature (8 commits, last d4419a28, worktree .claude/worktrees/agent-a7afd339125c499ec) was never pushed or merged and is 132 commits behind main. Do: 1) rebase T-001's work onto main; 2) change the flow so opening "Request a feature" takes a screenshot right away and shows it with a text box to write what they want; 3) nicely encourage annotating it (a friendly hint like "Draw on the screenshot to show us where", drawing tools ready and obvious, maybe a subtle pulse on the pen tool), annotation optional; 4) one PR with T-001's work + this change. Don't deploy the worker or infra (bringes-infrastructure branch feat/waha-api-public-access) without asking the lead.

## Notes
- 2026-10-05: User 05/10 sent a reference: the ChatGPT iOS "Report app issue" sheet (image: /Users/iosif/.claude/uploads/f24a82d0-2c32-4853-b9a2-02b74deef0a1/eae38157-image.png). The sheet has a "What happened?" text box with a 0/2000 counter, a short privacy line, an "Include screenshot in report" toggle with a thumbnail of the screen, and a Send button. User: «improve it and make it more intuitive, like a short flow». So: a short, guided flow of 2–3 clear steps in this clean style, e.g. 1) screenshot shown big, with a friendly nudge to draw where; 2) "What would you like?" text box with counter + email; 3) send → thank-you. Keep the screenshot toggle, the public-issue privacy line and step progress. Fewer choices per screen, mobile responsive.

## PR
- branch:
- pr:
- video:
