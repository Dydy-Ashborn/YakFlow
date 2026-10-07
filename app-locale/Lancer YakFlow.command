#!/bin/bash
# YakFlow · lanceur Mac (double-clic). La première fois : clic droit > Ouvrir.
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1 || ! python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" 2>/dev/null; then
  echo ""
  echo "  Python 3 est nécessaire pour faire tourner YakFlow."
  echo "  Installe-le depuis https://www.python.org/downloads/ puis relance YakFlow."
  echo ""
  open "https://www.python.org/downloads/"
  read -r -p "  Appuie sur Entrée pour fermer..." _
  exit 1
fi
echo ""
echo "  YakFlow démarre. Laisse cette fenêtre ouverte pendant que tu travailles."
echo ""
exec caffeinate -i python3 serveur.py
