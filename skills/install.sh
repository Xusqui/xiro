#!/usr/bin/env bash
# Instala la skill /xiro de este repo en ~/.claude/skills/xiro (nivel de usuario).
#   skills/install.sh           copia los ficheros (instalación normal)
#   skills/install.sh --link    enlace simbólico al repo (los cambios del repo se ven al instante)
#   skills/install.sh --check   solo comprueba requisitos y diferencias, no toca nada
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/xiro" && pwd)"
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/xiro"
MODE="${1:-copy}"

command -v node >/dev/null || { echo "Falta Node 18 o superior" >&2; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || { echo "Node $NODE_MAJOR no vale; hace falta 18 o superior" >&2; exit 1; }

case "$MODE" in
  --check)
    if [ -e "$DEST" ]; then diff -rq -x '.DS_Store' -x '._*' "$SRC" "$DEST" && echo "Instalada y al día: $DEST"
    else echo "No instalada (destino: $DEST)"; fi
    exit 0 ;;
  --link)
    mkdir -p "$(dirname "$DEST")"
    [ -L "$DEST" ] && rm "$DEST"
    [ ! -e "$DEST" ] || { echo "$DEST ya existe y no es un enlace; muévelo antes" >&2; exit 1; }
    ln -s "$SRC" "$DEST" ;;
  copy)
    [ ! -L "$DEST" ] || rm "$DEST"
    mkdir -p "$DEST"
    rsync -a --delete --exclude='.DS_Store' --exclude='._*' "$SRC/" "$DEST/" ;;
  *) echo "Uso: $0 [--link|--check]" >&2; exit 1 ;;
esac

echo "Skill /xiro instalada en $DEST"
echo "Comprobación: node $DEST/scripts/selftest.mjs"
