# Implementation Plan: Anagu Land Administration Framework

## Overview

The implementation follows the hard-gated build order defined in PROJECT.md:
**Step 0 (Infrastructure) → Step 1 (GIS) → Step 2 (Blockchain/NFT) → Step 3 (Oracle + MQTT) → Step 4 (Integration) → Step 5 (Cross-cutting Evaluation)**

Each gate must pass its own isolated tests before the next step begins. All application code is TypeScript. Smart contracts are Solidity. Directory layout uses `backend/`, `frontend/web/`, and `frontend/mobile/` (not `apps/`).

---

## Tasks

### Step 0 — Environment and Infrastructure

- [x] 0. Scaffold monorepo and wire infrastructure services
  - [x] 0.1 Create monorepo directory structure and root config files
    - Create root `package.json` (npm workspaces: `backend`, `frontend/web`, `frontend/mobile`, `contracts`)
    - Create root `tsconfig.base.json` with strict TypeScript settings
    - Create `.env.example` listing all required environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS_URL`, `BESU_RPC_URL`, `REGISTRAR_PRIVATE_KEY`, `GOVERNOR_PRIVATE_KEY`, `LAND_TITLE_NFT_ADDRESS`, `LAND_REGISTRY_ADDRESS`, `MQTT_BROKER_URL`, `REDIS_URL`
    - _Requirements: 1.1_

  - [x] 0.2 Write `docker-compose.yml` for Besu, Redis, and EMQX
    - Define `besu` service: `hyperledger/besu:latest`, volumes `./infra/besu:/config`, ports `8545:8545` and `8546:8546`, health check via `curl` to `http://localhost:8545`
    - Define `redis` service: `redis:7-alpine`, port `6379:6379`, health check `redis-cli ping`
    - Define `mqtt` service: `emqx/emqx:latest`, ports `1883:1883`, `8083:8083`, `18083:18083`, health check `emqx ping`
    - _Requirements: 1.1, 1.2_

  - [x] 0.3 Create Besu QBFT genesis and config files
    - Write `infra/besu/genesis.json`: `chainId` 1337, `berlinBlock` 0, QBFT `blockperiodseconds` 1, `epochlength` 30000, `requesttimeoutseconds` 4
    - Write `infra/besu/config.toml` enabling RPC HTTP, `ETH,NET,QBFT,ADMIN` APIs, and CORS wildcard
    - _Requirements: 1.5, 1.6_

  - [x] 0.4 Scaffold NestJS backend with Supabase client
    - Run `npx nest new backend` (TypeScript strict mode)
    - Install `@supabase/supabase-js`, `@nestjs/jwt`, `jose`, `ethers`, `mqtt`, `ioredis`
    - Create `backend/src/supabase/supabase-client.service.ts` that initialises Supabase client from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars and exposes typed `from()` and `rpc()` methods
    - Add `AppModule` import of `SupabaseModule` and log `"PostgreSQL connected"` on successful Supabase connection
    - Create `backend/src/health/health.controller.ts` with a `GET /health` endpoint returning `{ status: 'ok' }`
    - _Requirements: 1.3_

  - [x] 0.5 Scaffold Next.js web portal
    - Run `npx create-next-app frontend/web --typescript --app --tailwind --eslint`
    - Install `@supabase/auth-helpers-nextjs`, `@supabase/supabase-js`
    - Create `frontend/web/lib/supabase.ts` browser client using env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - _Requirements: 11.6_

  - [x] 0.6 Scaffold React Native Expo mobile app
    - Run `npx expo init frontend/mobile --template expo-template-blank-typescript`
    - Install `react-native-mmkv`, `@react-native-community/netinfo`, `mqtt`, `@supabase/supabase-js`
    - Create `frontend/mobile/lib/supabase.ts` Supabase client
    - _Requirements: 12.6_

  - [x] 0.7 Scaffold Hardhat contracts project and deploy a smoke-test contract to local Besu
    - Run `npx hardhat init` in `contracts/` (TypeScript project)
    - Install `@openzeppelin/contracts`, `@nomicfoundation/hardhat-toolbox`
    - Configure `hardhat.config.ts` with a `besu_local` network pointing to `http://localhost:8545`, `chainId` 1337
    - Write `contracts/scripts/deploy_test.ts`: deploy a minimal `Greeter` contract and print the confirmed transaction hash
    - _Requirements: 1.4_

  - [ ]* 0.8 Verify Step 0 gate — all services healthy and test transaction confirmed
    - Run `docker compose up -d` and assert all three containers show `healthy` in `docker compose ps`
    - Run `npx ts-node contracts/scripts/deploy_test.ts --network besu_local` and assert a transaction hash is returned
    - _Requirements: 1.2, 1.4_

