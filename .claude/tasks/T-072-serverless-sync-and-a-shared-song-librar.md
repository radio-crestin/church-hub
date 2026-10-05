---
id: T-072
title: Serverless sync and a shared song library — S3 + Cloudflare Workers, cheap, SQLite in the browser
sprint: backlog
urgent: false
status: todo
owner:
rolled: 0
order: 49
created: 2026-10-05
---
## Goal
User 05/10, verbatim: «have a serverless way to sync them [phones and the computer] when the computer is down.. using some s3 and cloudflare workers.. we need a smart way to do it with cheap infrastructure, also we would like to have an option to have our own managed set of songs which can be added by users and we will manage these songs.. also churches can share their songs too.. (there must be a deduplication on each client side, also nothing which is local edited must not be replaced, but as we are doing for resursecrestine we want to let any client to do the same..) also the s3 storage must be protected, compressed, find a way to run the sqlite in the browser too, very fast to be downloaded, full text search very fast and efficient, but a lot of details needs to be decided..».
Requirements: sync works with the church computer offline (phones ↔ cloud); cheap infra (S3/R2 + Workers); a curated song library we manage, fed by user submissions; churches can publish/share their songs; client-side deduplication; local edits are never overwritten (like the Resurse Crestine import, T-035); any client can import shared sets the same way; storage protected (auth, per-church access) and compressed; SQLite in the browser (e.g. wa-sqlite/OPFS) with a small, fast download and fast full-text search.
Start with a design doc and decisions for the user, not code. Reconcile with the approved cloud-sync architecture (Electric + PGlite, memory 2026-07-19, spikes on feat/cloud-sync-electric-pglite) and phone pairing (T-050).

## Notes

## PR
- branch:
- pr:
- video:
