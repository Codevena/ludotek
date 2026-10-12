#!/bin/sh
set -eu

# This file is a read-only mount of one generated, disposable fixture password.
fixture_password="$(cat /run/secrets/openssh-smoke-password)"
case "$fixture_password" in
  ''|*[!a-f0-9]*) echo 'Invalid fixture password file' >&2; exit 1 ;;
esac
[ "${#fixture_password}" -eq 48 ] || exit 1
printf 'smoke:%s\n' "$fixture_password" | chpasswd
unset fixture_password

# Private host keys exist only in this disposable container's writable layer.
ssh-keygen -q -t ed25519 -N '' -f /etc/ssh/ssh_host_ed25519_key
exec /usr/sbin/sshd -D -e -f /etc/ssh/sshd_config