- [x] Step 0 Checkpoint — Ensure all services are healthy and the Besu test transaction confirms before proceeding to Step 1.

---

### Step 1 — GIS-Based Spatial Verification

- [ ] 1. Implement the Spatial Verification module in the NestJS backend
  - [-] 1.1 Create Supabase PostGIS SQL functions and parcels table migration
    - Write `backend/src/spatial/migrations/001_spatial_schema.sql`:
      - `CREATE TABLE parcels (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), application_id UUID REFERENCES applications(id), token_id TEXT, geom GEOMETRY(POLYGON, 4326) NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`
      - `CREATE INDEX parcels_geom_idx ON parcels USING GIST (geom);`
    - Write `check_geometry_valid(wkt text)` SQL function calling `ST_IsValid(ST_GeomFromEWKT(wkt))` — returns `{ is_valid: boolean }`
    - Write `check_parcel_overlap(wkt text, buffer_metres float, exclude_application_id uuid)` SQL function using `ST_Intersects(ST_Buffer(...)::geometry, p.geom)` with 0.5 m buffer — returns `{ overlaps: boolean, conflicting_parcel_id: uuid | null }`
    - Apply migrations to Supabase via the Supabase CLI or SQL editor
    - _Requirements: 2.1, 2.2, 2.3, 2.7_

  - [~] 1.2 Implement `SpatialService` and `SpatialModule`
    - Create `backend/src/spatial/dto/spatial-verification.dto.ts` defining `CoordinateRing`, `SpatialVerificationDto`, `SpatialOutcome` (`'approved' | 'rejected_invalid_geometry' | 'rejected_overlap'`), and `SpatialVerificationResult` (including `bufferMetres: 0.5`, `diagnosticCode`, `conflictingParcelId`, `checkedAt`)
    - Create `backend/src/spatial/spatial.service.ts` implementing `verifySpatial(dto)` — Stage 1 calls `check_geometry_valid` RPC, Stage 2 calls `check_parcel_overlap` RPC with `OVERLAP_BUFFER_METRES = 0.5`; each stage records to `AuditService` before returning
    - Create `backend/src/spatial/spatial.module.ts` and register it in `AppModule`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_

  - [-] 1.3 Implement `AuditService` and `audit_trail` table
    - Write `backend/src/database/migrations/002_audit_trail.sql`:
      - `CREATE TABLE audit_trail (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), entity_id TEXT NOT NULL, actor_id UUID, action TEXT NOT NULL, outcome TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`
      - Enable RLS; add INSERT policy for `service_role`; add UPDATE and DELETE denial policies for all roles
    - Create `backend/src/audit/audit.service.ts` with `record(entry: AuditEntry)` (INSERT only) and `getTrail(entityId)` (SELECT ordered by `created_at` ASC)
    - Create `backend/src/audit/audit.module.ts`
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

  - [~] 1.4 Expose spatial verification REST endpoint
    - Create `backend/src/spatial/spatial.controller.ts` with `POST /parcels/validate` guarded by `SupabaseAuthGuard` and `RolesGuard` (Surveyor only)
    - Wire controller to `SpatialService`
    - Return `SpatialVerificationResult` as JSON response with HTTP 200 on approval, 422 on `GEOM_INVALID`, and 409 on `PARCEL_OVERLAP`
    - _Requirements: 2.4, 2.5, 2.6, 7.4_

  - [ ]* 1.5 Write property tests for `SpatialService` (Properties 1, 2, 3)
    - **Property 1: Spatial verification records every outcome in the audit trail**
    - **Validates: Requirements 2.5, 2.6, 2.8**
    - **Property 2: Invalid geometry is always rejected with `GEOM_INVALID`**
    - **Validates: Requirements 2.2, 2.5**
    - **Property 3: Overlapping parcel is always rejected with `PARCEL_OVERLAP` and non-null `conflictingParcelId`**
    - **Validates: Requirements 2.3, 2.6**
    - Use `fast-check` to generate arbitrary coordinate rings; mock Supabase RPC responses to return `is_valid: false` / `overlaps: true` for generated invalid/overlapping inputs; assert audit call and returned outcome match the property invariant in every case

  - [ ]* 1.6 Write unit tests for `SpatialService` with hand-constructed parcel sets
    - Test Set A (clean): valid non-overlapping polygon → `approved`
    - Test Set A: self-intersecting polygon → `rejected_invalid_geometry` + `GEOM_INVALID`
    - Test Set A: valid polygon overlapping seeded parcel → `rejected_overlap` + `PARCEL_OVERLAP` + non-null `conflictingParcelId`
    - Test Set B (messy): near-miss boundary (< 0.5 m apart) → `rejected_overlap`
    - Test Set B: sliver polygon → `rejected_invalid_geometry`
    - Test Set B: slightly rotated overlap → `rejected_overlap`
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

