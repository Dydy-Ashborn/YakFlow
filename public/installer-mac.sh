#!/bin/bash
# YakFlow · installation Mac en une commande :
#   curl -fsSL https://yakflow.netlify.app/installer-mac.sh | bash
# Installe (ou met à jour) YakFlow dans ~/YakFlow, crée « YakFlow » sur le Bureau, puis lance le studio.
set -e
DEST="$HOME/YakFlow"
URL="https://yakflow.netlify.app/telecharger/YakFlow.zip"
echo ""
echo "  YakFlow · installation"
echo ""
if ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' >/dev/null 2>&1; then
  echo "  Python 3 est nécessaire."
  echo "  Si une fenêtre propose d'installer les « outils de ligne de commande », accepte, puis relance cette commande."
  echo "  Sinon, installe Python depuis la page qui s'ouvre, puis relance cette commande."
  open "https://www.python.org/downloads/macos/" || true
  exit 1
fi
TMP="$(mktemp -d)"
echo "  Téléchargement…"
curl -fsSL "$URL" -o "$TMP/YakFlow.zip"
unzip -q -o "$TMP/YakFlow.zip" -d "$TMP"
mkdir -p "$DEST"
cp -R "$TMP/YakFlow/." "$DEST/"
rm -rf "$TMP"
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true
chmod +x "$DEST/Lancer YakFlow.command"
# raccourci sur le Bureau (créé sur ton Mac : macOS ne le bloque pas)
cat > "$HOME/Desktop/YakFlow.command" <<'L'
#!/bin/bash
cd "$HOME/YakFlow" && exec "./Lancer YakFlow.command"
L
chmod +x "$HOME/Desktop/YakFlow.command"
echo "  Installé dans $DEST"
echo "  Pour relancer YakFlow plus tard : double-clic sur « YakFlow » sur ton Bureau."
echo ""
cd "$DEST"
exec caffeinate -i python3 serveur.py
