#!/bin/bash
# =======================================================
#    ⚡ BeamDrop GitHub Sync & Release Script
#    Repository: raouf-djmilo/BeamDrop
# =======================================================
set -e

echo "======================================================="
echo "   ⚡ BeamDrop - GitHub Repository Sync & Release"
echo "======================================================="
echo ""

# 1. Ensure remote is configured
git remote set-url origin https://github.com/raouf-djmilo/BeamDrop.git 2>/dev/null || git remote add origin https://github.com/raouf-djmilo/BeamDrop.git
git branch -M main

# 2. Re-pack extension with updated checksums and build
echo "[1/4] Packing Chrome Extension bundle..."
node scripts/pack-extension.cjs

echo "[2/4] Verifying TypeScript & Vite Build..."
npm run build

echo "[3/4] Staging production files for GitHub..."
git add -A

COMMIT_MSG="feat(release): Phase 6 production sync - offline optical QR loop, wake lock & SHA-256 integrity"
if [ -n "$1" ]; then
  COMMIT_MSG="$1"
fi

git commit -m "$COMMIT_MSG" || echo "No changes to commit."

echo ""
echo "[4/4] Ready to push to GitHub!"
echo "Run the following command to push your changes:"
echo "   git push -u origin main"
echo ""
echo "======================================================="
echo " ✓ Local workspace synced and packaged successfully!"
echo "======================================================="