- [~] Step 1 Checkpoint — Ensure all spatial verification tests pass (both test sets) before proceeding to Step 2.

---

### Step 2 — Blockchain NFT Tokenisation and Statutory Revocation

- [ ] 2. Implement smart contracts and blockchain NestJS service
  - [-] 2.1 Write `LandTitleNFT.sol` smart contract
    - Implement ERC-721 + AccessControl: `GOVERNOR_ROLE` and `REGISTRAR_ROLE` constants
    - Implement `TitleMetadata` struct with five fields: `parcelRef`, `mintTxHash`, `spatialHash`, `titleMetadata` (IPFS CID), plus implicit `tokenId`
    - Implement `mint(to, parcelRef, spatialHash, titleMetadata)` restricted to `REGISTRAR_ROLE`; emit `TitleMinted` event
    - Implement `setMintTxHash(tokenId, txHash)` restricted to `REGISTRAR_ROLE`
    - Implement `revoke(tokenId, RevocationGround)` restricted to `GOVERNOR_ROLE`; set `isRevoked[tokenId] = true`; emit `TitleRevoked(tokenId, ground, msg.sender, block.timestamp)`
    - Implement `_beforeTokenTransfer` override: revert on `from != address(0)` ("direct transfers are disabled") and revert on `isRevoked[tokenId]` ("token is revoked")
    - Implement `getMetadata(tokenId)` returning `TitleMetadata`
    - _Requirements: 3.1, 3.2, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [~] 2.2 Write `LandRegistry.sol` smart contract
    - Implement AccessControl with `REGISTRAR_ROLE`
    - Hold immutable reference to `LandTitleNFT`
    - Implement `registryTransfer(tokenId, from, to)` restricted to `REGISTRAR_ROLE`: verify token not revoked, burn old token, mint new token to recipient preserving `parcelRef`, `spatialHash`, `titleMetadata`; emit `RegistryTransfer(newTokenId, from, to, block.timestamp)`
    - _Requirements: 3.4, 3.5_

  - [ ]* 2.3 Write Hardhat property and unit tests for `LandTitleNFT` (Properties 4–8)
    - **Property 4: NFT minting always produces unique token IDs**
    - **Validates: Requirements 3.1**
    - **Property 5: Every minted NFT contains all five required metadata fields**
    - **Validates: Requirements 3.2**
    - **Property 6: Direct owner-initiated transfers always revert**
    - **Validates: Requirements 3.4**
    - **Property 7: Only GOVERNOR_ROLE can revoke, and revocation is permanent**
    - **Validates: Requirements 4.1, 4.3, 4.5, 4.6, 10.7**
    - **Property 8: Every valid revocation emits a `TitleRevoked` event with complete fields**
    - **Validates: Requirements 4.2, 4.4**
    - Also cover: non-Governor revocation reverts; transfer of revoked token reverts; gas cost of `revoke()` is measured and logged
    - _Requirements: 3.1, 3.2, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [-] 2.4 Write Hardhat deploy scripts for `LandTitleNFT` and `LandRegistry`
    - `contracts/scripts/deploy.ts`: deploy `LandTitleNFT(registrarAddress, governorAddress)`, deploy `LandRegistry(nftAddress, registrarAddress)`, output deployed addresses to console and write to `contracts/deployments/besu_local.json`
    - _Requirements: 1.4, 3.1_

  - [~] 2.5 Implement `BlockchainService` and `BlockchainModule` in NestJS backend
    - Create `backend/src/blockchain/blockchain.service.ts` implementing `OnModuleInit` — initialise `ethers.JsonRpcProvider` from `BESU_RPC_URL` and `ethers.Wallet` from `REGISTRAR_PRIVATE_KEY`; load `LandTitleNFT` ABI from `contracts/artifacts/`
    - Implement `mintTitle(to, parcelRef, spatialHash, titleMetadata)` — send `mint()` tx, wait for receipt, parse `TitleMinted` event to extract `tokenId`, call `setMintTxHash` with receipt hash, return `{ tokenId: bigint, txHash: string }`
    - Implement `revokeTitle(tokenId, ground, governorSigner)` — connect governor wallet to contract, send `revoke()`, wait for receipt, return `txHash`
    - Implement `isRevoked(tokenId)` — read `isRevoked` mapping from contract
    - _Requirements: 3.1, 3.2, 4.3, 4.4_

  - [-] 2.6 Create Supabase `land_titles` and `applications` table migrations
    - Write `backend/src/database/migrations/003_applications.sql`:
      - `CREATE TABLE applications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), citizen_id UUID NOT NULL, owner_name TEXT NOT NULL, owner_wallet_address TEXT NOT NULL, document_number TEXT NOT NULL, document_type TEXT NOT NULL, issuing_authority TEXT NOT NULL, parcel_ref TEXT NOT NULL, spatial_hash TEXT, title_metadata_uri TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`
    - Write `backend/src/database/migrations/004_land_titles.sql`:
      - `CREATE TABLE land_titles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), application_id UUID NOT NULL REFERENCES applications(id), token_id TEXT NOT NULL UNIQUE, owner_id UUID NOT NULL, parcel_id UUID NOT NULL REFERENCES parcels(id), tx_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', issued_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ);`
    - Apply migrations to Supabase
    - _Requirements: 3.3, 4.7_

