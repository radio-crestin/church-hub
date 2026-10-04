---
id: T-007
title: Amin and first/last-slide animations in step with the lyrics
sprint: 2026-10-05
urgent: false
status: doing
owner: slide-animations
rolled: 0
order: 7
created: 2026-10-04
---
## Goal
Chat 21/06 BCEV: «cand se da next la ultima strofa din cantare, 'Amin' nu are animatie la fel ca versurile... (atm apare instant)»; 18/06 BCEV: «in noul feature cu primul/ultimul slide, animatiile nu sunt afisate in acelasi timp ca textul principal». Amin default config has no slideTransition (defaultConfigs.ts ~228-240; ScreenContent.tsx 421-445). Amin, gama and first/last-slide elements animate with the same timing as the main text.

## Notes
