#!/bin/sh
set -eu

# The image timezone is configured at build time; keep runtime simple and deterministic.
export TZ="${TIMEZONE:-${TZ:-UTC}}"

exec "$@"
