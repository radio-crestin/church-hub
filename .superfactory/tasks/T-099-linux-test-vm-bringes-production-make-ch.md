---
id: T-099
title: Linux test VM (bringes_production) + make Church Hub fully Linux-compatible
kind: task
level: normal
order: 58
status: backlog
progress: 0
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T00:00:00.000Z
---

## Goal
User (2026-10-06): «create in /Users/iosif/Documents/Projects/bringes-infrastructure/environments/bringes_production a linux vm where you will make the app fully compatible with linux, test it, and so on.. make sure to not leak any secrets inside this repo, use ssh to login internally there.. setup rdp so i can also test it.. also you should be able to take screenshots, control it 100% and so on». Put in the backlog.

Done means:
- A Linux desktop VM defined in bringes-infrastructure/environments/bringes_production, following that repo's existing patterns (IaC, how other VMs and networks are defined there). No secrets in either repo: keys, passwords and tokens live only where that repo already keeps secrets (secret store or gitignored vars), never in committed files, task notes, PRs or logs.
- Agents reach it over SSH on the internal network only (no public SSH).
- RDP set up so the user can log in and test the app themselves (internal/VPN access, strong auth). Connection steps go in a private note.
- Full remote control for agents: screenshots, mouse/keyboard, start/stop the app (e.g. xdotool + a screenshot tool over SSH, or the same through the RDP session), documented in one short how-to.
- On the VM: install and run the packaged Linux build (AppImage/deb) and the dev setup; fix everything that doesn't work on Linux until the app is fully usable. Known bug from T-098: on installed Linux builds the sidecar looks for resources next to the executable (app/apps/server/src/utils/paths.ts:63), not in usr/lib/church-hub, so MIDI etc. may not load.
- Run the full e2e suite on the VM; screenshots/video of the app working there.
- Ask the lead before creating cloud resources that cost money or exposing anything outside the internal network.
