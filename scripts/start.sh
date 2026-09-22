#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "=== Step 1: Starting infrastructure ==="
docker compose up -d
echo "Waiting 45s for services to become healthy..."
sleep 45

echo ""
echo "=== Step 2: Service health ==="
docker compose ps

echo ""
echo "=== Step 3: Deploying contracts ==="
cd contracts
npx hardhat run scripts/deploy.ts --network besu_local

echo ""
echo "=== Step 4: Update .env with deployed addresses ==="
echo "Check contracts/deployments/besu_local.json and update .env"

echo ""
echo "=== Step 5: Start backend ==="
cd ../backend
npm run start:dev
