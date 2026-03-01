#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Render Build Script — Next.js + Python ML
# ──────────────────────────────────────────────────────────────────────────────
set -o errexit # exit on error

echo "══════════════════════════════════════════════════"
echo "  Step 1/3: Installing Node.js dependencies"
echo "══════════════════════════════════════════════════"
npm install

echo "══════════════════════════════════════════════════"
echo "  Step 2/3: Installing Python ML dependencies"
echo "══════════════════════════════════════════════════"
pip install --upgrade pip
pip install -r scripts/requirements-ml.txt

echo "══════════════════════════════════════════════════"
echo "  Step 3/3: Building Next.js application"
echo "══════════════════════════════════════════════════"
npm run build

echo "══════════════════════════════════════════════════"
echo "  ✅ Build complete!"
echo "══════════════════════════════════════════════════"
