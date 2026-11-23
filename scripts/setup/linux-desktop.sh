#!/usr/bin/env bash
# Turns a Linux test machine (Ubuntu 24.04, run as root) into a desktop people and agents can both drive:
# XFCE, xrdp for people (RDP on the internal network only), and xdotool, scrot and ffmpeg for agents.
# Not part of every machine's setup: run it once on the Church Hub VM (docs/linux-test-vm.md).
# Idempotent. The RDP user's password comes from $CHURCH_HUB_VM_RDP_PASSWORD (a Superfactory secret),
# never from an argument or a file, so it shows in no log.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
RDP_USER=${RDP_USER:-churchhub}

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends \
  xfce4 xfce4-terminal dbus-x11 xorgxrdp xrdp xvfb \
  xdotool scrot imagemagick ffmpeg wmctrl ufw \
  fonts-dejavu fonts-noto-color-emoji

# The person who tests over RDP: their own user, its password only from the secret.
id "$RDP_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash -G audio,video "$RDP_USER"
if [ -n "${CHURCH_HUB_VM_RDP_PASSWORD:-}" ]; then
  printf '%s:%s\n' "$RDP_USER" "$CHURCH_HUB_VM_RDP_PASSWORD" | chpasswd
else
  echo "CHURCH_HUB_VM_RDP_PASSWORD is not set: $RDP_USER's password is unchanged" >&2
fi
echo xfce4-session > "/home/$RDP_USER/.xsession"
chown "$RDP_USER:" "/home/$RDP_USER/.xsession"

# xrdp: TLS only, no root logins.
sed -i 's/^security_layer=.*/security_layer=tls/; s/^crypt_level=.*/crypt_level=high/' /etc/xrdp/xrdp.ini
sed -i 's/^AllowRootLogin=.*/AllowRootLogin=false/' /etc/xrdp/sesman.ini
adduser xrdp ssl-cert >/dev/null 2>&1 || true
systemctl enable --now xrdp
systemctl restart xrdp

# Firewall: SSH and RDP only from private (internal and VPN) addresses, nothing else in.
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
for net in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16; do
  ufw allow from "$net" to any port 22 proto tcp
  ufw allow from "$net" to any port 3389 proto tcp
done
ufw --force enable
echo "desktop ready: RDP user $RDP_USER; SSH and RDP open to private addresses only"
