#!/bin/bash
# =======================================================
#    ⚡ BeamDrop Universal Device Bridge - Auto Updater (Mac/Linux)
# =======================================================
set -e

echo "======================================================="
echo "   ⚡ BeamDrop Universal Device Bridge - Auto Updater"
echo "======================================================="
echo ""
echo "[1/3] Syncing latest code and features from GitHub..."
git pull origin main

echo ""
echo "[2/3] Building latest assets and extensions..."
if [ -f package.json ]; then
    npm run build
fi

echo ""
echo "[3/3] Update Complete!"
echo "======================================================="
echo " ✓ All files updated to the latest version."
echo " ✓ Open BeamDrop in Chrome and click 'Instant Reload'."
echo "======================================================="
