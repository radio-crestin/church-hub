---
id: T-086
title: "Marcaje: a minimal program view next to the bookmarks"
kind: task
level: normal
order: 9
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-05T00:00:00.000Z
updatedAt: 2026-10-06T21:05:18.844Z
---

## Goal
From the "Church Hub Bugs" WhatsApp group (unsure row in the T-081 ledger; the message got a ❤️): show a minimal view of the program next to marcaje. Read the original message with the whatsapp-requests skill before designing.

## Notes

- 2026-10-06: 2026-10-06 owner programs. Original (2026-06-14): "in pagina cantarilor, langa marcaje sa avem si un program afisat, cu un UI minimal in care se afiseaza numai titlul cantarii si versetele citite, iar cand unul din ele este afisat, sa se faca preview in partea stanga (inclusiv la versete, verset cu verset)". State on main + T-088: the Programe panel already sits next to Marcaje on the song and Bible pages; presenting a song opens it on the left; presenting verses shows them on the left as ONE slide. Conflict: commit 616c4853 (2026-09-06) made a passage one slide "per the operator's decision ... rather than stepping verse by verse". Missing: (1) minimal look (rows show category, "Fără gamă" chip, sung circle, grip and 3 buttons); (2) verse-by-verse, which contradicts the Sep 6 decision. Asked the lead. Branch feat/marcaje-program-preview (from T-088's branch), port 3188.
- 2026-10-06: Paused, waiting for the user (via lead): (1) verse by verse vs the Sep 6 one-slide decision: keep one slide / verse by verse everywhere / one slide on screen but the left preview lists verses one per row; (2) minimal look: program rows mirror Marcaje on purpose (category, tags, key chip), so a minimal look would undo that. No code changed yet. BEFORE captures in my scratchpad (b086/).
- 2026-10-06: Closed without changes. User (2026-10-06): "it's already implemented i think" (verse by verse) and "i think it's already implemented.. clicking on it will open the song/verse and then the user can go through it..". The Programe panel next to Marcaje already covers it (with T-088).
