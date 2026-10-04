---
id: T-036
title: /api/songs without a limit returns every song (10MB)
sprint: backlog
urgent: false
status: todo
owner:
rolled: 0
order: 33
created: 2026-10-04
---
## Goal
Chat 21/05 BCEV: «api-ul http://localhost:3000/api/songs intoarce 10mb de date». With limit it pages; without it the legacy branch returns getAllSongs() (index.ts ~5195-5270, songs.ts 109-120). Make it always paginate with a default page size; update callers and OpenAPI.

## Notes
