#!/usr/bin/env bash
set -e

# Forward to comprehensive deploy script
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/deploy-apk.sh" "$@"
