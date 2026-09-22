# Anagu — Full startup script (PowerShell for Windows)
Set-Location $PSScriptRoot\..

Write-Host "=== Step 1: Starting infrastructure services ===" -ForegroundColor Cyan
docker compose up -d
Write-Host "Waiting 45s for services to become healthy..."
Start-Sleep -Seconds 45

Write-Host ""
Write-Host "=== Step 2: Checking service health ===" -ForegroundColor Cyan
docker compose ps

Write-Host ""
Write-Host "=== Step 3: Deploying smart contracts ===" -ForegroundColor Cyan
Set-Location contracts
npx hardhat run scripts/deploy.ts --network besu_local

Write-Host ""
Write-Host "=== Step 4: Update .env with deployed addresses ===" -ForegroundColor Yellow
Write-Host "Check contracts/deployments/besu_local.json and update .env:"
Write-Host "  LAND_TITLE_NFT_ADDRESS=<address from besu_local.json>"
Write-Host "  LAND_REGISTRY_ADDRESS=<address from besu_local.json>"

Write-Host ""
Write-Host "=== Step 5: Start backend ===" -ForegroundColor Cyan
Set-Location ..\backend
npm run start:dev