- [~] Step 2 Checkpoint — Ensure all six Hardhat test cases pass and gas cost of `revoke()` is measured before proceeding to Step 3.

---

### Step 3 — Community Verification Oracle and MQTT

- [ ] 3. Implement the Oracle service and MQTT communication layer
  - [~] 3.1 Implement `MqttService` and `MqttModule` in NestJS backend
    - Create `backend/src/mqtt/mqtt.service.ts` implementing `OnModuleInit`/`OnModuleDestroy`
    - Connect to `MQTT_BROKER_URL` via the `mqtt` npm package
    - Implement `publish(topic, payload, qos)` — serialize payload to JSON, publish with given QoS, record byte length by calling `logMqttEvent(topic, byteLen)`
    - Create `backend/src/database/migrations/005_mqtt_events.sql`: `CREATE TABLE mqtt_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), topic TEXT NOT NULL, payload_size INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`
    - Implement `logMqttEvent(topic, payloadBytes)` — insert one row into `mqtt_events`
    - Export `MQTT_TOPICS` constant map as defined in design (4 topics, correct QoS per topic)
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [~] 3.2 Implement `OracleService` and `OracleModule` in NestJS backend
    - Create `backend/src/oracle/oracle.service.ts` with documented match/conflict rules (Jaro-Winkler ≥ 0.85 + exact document number for MATCH; any required field absent for INCOMPLETE; `legalHold: true` for PENDING; name mismatch for CONFLICT)
    - Install `talisman` or `natural` npm package for Jaro-Winkler; import and apply `jaroWinkler(a, b)` in the match logic
    - Implement stub `InstitutionalSourceClient` and `CommunitySourceClient` interfaces with `fetchRecord(parcelRef)` methods — return typed mock data in tests; wire to real HTTP calls in integration
    - Implement `verify(claim: OwnershipClaim)` applying the four rules in priority order: INCOMPLETE → PENDING → CONFLICT → MATCH; always call `AuditService.record` and `MqttService.publish('land/verification/result', ...)` before returning
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 3.3 Write property tests for `OracleService` (Properties 9, 10)
    - **Property 9: Oracle outcome is deterministic with respect to documented match/conflict rules**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**
    - **Property 10: Oracle always records verification outcome in the audit trail and publishes MQTT**
    - **Validates: Requirements 5.7, 5.8**
    - Use `fast-check` to generate arbitrary `OwnershipClaim` and `InstitutionalRecord` objects; for each generated pair assert the deterministic rule applies and that exactly one audit entry and one MQTT publish are invoked

  - [ ]* 3.4 Write unit tests for `OracleService` covering all four outcomes
    - Test: missing `ownerName` → `IncompleteDocuments`
    - Test: `legalHold: true` on institutional record → `LegalVerificationPending`
    - Test: Jaro-Winkler < 0.85 → `OwnershipConflict`
    - Test: Jaro-Winkler ≥ 0.85 AND exact document number match → `SuccessfullyVerified`
    - Assert each test that `AuditService.record` and `MqttService.publish` are each called exactly once
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.7, 5.8_

  - [ ]* 3.5 Write property tests for `MqttService` (Properties 11, 14)
    - **Property 11: Every published MQTT message matches its defined topic schema**
    - **Validates: Requirements 6.1, 6.2**
    - **Property 14: Every MQTT event is logged in the system monitoring table**
    - **Validates: Requirements 6.6**
    - Use `fast-check` to generate arbitrary payloads for each of the four topics; assert QoS matches `MQTT_TOPICS` definition and that `mqtt_events` insert is called with correct `topic` and non-zero `payload_size`

  - [~] 3.6 Implement `RevocationService` and `RevocationModule` in NestJS backend
    - Create `backend/src/revocation/revocation.service.ts`
    - Implement `revoke(tokenId, ground, governorId, governorWallet)`:
      1. Call `BlockchainService.revokeTitle()` — on-chain first
      2. Update `land_titles` row: `status = 'revoked'`, `revoked_at = now()`
      3. Update `parcels` row: `status = 'reverted'`
      4. Call `AuditService.record` with action `STATUTORY_REVOCATION`
      5. Call `MqttService.publish('land/title/revoked', {...}, 2)`
      6. Call `NotificationService.notifyRevocation(tokenId, ground)`
    - Create stub `NotificationService` with `notifyRevocation` method
    - _Requirements: 4.7, 4.8, 4.9_

  - [~] 3.7 Implement offline queue in the React Native Expo mobile app
    - Create `frontend/mobile/store/offline-queue.ts` using `react-native-mmkv` for persistence
    - Implement `enqueue(payload)`, `dequeue()`, `remove(id)` functions using `MMKV` storage key `'offline_submissions'`
    - Implement `flushQueue(apiClient, onItemFlushed)` — iterate queue, submit each item, call `remove` on success, increment `retryCount` and mark `failed` after 5 retries
    - Implement `registerConnectivityListener(apiClient)` using `NetInfo.addEventListener` — call `flushQueue` when `state.isConnected && queue.length > 0`
    - _Requirements: 6.4, 6.5, 12.5_

  - [ ]* 3.8 Write property tests for offline queue (Properties 12, 13)
    - **Property 12: Offline queue preserves all submissions made without connectivity**
    - **Validates: Requirements 6.4, 12.5**
    - **Property 13: Offline queue is fully flushed upon connectivity restoration**
    - **Validates: Requirements 6.5**
    - Use `fast-check` to generate arbitrary arrays of payloads; mock MMKV storage; assert that after `enqueue` all items are retrievable by `dequeue`; assert that after `flushQueue` (with mock successful API client) the queue is empty and every item was submitted

