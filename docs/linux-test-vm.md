# The Linux test VM

**Church Hub VM**: Ubuntu 24.04, 8 CPU, 8 GB, 100 GB. It runs on the bringes_production Harvester (namespace `superfactory-machines`, VLAN 250) and is reachable only from the internal network. It is a Superfactory machine: agents run commands on it as user `sf`, with passwordless sudo, through `platform_run` (platform `linux:Church Hub VM`) once a task has it among its machines.

## Setting it up (once, idempotent)
- The project's setup (`scripts/setup/linux.sh`) installs the build and Playwright libraries, as on every Linux machine.
- `sudo bash scripts/setup/linux-desktop.sh` adds:
  - XFCE and xrdp: TLS only, no root login, user `churchhub`.
  - The agent tools: xdotool, scrot, ImageMagick, ffmpeg, wmctrl and Xvfb.
  - A firewall: SSH (22) and RDP (3389) in from private addresses only, nothing else in.

  It sets `churchhub`'s password only from the secret `CHURCH_HUB_VM_RDP_PASSWORD`, never from an argument or file. **The owner sets the RDP password later**: until then RDP logins are refused.

## Driving the desktop as an agent
Agents use their own X display, `:99`, so they never take over a person's RDP session:
```sh
# Start it (once per boot)
Xvfb :99 -screen 0 1920x1080x24 >/tmp/xvfb.log 2>&1 &
DISPLAY=:99 dbus-launch xfce4-session >/tmp/xfce.log 2>&1 &
export DISPLAY=:99

# Install and start the packaged app
sudo apt-get install -y ./app/tauri/target/release/bundle/deb/church-hub_*.deb
church-hub >/tmp/church-hub.log 2>&1 &
# ... or the AppImage
chmod +x church-hub_*.AppImage && ./church-hub_*.AppImage &

# See it, click it, type in it
scrot -o /tmp/shot.png                           # screenshot (read it with platform_read_file)
xdotool search --sync --name church-hub windowactivate
xdotool mousemove 960 540 click 1
xdotool type 'Amazing grace'; xdotool key Return
ffmpeg -f x11grab -video_size 1920x1080 -i :99 -t 20 /tmp/clip.mp4   # record a clip

# Stop it
pkill -x church-hub      # the sidecar ends with it (T-149)
```
The installed app keeps its data in `~/.local/share/com.church-hub/` and serves on port 3000. That port belongs to the installed app: tests use their own port.

## Testing on it
- Sidecar smoke test (sidecar laid out like the .deb): `cd app/apps/server && bun run smoke:sidecar`
- Full e2e suite: `cd app/apps/client && CI=1 TEST_PORT=4199 bunx playwright test --workers=1 --retries=2`
- Linux package: `cd app && bunx tauri build --bundles deb --config '{"bundle":{"createUpdaterArtifacts":false}}'`. It lands in `app/tauri/target/release/bundle/deb/`. Afterwards run `cargo clean --manifest-path app/tauri/Cargo.toml`. The AppImage doesn't build on 24.04 yet (CH-196): `ldd` crashes on the Bun-compiled sidecar. CI builds it on 22.04.

## For people: RDP
Over the VPN, connect an RDP client to the VM's internal address on port 3389 as `churchhub`. The address and login steps are in the task's private note, never in the repo.
