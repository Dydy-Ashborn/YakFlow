#!/bin/bash
# Fabrique le paquet client : public/telecharger/YakFlow.zip (à relancer après chaque modification de app-locale/)
set -e
cd "$(dirname "$0")"
OUT="public/telecharger"
TMP="$(mktemp -d)/YakFlow"
mkdir -p "$TMP" "$OUT"
rsync -a --exclude '__pycache__' --exclude '.DS_Store' --exclude '*.pyc' app-locale/ "$TMP/"
chmod +x "$TMP/Lancer YakFlow.command"
(cd "$(dirname "$TMP")" && zip -qr -X YakFlow.zip YakFlow)
cat "$(dirname "$TMP")/YakFlow.zip" > "$OUT/YakFlow.zip"
echo "Paquet prêt : $OUT/YakFlow.zip ($(du -h "$OUT/YakFlow.zip" | cut -f1))"