- [~] Step 3 Checkpoint — Ensure Oracle and MQTT tests pass before proceeding to Step 4.

---

### Step 4 — Authentication, RBAC, and Integration Pipeline

- [ ] 4. Wire authentication, RBAC, and the end-to-end registration pipeline
  - [~] 4.1 Implement Supabase JWT authentication guard and RBAC system
    - Create `backend/src/database/migrations/006_user_roles.sql`:
      - `CREATE TABLE user_roles (user_id UUID PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('citizen','surveyor','registrar','land_admin','governor')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`
    - Create `backend/src/auth/supabase-auth.guard.ts` using `jose` `createRemoteJWKSet` and `jwtVerify` against `SUPABASE_JWKS_URL`; attach `{ id, role, email }` to `request.user`
    - Create `backend/src/auth/roles.ts` defining `UserRole` enum and `RBAC_MATRIX` as in design
    - Create `backend/src/auth/roles.guard.ts`: read `@Roles(...)` decorator; check `request.user.role` against `RBAC_MATRIX[operation]`; return 403 + audit entry on mismatch
    - Create `backend/src/auth/audit.interceptor.ts`: intercept every response; on 403, call `AuditService.record` with action `UNAUTHORISED_ACCESS`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [ ]* 4.2 Write property tests for RBAC guard (Property 15)
    - **Property 15: Role-based access control enforces the RBAC matrix for every operation**
    - **Validates: Requirements 7.3, 7.4, 7.5, 7.6, 7.7, 7.8**
    - Use `fast-check` to generate `(role, operation)` pairs; for each pair assert HTTP 2xx when role is in `RBAC_MATRIX[operation]` and HTTP 403 otherwise, across all five roles and all defined operations

  - [~] 4.3 Implement `RegistrationPipelineService` and orchestrate the end-to-end pipeline
    - Create `backend/src/pipeline/registration-pipeline.service.ts` with `run(applicationId)` method:
      - Stage 1: call `SpatialService.verifySpatial()`; halt on non-approved result
      - Stage 2: call `OracleService.verify()`; halt on non-SuccessfullyVerified result
      - Stage 3: update status to `in_review`; await Registrar action
    - Implement `completeAfterRegistrarApproval(applicationId, registrarId)`:
      - Audit Registrar approval
      - Stage 5: call `BlockchainService.mintTitle()`
      - Stage 6: insert row into `land_titles`
      - Stage 7: publish `land/title/issued` MQTT message (QoS 1)
      - Update application status to `completed`
    - Implement private `reject(applicationId, stage, reason)`: write audit entry, set status `rejected`, publish `land/registration/status` MQTT with `status: 'rejected'`
    - Implement private `updateStatus(applicationId, status)`: update Supabase and publish `land/registration/status` MQTT
    - _Requirements: 9.1, 9.2, 9.3_

  - [~] 4.4 Implement NestJS REST controllers for applications, approvals, and revocation
    - Create `backend/src/applications/applications.controller.ts`:
      - `POST /applications` — Citizen; create application row, enqueue pipeline run
      - `GET /applications` — Registrar, Land Admin
      - `GET /applications/:id` — Citizen (own), Registrar, Land Admin
      - `POST /applications/:id/approve` — Registrar; call `completeAfterRegistrarApproval()`
      - `POST /applications/:id/reject` — Registrar; call `reject()`
    - Create `backend/src/revocation/revocation.controller.ts`: `POST /titles/:tokenId/revoke` — Governor only; call `RevocationService.revoke()`
    - Create `backend/src/audit/audit.controller.ts`: `GET /audit/:entityId` — Registrar, Land Admin, Governor
    - Apply `SupabaseAuthGuard` and `RolesGuard` to all endpoints
    - _Requirements: 7.3, 7.4, 7.5, 7.6, 7.7, 7.9, 9.1, 9.2, 9.3_

  - [ ]* 4.5 Write property and integration tests for the pipeline (Properties 16–20)
    - **Property 16: Every audit trail entry contains all five required fields in correct format**
    - **Validates: Requirements 8.1, 8.3**
    - **Property 17: Audit trail entries are immutable — no update or delete ever succeeds**
    - **Validates: Requirements 8.2, 8.5**
    - **Property 18: Pipeline stage ordering is always preserved**
    - **Validates: Requirements 9.1**
    - **Property 19: Pipeline rejection at any stage triggers all four consequences**
    - **Validates: Requirements 9.2**
    - **Property 20: Successful pipeline completion always produces all three post-completion records**
    - **Validates: Requirements 9.3**
    - Use `fast-check` to generate `ApplicationRecord` inputs; mock all external dependencies; assert the property invariants hold across all generated inputs

  - [~] 4.6 Implement Registrar and Citizen views in the Next.js web portal
    - Create `frontend/web/app/(auth)/login/page.tsx` — Supabase Auth UI login page; redirect to role-appropriate dashboard after login
    - Create `frontend/web/app/citizen/page.tsx` — dashboard listing own applications with pipeline stage and status
    - Create `frontend/web/app/registrar/page.tsx` — queue of pending applications; each row shows spatial result, oracle result, and submitted documents; approve/reject buttons
    - Create `frontend/web/app/admin/page.tsx` — registry management: all applications, all issued titles, Audit Trail link
    - Create `frontend/web/app/governor/page.tsx` — statutory revocation form + Audit Trail only
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [~] 4.7 Implement authentication, role navigation, and real-time MQTT updates in the mobile app
    - Create `frontend/mobile/app/login.tsx` — Supabase Auth login screen; store session and role
    - Create `frontend/mobile/app/(citizen)/submit.tsx` — land registration submission form; if offline, call `enqueue()` and display queued indicator
    - Create `frontend/mobile/app/(citizen)/status.tsx` — subscribe to `land/registration/status` MQTT topic; display live pipeline stage
    - Create `frontend/mobile/app/(surveyor)/parcel.tsx` — coordinate capture form calling `POST /parcels/validate`
    - Call `registerConnectivityListener` in app root to auto-flush queue on reconnect
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [~] Step 4 Checkpoint — Ensure the end-to-end pipeline test passes and all RBAC, audit, and MQTT integration tests are green before proceeding to Step 5.

