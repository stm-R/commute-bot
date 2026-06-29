#!/bin/sh
set -eu

TIMEZONE_NAME="${TIMEZONE:-Europe/Amsterdam}"

if [ -f "/usr/share/zoneinfo/$TIMEZONE_NAME" ]; then
	ln -snf "/usr/share/zoneinfo/$TIMEZONE_NAME" /etc/localtime
	echo "$TIMEZONE_NAME" > /etc/timezone
else
	echo "[Entrypoint] Warning: timezone data not found for $TIMEZONE_NAME, using default system timezone" >&2
fi

exec "$@"