---

### Step 5 — Cross-Cutting Evaluation

- [ ] 5. Implement the cross-cutting evaluation framework
  - [~] 5.1 Implement `BaselineSimulatorService` in NestJS backend
    - Create `backend/src/baseline/baseline-simulator.service.ts` implementing `process(submission: BaselineSubmission): BaselineOutcome`
    - Check presence of `titleDeed`, `surveyPlan`, `identityDocument` only — no spatial check, no ownership check
    - Return `'accepted'` if all three documents are non-empty strings; otherwise `'rejected_missing_documents'`
    - _Requirements: 10.1_

  - [~] 5.2 Implement fraud scenario test runner
    - Create `backend/src/evaluation/fraud-scenarios.service.ts` with four methods:
      - `runScenario1(n: number)` — submit `n` applications with a doctored document (edited metadata, mismatched issuing authority); record detection count from proposed system and baseline
      - `runScenario2(n: number)` — submit `n` applications with coordinates overlapping a seeded registered parcel; record detection count from both systems
      - `runScenario3(n: number)` — submit `n` ownership claims where `institutionalRecord` returns a deliberately mismatched owner name; record detection count from both systems
      - `runScenario4(n: number)` — revoke a token, then attempt `n` transactions against it; record rejection count from both systems (baseline never detects this)
    - Each method runs at least 20 trials and returns `{ proposed: number, baseline: number, trials: number }`
    - _Requirements: 10.2, 10.7_

  - [~] 5.3 Implement processing latency instrumentation
    - Create `backend/src/evaluation/latency-instrumentation.service.ts`
    - Implement `timedRegistration(applicationData)` using `performance.now()` to time all five stages: `t_gis`, `t_oracle`, `t_contract`, `t_nft`, `t_sync`; return individual stage times and `T_total`
    - Implement `runLatencyBenchmark(n: number)` to execute `n` timed registrations and return mean ± standard deviation for each stage
    - Implement equivalent `runBaselineBenchmark(n: number)` for the baseline simulator
    - _Requirements: 10.3, 10.6_

  - [~] 5.4 Implement on-chain storage overhead measurement
    - Create `backend/src/evaluation/storage-analysis.service.ts`
    - Implement `measureOnChainFields(tokenId: bigint)` — call `getMetadata(tokenId)` on the deployed contract; measure actual bit lengths: `S_id` (uint256 = 256), `S_geom` (bytes32 = 256), `S_owner` (address = 160), `S_oracle` (IPFS CID string byte length × 8), `S_time` (uint256 = 256), `S_rev` (bool = 8), `S_sig` (bytes32 = 256); sum to `totalBits` and convert to bytes
    - Implement `computeBaselineStoragePerRecord()` — simulate a naive design that stores full WKT geometry on-chain; estimate geometry string byte size as average of 10 representative WKT strings × 8; return bytes
    - Implement `computeReductionPercentage(proposed: number, baseline: number)` — return `((baseline - proposed) / baseline) * 100`
    - _Requirements: 10.4, 10.5_

  - [ ]* 5.5 Write unit tests for evaluation services
    - Test `BaselineSimulatorService.process()`: all three docs present → `accepted`; one doc missing → `rejected_missing_documents`
    - Test `StorageAnalysisService.computeReductionPercentage()`: assert result is between 0 and 100 and matches formula
    - Test `LatencyInstrumentationService.runLatencyBenchmark()`: assert mock returns mean and SD for each of the five stage keys
    - _Requirements: 10.1, 10.3, 10.4, 10.5_

  - [~] 5.6 Wire evaluation endpoints and produce result tables
    - Create `backend/src/evaluation/evaluation.controller.ts` with endpoints (Land Admin only):
      - `POST /evaluation/fraud/:scenario` — run fraud scenario, return detection rates
      - `POST /evaluation/latency` — run 30+ timed registrations, return mean ± SD table
      - `GET /evaluation/storage` — return on-chain field sizes, per-record byte total, and reduction vs baseline
    - The response JSON for each endpoint SHALL match the table format defined in Section 13 of PROJECT.md
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [~] Final Checkpoint — Ensure all four fraud scenario tables, latency table, and storage table are populated with real measured data. Ensure all tests pass.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build
- All TypeScript files must use `strict: true` compiler settings
- Directory layout: `backend/` (NestJS), `frontend/web/` (Next.js), `frontend/mobile/` (Expo), `contracts/` (Hardhat) — no `apps/` prefix
- The build order is a hard gate: do not begin Step N+1 until Step N's checkpoint tests pass
- Property tests use `fast-check` on the backend and contracts
- Supabase credentials come from `.env` only — never hardcode in source
- Each checkpoint task is the validation gate for its step

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["0.1"] },
    { "id": 1, "tasks": ["0.2", "0.3", "0.4", "0.5", "0.6", "0.7"] },
    { "id": 2, "tasks": ["0.8"] },
    { "id": 3, "tasks": ["1.1", "1.3"] },
    { "id": 4, "tasks": ["1.2"] },
    { "id": 5, "tasks": ["1.4", "1.5", "1.6"] },
    { "id": 6, "tasks": ["2.1", "2.4", "2.6"] },
    { "id": 7, "tasks": ["2.2", "2.5"] },
    { "id": 8, "tasks": ["2.3"] },
    { "id": 9, "tasks": ["3.1", "3.7"] },
    { "id": 10, "tasks": ["3.2", "3.6"] },
    { "id": 11, "tasks": ["3.3", "3.4", "3.5", "3.8"] },
    { "id": 12, "tasks": ["4.1"] },
    { "id": 13, "tasks": ["4.3", "4.2"] },
    { "id": 14, "tasks": ["4.4"] },
    { "id": 15, "tasks": ["4.5", "4.6", "4.7"] },
    { "id": 16, "tasks": ["5.1"] },
    { "id": 17, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 18, "tasks": ["5.5"] },
    { "id": 19, "tasks": ["5.6"] }
  ]
}
```
