# Design Document — Anagu Land Administration Framework

## Overview

Anagu is a permissioned, full-stack land title administration system for Nigeria. It combines
GIS-based spatial validation, Hyperledger Besu QBFT blockchain recording, ERC-721 NFT land
titles, a community ownership verification oracle, and MQTT real-time event broadcasting into
a single integrated pipeline.

The system enforces the Nigerian Land Use Act (1978) Section 28 for statutory revocation and
applies role-based access control across every workflow stage.

**Language:** TypeScript throughout all three application tiers. Solidity for smart contracts.

**Infrastructure:** Docker Compose (Besu, Redis, EMQX) + Supabase (managed PostgreSQL +
PostGIS + Storage + Auth).

---

## Architecture

### High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENT TIER                                  │
│                                                                        │
│  ┌─────────────────────┐        ┌──────────────────────────────────┐  │
│  │  Next.js Web Portal │        │   React Native Expo Mobile App   │  │
│  │  (frontend/web/)    │        │   (frontend/mobile/)             │  │
│  │  TypeScript         │        │   TypeScript                     │  │
│  └──────────┬──────────┘        └──────────────┬───────────────────┘  │
└─────────────┼─────────────────────────────────┼──────────────────────┘
              │ HTTPS REST / HTTPS WS            │ HTTPS REST / MQTT WS
              ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          API / BACKEND TIER (NestJS)                  │
│  apps/backend/ — TypeScript                                           │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │  Auth Guard  │  │  RBAC Guard  │  │  Audit       │                │
│  │  (Supabase   │  │  (5 roles)   │  │  Interceptor │                │
│  │   JWT JWKS)  │  │              │  │              │                │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                │
│         └─────────────────┴─────────────────┘                        │
│                            │                                          │
│  ┌─────────────────────────▼─────────────────────────────────────┐   │
│  │                   Pipeline Orchestrator                        │   │
│  │  (RegistrationPipelineService)                                 │   │
│  └────┬──────────┬──────────┬──────────┬──────────┬──────────────┘   │
│       │          │          │          │          │                   │
│       ▼          ▼          ▼          ▼          ▼                   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
│  │Spatial │ │Oracle  │ │Blockchain│ │  NFT   │ │  MQTT  │             │
│  │Verifier│ │Service │ │Service │ │Service │ │Service │             │
│  └────┬───┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘             │
└───────┼─────────┼──────────┼──────────┼──────────┼───────────────────┘
        │         │          │          │          │
        ▼         ▼          ▼          ▼          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      DATA / INFRASTRUCTURE TIER                       │
│                                                                        │
│  ┌────────────────────┐  ┌────────────────┐  ┌─────────────────────┐ │
│  │  Supabase          │  │  Hyperledger   │  │  EMQX MQTT Broker   │ │
│  │  PostgreSQL+PostGIS│  │  Besu QBFT     │  │  Docker :1883/8083  │ │
│  │  + Auth + Storage  │  │  Docker :8545  │  │                     │ │
│  └────────────────────┘  └────────────────┘  └─────────────────────┘ │
│                                                                        │
│  ┌────────────────────┐                                               │
│  │  Redis             │                                               │
│  │  Docker :6379      │                                               │
│  └────────────────────┘                                               │
└──────────────────────────────────────────────────────────────────────┘
```

### Monorepo Directory Structure

```
anagu/
├── apps/
│   ├── backend/               # NestJS TypeScript API
│   │   ├── src/
│   │   │   ├── auth/          # Supabase JWT guard, RBAC guard
│   │   │   ├── spatial/       # GIS spatial verification module
│   │   │   ├── oracle/        # Ownership verification oracle module
│   │   │   ├── blockchain/    # Besu ethers.js integration
│   │   │   ├── nft/           # NFT issuance service
│   │   │   ├── mqtt/          # MQTT publisher / subscriber
│   │   │   ├── audit/         # Immutable audit trail module
│   │   │   ├── pipeline/      # Registration pipeline orchestrator
│   │   │   ├── revocation/    # Statutory revocation module
│   │   │   └── baseline/      # Conventional baseline simulator
│   │   └── test/
│   ├── web/                   # Next.js TypeScript web portal
│   │   ├── app/               # App Router pages
│   │   └── components/
│   └── mobile/                # React Native Expo TypeScript
│       ├── app/               # Expo Router screens
│       ├── hooks/
│       └── store/             # Offline queue (MMKV)
├── contracts/                 # Solidity + Hardhat
│   ├── contracts/
│   │   ├── LandTitleNFT.sol
│   │   └── LandRegistry.sol
│   ├── scripts/
│   └── test/
├── infra/
│   └── besu/
│       ├── genesis.json
│       └── config.toml
└── docker-compose.yml
```

---

## Components

### Component 1 — Authentication and RBAC

#### Supabase JWT Authentication Guard

The NestJS backend validates every incoming request against a Supabase-issued JWT. The JWKS
endpoint (`https://qtpieoxlmexisypbifoi.supabase.co/auth/v1/.well-known/jwks.json`) provides
public keys for signature verification without any symmetric secret.

```typescript
// apps/backend/src/auth/supabase-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createRemoteJWKSet, jwtVerify } from 'jose';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly jwks = createRemoteJWKSet(
    new URL(process.env.SUPABASE_JWKS_URL!),
  );

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractBearer(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    const { payload } = await jwtVerify(token, this.jwks);
    request.user = {
      id: payload.sub,
      role: (payload as Record<string, unknown>)['user_role'] as UserRole,
      email: payload.email as string,
    };
    return true;
  }

  private extractBearer(header?: string): string | null {
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7);
  }
}
```

#### Role Definitions and RBAC Guard

```typescript
// apps/backend/src/auth/roles.ts
export enum UserRole {
  CITIZEN          = 'citizen',
  SURVEYOR         = 'surveyor',
  REGISTRAR        = 'registrar',
  LAND_ADMIN       = 'land_admin',
  GOVERNOR         = 'governor',
}

// RBAC matrix — maps operation keys to allowed roles
export const RBAC_MATRIX: Record<string, UserRole[]> = {
  'application:submit':          [UserRole.CITIZEN],
  'application:view:own':        [UserRole.CITIZEN],
  'application:view:all':        [UserRole.REGISTRAR, UserRole.LAND_ADMIN],
  'parcel:coordinates:submit':   [UserRole.SURVEYOR],
  'parcel:geometry:validate':    [UserRole.SURVEYOR],
  'application:approve':         [UserRole.REGISTRAR],
  'application:reject':          [UserRole.REGISTRAR],
  'blockchain:register':         [UserRole.REGISTRAR],
  'nft:issue':                   [UserRole.REGISTRAR],
  'registry:manage':             [UserRole.LAND_ADMIN],
  'audit:view':                  [UserRole.REGISTRAR, UserRole.LAND_ADMIN, UserRole.GOVERNOR],
  'revocation:invoke':           [UserRole.GOVERNOR],
};
```

The `RolesGuard` reads the `@Roles(...)` decorator metadata, checks the authenticated user's
role against the matrix, returns HTTP 403 and writes an audit entry on any mismatch.

---

### Component 2 — Spatial Verification (GIS)

The `SpatialModule` exposes a single `verifySpatial(dto: SpatialVerificationDto)` service
method that drives the full two-stage GIS check via Supabase PostGIS RPC calls.

#### Data Transfer Objects

```typescript
// apps/backend/src/spatial/dto/spatial-verification.dto.ts
export interface CoordinateRing {
  coordinates: [number, number][]; // [longitude, latitude] in WGS 84
}

export interface SpatialVerificationDto {
  applicationId: string;
  parcelRing: CoordinateRing;
}

export type SpatialOutcome = 'approved' | 'rejected_invalid_geometry' | 'rejected_overlap';

export interface SpatialVerificationResult {
  outcome: SpatialOutcome;
  diagnosticCode?: 'GEOM_INVALID' | 'PARCEL_OVERLAP';
  conflictingParcelId?: string;
  bufferMetres: 0.5;
  checkedAt: string; // ISO 8601
}
```

#### Service Implementation

```typescript
// apps/backend/src/spatial/spatial.service.ts
@Injectable()
export class SpatialService {
  readonly OVERLAP_BUFFER_METRES = 0.5 as const;

  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly auditService: AuditService,
  ) {}

  async verifySpatial(dto: SpatialVerificationDto): Promise<SpatialVerificationResult> {
    const wkt = this.ringToWKT(dto.parcelRing);

    // Stage 1 — geometry validity
    const { data: validRow } = await this.supabase.rpc('check_geometry_valid', { wkt });
    if (!validRow?.is_valid) {
      const result: SpatialVerificationResult = {
        outcome: 'rejected_invalid_geometry',
        diagnosticCode: 'GEOM_INVALID',
        bufferMetres: 0.5,
        checkedAt: new Date().toISOString(),
      };
      await this.auditService.record({
        entityId: dto.applicationId,
        action: 'SPATIAL_VERIFICATION',
        outcome: 'REJECTED_INVALID_GEOMETRY',
      });
      return result;
    }

    // Stage 2 — overlap detection with 0.5 m buffer
    const { data: overlapRow } = await this.supabase.rpc('check_parcel_overlap', {
      wkt,
      buffer_metres: this.OVERLAP_BUFFER_METRES,
      exclude_application_id: dto.applicationId,
    });
    if (overlapRow?.overlaps) {
      const result: SpatialVerificationResult = {
        outcome: 'rejected_overlap',
        diagnosticCode: 'PARCEL_OVERLAP',
        conflictingParcelId: overlapRow.conflicting_parcel_id,
        bufferMetres: 0.5,
        checkedAt: new Date().toISOString(),
      };
      await this.auditService.record({
        entityId: dto.applicationId,
        action: 'SPATIAL_VERIFICATION',
        outcome: 'REJECTED_OVERLAP',
        metadata: { conflictingParcelId: overlapRow.conflicting_parcel_id },
      });
      return result;
    }

    const result: SpatialVerificationResult = {
      outcome: 'approved',
      bufferMetres: 0.5,
      checkedAt: new Date().toISOString(),
    };
    await this.auditService.record({
      entityId: dto.applicationId,
      action: 'SPATIAL_VERIFICATION',
      outcome: 'APPROVED',
    });
    return result;
  }

  private ringToWKT(ring: CoordinateRing): string {
    const coords = ring.coordinates
      .map(([lng, lat]) => `${lng} ${lat}`)
      .join(', ');
    return `SRID=4326;POLYGON((${coords}))`;
  }
}
```

#### Supabase PostGIS SQL Functions

```sql
-- check_geometry_valid(wkt text) → { is_valid: boolean }
CREATE OR REPLACE FUNCTION check_geometry_valid(wkt text)
RETURNS json AS $$
  SELECT json_build_object('is_valid', ST_IsValid(ST_GeomFromEWKT(wkt)));
$$ LANGUAGE sql SECURITY DEFINER;

-- check_parcel_overlap(wkt text, buffer_metres float, exclude_application_id uuid)
-- → { overlaps: boolean, conflicting_parcel_id: uuid | null }
CREATE OR REPLACE FUNCTION check_parcel_overlap(
  wkt text, buffer_metres float, exclude_application_id uuid
) RETURNS json AS $$
  SELECT json_build_object(
    'overlaps', COUNT(*) > 0,
    'conflicting_parcel_id', MIN(p.id)::text
  )
  FROM parcels p
  WHERE ST_Intersects(ST_Buffer(ST_GeomFromEWKT(wkt)::geography, buffer_metres)::geometry, p.geom)
    AND p.application_id != exclude_application_id
    AND p.status = 'registered';
$$ LANGUAGE sql SECURITY DEFINER;
```

---

### Component 3 — Blockchain and NFT (Hardhat + Hyperledger Besu)

#### Smart Contracts

**LandTitleNFT.sol** — extends ERC-721 and OpenZeppelin AccessControl. Implements minting with
all five required metadata fields, disables direct peer-to-peer transfers, and implements
statutory revocation under the Land Use Act.

```solidity
// contracts/contracts/LandTitleNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract LandTitleNFT is ERC721, AccessControl {
    using Counters for Counters.Counter;

    bytes32 public constant GOVERNOR_ROLE   = keccak256("GOVERNOR_ROLE");
    bytes32 public constant REGISTRAR_ROLE  = keccak256("REGISTRAR_ROLE");

    Counters.Counter private _tokenIds;

    enum RevocationGround {
        OverridingPublicInterest,       // 0
        BreachOfStatutoryCondition      // 1
    }

    struct TitleMetadata {
        string  parcelRef;          // off-chain parcel identifier
        bytes32 mintTxHash;         // hash of minting transaction
        bytes32 spatialHash;        // keccak256 of WKT geometry string
        string  titleMetadata;      // IPFS CID or JSON URI
    }

    mapping(uint256 => bool)          public  isRevoked;
    mapping(uint256 => TitleMetadata) private _metadata;

    event TitleMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string  parcelRef,
        uint256 timestamp
    );

    event TitleRevoked(
        uint256 indexed tokenId,
        RevocationGround ground,
        address indexed revokedBy,
        uint256 timestamp
    );

    constructor(address registrarAddress, address governorAddress)
        ERC721("AnaguLandTitle", "ALT")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE,    registrarAddress);
        _grantRole(GOVERNOR_ROLE,     governorAddress);
    }

    function mint(
        address         to,
        string calldata parcelRef,
        bytes32         spatialHash,
        string calldata titleMetadata
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256) {
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        _safeMint(to, tokenId);
        _metadata[tokenId] = TitleMetadata({
            parcelRef:     parcelRef,
            mintTxHash:    bytes32(0),       // set post-mine via setMintTxHash()
            spatialHash:   spatialHash,
            titleMetadata: titleMetadata
        });
        emit TitleMinted(tokenId, to, parcelRef, block.timestamp);
        return tokenId;
    }

    function setMintTxHash(uint256 tokenId, bytes32 txHash)
        external onlyRole(REGISTRAR_ROLE)
    {
        require(_exists(tokenId), "LandTitleNFT: token does not exist");
        _metadata[tokenId].mintTxHash = txHash;
    }

    function revoke(uint256 tokenId, RevocationGround ground)
        external onlyRole(GOVERNOR_ROLE)
    {
        require(_exists(tokenId),      "LandTitleNFT: token does not exist");
        require(!isRevoked[tokenId],   "LandTitleNFT: already revoked");
        isRevoked[tokenId] = true;
        emit TitleRevoked(tokenId, ground, msg.sender, block.timestamp);
    }

    function getMetadata(uint256 tokenId)
        external view returns (TitleMetadata memory)
    {
        require(_exists(tokenId), "LandTitleNFT: token does not exist");
        return _metadata[tokenId];
    }

    // Disable all owner-initiated transfers
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        // Allow minting (from == address(0)); block all other transfers
        if (from != address(0)) {
            revert("LandTitleNFT: direct transfers are disabled");
        }
        // Block any transfer of a revoked token
        require(!isRevoked[tokenId], "LandTitleNFT: token is revoked");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

**LandRegistry.sol** — manages the registry-controlled ownership transfer pathway.

```solidity
// contracts/contracts/LandRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./LandTitleNFT.sol";

contract LandRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    LandTitleNFT public immutable titleNFT;

    event RegistryTransfer(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );

    constructor(address landTitleNFTAddress, address registrarAddress) {
        titleNFT = LandTitleNFT(landTitleNFTAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, registrarAddress);
    }

    // Registry-controlled transfer — the only legitimate way to change ownership
    function registryTransfer(
        uint256 tokenId,
        address from,
        address to
    ) external onlyRole(REGISTRAR_ROLE) {
        require(!titleNFT.isRevoked(tokenId), "LandRegistry: token is revoked");
        // LandTitleNFT._beforeTokenTransfer blocks direct transfers,
        // but the registry mints a new token to the recipient and burns the old one.
        // This pattern is used because LandTitleNFT disables _all_ transfers from != 0x0.
        titleNFT.burn(tokenId);
        uint256 newTokenId = titleNFT.mint(
            to,
            titleNFT.getMetadata(tokenId).parcelRef,
            titleNFT.getMetadata(tokenId).spatialHash,
            titleNFT.getMetadata(tokenId).titleMetadata
        );
        emit RegistryTransfer(newTokenId, from, to, block.timestamp);
    }
}
```

#### Blockchain NestJS Service

```typescript
// apps/backend/src/blockchain/blockchain.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import * as LandTitleNFTArtifact from '../../contracts/artifacts/LandTitleNFT.json';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private provider!: ethers.JsonRpcProvider;
  private signer!: ethers.Wallet;
  private landTitleNFT!: ethers.Contract;

  async onModuleInit(): Promise<void> {
    this.provider = new ethers.JsonRpcProvider(process.env.BESU_RPC_URL!);
    this.signer   = new ethers.Wallet(process.env.REGISTRAR_PRIVATE_KEY!, this.provider);
    this.landTitleNFT = new ethers.Contract(
      process.env.LAND_TITLE_NFT_ADDRESS!,
      LandTitleNFTArtifact.abi,
      this.signer,
    );
  }

  async mintTitle(
    to: string,
    parcelRef: string,
    spatialHash: string,
    titleMetadata: string,
  ): Promise<{ tokenId: bigint; txHash: string }> {
    const tx    = await this.landTitleNFT.mint(to, parcelRef, spatialHash, titleMetadata);
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((log: ethers.Log) => {
        try { return this.landTitleNFT.interface.parseLog(log); } catch { return null; }
      })
      .find((e: ethers.LogDescription | null) => e?.name === 'TitleMinted');
    const tokenId: bigint = event!.args.tokenId;
    return { tokenId, txHash: receipt.hash };
  }

  async revokeTitle(
    tokenId: bigint,
    ground: 0 | 1,
    governorSigner: ethers.Wallet,
  ): Promise<string> {
    const contract = this.landTitleNFT.connect(governorSigner) as ethers.Contract;
    const tx = await contract.revoke(tokenId, ground);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async isRevoked(tokenId: bigint): Promise<boolean> {
    return this.landTitleNFT.isRevoked(tokenId);
  }
}
```

---

### Component 4 — Community Verification Oracle

The oracle implements a NestJS service with documented, deterministic match/conflict rules.

#### Match and Conflict Rules (Documented)

| Rule | Condition | Outcome |
|---|---|---|
| **MATCH** | Submitted owner name fuzzy-matches (≥ 85% Jaro-Winkler) AND submitted title document number exactly matches a retrieved institutional record | `SuccessfullyVerified` |
| **CONFLICT** | Any retrieved institutional record contains a different active owner for the same parcel reference | `OwnershipConflict` |
| **INCOMPLETE** | Submitted claim is missing one or more required document fields (ownerName, documentNumber, documentType, issuingAuthority) | `IncompleteDocuments` |
| **PENDING** | The retrieved institutional record is flagged `legalHold: true` | `LegalVerificationPending` |

```typescript
// apps/backend/src/oracle/oracle.service.ts
export type VerificationOutcome =
  | 'SuccessfullyVerified'
  | 'OwnershipConflict'
  | 'IncompleteDocuments'
  | 'LegalVerificationPending';

export interface OwnershipClaim {
  applicationId:  string;
  parcelRef:      string;
  ownerName:      string;
  documentNumber: string;
  documentType:   string;
  issuingAuthority: string;
}

export interface VerificationResult {
  applicationId: string;
  outcome:       VerificationOutcome;
  verifiedAt:    string; // ISO 8601
}

@Injectable()
export class OracleService {
  private readonly MATCH_THRESHOLD = 0.85;

  constructor(
    private readonly institutionalSource: InstitutionalSourceClient,
    private readonly communitySource:     CommunitySourceClient,
    private readonly auditService:        AuditService,
    private readonly mqttService:         MqttService,
  ) {}

  async verify(claim: OwnershipClaim): Promise<VerificationResult> {
    // Rule: INCOMPLETE — check required fields first
    const requiredFields: (keyof OwnershipClaim)[] = [
      'ownerName', 'documentNumber', 'documentType', 'issuingAuthority',
    ];
    const missingFields = requiredFields.filter(f => !claim[f]?.trim());
    if (missingFields.length > 0) {
      return this.emit(claim.applicationId, 'IncompleteDocuments');
    }

    // Retrieve records from both sources
    const [institutionalRecord, communityRecord] = await Promise.all([
      this.institutionalSource.fetchRecord(claim.parcelRef),
      this.communitySource.fetchRecord(claim.parcelRef),
    ]);

    // Rule: PENDING — legal hold
    if (institutionalRecord?.legalHold) {
      return this.emit(claim.applicationId, 'LegalVerificationPending');
    }

    // Rule: CONFLICT — different active owner
    const institutionalOwner = institutionalRecord?.activeOwnerName ?? '';
    if (
      institutionalOwner &&
      jaroWinkler(claim.ownerName, institutionalOwner) < this.MATCH_THRESHOLD
    ) {
      return this.emit(claim.applicationId, 'OwnershipConflict');
    }

    // Rule: MATCH — document number exact match + name fuzzy match
    const docMatch =
      institutionalRecord?.documentNumber === claim.documentNumber &&
      jaroWinkler(claim.ownerName, institutionalOwner) >= this.MATCH_THRESHOLD;

    if (docMatch) {
      return this.emit(claim.applicationId, 'SuccessfullyVerified');
    }

    return this.emit(claim.applicationId, 'OwnershipConflict');
  }

  private async emit(
    applicationId: string,
    outcome: VerificationOutcome,
  ): Promise<VerificationResult> {
    const verifiedAt = new Date().toISOString();
    await this.auditService.record({ entityId: applicationId, action: 'ORACLE_VERIFICATION', outcome });
    await this.mqttService.publish('land/verification/result', { applicationId, outcome, timestamp: verifiedAt }, 1);
    return { applicationId, outcome, verifiedAt };
  }
}
```

---

### Component 5 — MQTT Service

```typescript
// apps/backend/src/mqtt/mqtt.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { connect, MqttClient } from 'mqtt';

export type QoS = 0 | 1 | 2;

export interface MqttTopicSchema {
  topic:   string;
  qos:     QoS;
  fields:  string[];
}

export const MQTT_TOPICS: Record<string, MqttTopicSchema> = {
  REGISTRATION_STATUS: { topic: 'land/registration/status', qos: 1, fields: ['applicationId', 'status', 'timestamp'] },
  TITLE_ISSUED:        { topic: 'land/title/issued',        qos: 1, fields: ['tokenId', 'owner', 'parcelId', 'timestamp'] },
  TITLE_REVOKED:       { topic: 'land/title/revoked',       qos: 2, fields: ['tokenId', 'ground', 'revokedBy', 'timestamp'] },
  VERIFICATION_RESULT: { topic: 'land/verification/result', qos: 1, fields: ['applicationId', 'outcome', 'timestamp'] },
};

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client!: MqttClient;

  async onModuleInit(): Promise<void> {
    this.client = connect(process.env.MQTT_BROKER_URL!);
    await new Promise<void>((resolve, reject) => {
      this.client.once('connect', resolve);
      this.client.once('error',   reject);
    });
  }

  async publish(topic: string, payload: Record<string, unknown>, qos: QoS): Promise<void> {
    const json    = JSON.stringify({ ...payload });
    const byteLen = Buffer.byteLength(json, 'utf8');
    await new Promise<void>((resolve, reject) => {
      this.client.publish(topic, json, { qos }, (err) => (err ? reject(err) : resolve()));
    });
    // Monitoring log entry
    await this.logMqttEvent(topic, byteLen);
  }

  private async logMqttEvent(topic: string, payloadBytes: number): Promise<void> {
    // Written to system monitoring table in Supabase
  }

  async onModuleDestroy(): Promise<void> {
    this.client.end();
  }
}
```

---

### Component 6 — Audit Service

```typescript
// apps/backend/src/audit/audit.service.ts
import { Injectable } from '@nestjs/common';
import { SupabaseClientService } from '../supabase/supabase-client.service';

export interface AuditEntry {
  entityId:   string;  // applicationId or tokenId
  actorId?:   string;  // authenticated user UUID
  action:     string;  // e.g. 'SPATIAL_VERIFICATION'
  outcome:    string;  // e.g. 'APPROVED'
  metadata?:  Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async record(entry: AuditEntry): Promise<void> {
    const row = {
      entity_id:  entry.entityId,
      actor_id:   entry.actorId ?? null,
      action:     entry.action,
      outcome:    entry.outcome,
      metadata:   entry.metadata ?? {},
      created_at: new Date().toISOString(),
    };
    const { error } = await this.supabase
      .from('audit_trail')
      .insert(row);
    if (error) {
      throw new Error(`Audit write failed: ${error.message}`);
    }
    // No update or delete is ever called on audit_trail
  }

  async getTrail(entityId: string): Promise<AuditEntry[]> {
    const { data, error } = await this.supabase
      .from('audit_trail')
      .select('*')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Audit read failed: ${error.message}`);
    return data ?? [];
  }
}
```

The `audit_trail` table is created in Supabase with Row Level Security (RLS) configured so
that `UPDATE` and `DELETE` operations are denied by policy for all roles. The `INSERT` policy
is restricted to service-role key only.

---

### Component 7 — Registration Pipeline Orchestrator

```typescript
// apps/backend/src/pipeline/registration-pipeline.service.ts
export type PipelineStage =
  | 'SPATIAL_VERIFICATION'
  | 'ORACLE_VERIFICATION'
  | 'LEGAL_VERIFICATION'
  | 'REGISTRAR_APPROVAL'
  | 'BLOCKCHAIN_REGISTRATION'
  | 'NFT_ISSUANCE'
  | 'MQTT_NOTIFICATION';

export type ApplicationStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'completed';

@Injectable()
export class RegistrationPipelineService {
  constructor(
    private readonly spatial:     SpatialService,
    private readonly oracle:      OracleService,
    private readonly blockchain:  BlockchainService,
    private readonly mqtt:        MqttService,
    private readonly audit:       AuditService,
    private readonly supabase:    SupabaseClientService,
  ) {}

  async run(applicationId: string): Promise<void> {
    const app = await this.loadApplication(applicationId);

    // Stage 1 — Spatial verification
    const spatialResult = await this.spatial.verifySpatial({
      applicationId,
      parcelRing: app.parcelRing,
    });
    if (spatialResult.outcome !== 'approved') {
      await this.reject(applicationId, 'SPATIAL_VERIFICATION', spatialResult.diagnosticCode!);
      return;
    }

    // Stage 2 — Oracle ownership verification
    const oracleResult = await this.oracle.verify({
      applicationId,
      parcelRef:       app.parcelRef,
      ownerName:       app.ownerName,
      documentNumber:  app.documentNumber,
      documentType:    app.documentType,
      issuingAuthority: app.issuingAuthority,
    });
    if (oracleResult.outcome !== 'SuccessfullyVerified') {
      await this.reject(applicationId, 'ORACLE_VERIFICATION', oracleResult.outcome);
      return;
    }

    // Stage 3 — Legal verification (async hold; pipeline pauses until resolved externally)
    await this.updateStatus(applicationId, 'in_review');

    // Stages 4–7 are triggered by the Registrar approval action (separate endpoint)
  }

  async completeAfterRegistrarApproval(applicationId: string, registrarId: string): Promise<void> {
    const app = await this.loadApplication(applicationId);

    await this.audit.record({
      entityId: applicationId,
      actorId:  registrarId,
      action:   'REGISTRAR_APPROVAL',
      outcome:  'APPROVED',
    });

    // Stage 5 — Blockchain registration
    const { tokenId, txHash } = await this.blockchain.mintTitle(
      app.ownerWalletAddress,
      app.parcelRef,
      app.spatialHash,
      app.titleMetadataUri,
    );

    // Stage 6 — NFT issuance record in Supabase
    await this.supabase.from('land_titles').insert({
      application_id: applicationId,
      token_id:       tokenId.toString(),
      owner_id:       app.ownerId,
      parcel_id:      app.parcelId,
      tx_hash:        txHash,
      issued_at:      new Date().toISOString(),
    });

    // Stage 7 — MQTT notification
    await this.mqtt.publish('land/title/issued', {
      tokenId:   tokenId.toString(),
      owner:     app.ownerWalletAddress,
      parcelId:  app.parcelId,
      timestamp: new Date().toISOString(),
    }, 1);

    await this.updateStatus(applicationId, 'completed');
  }

  private async reject(
    applicationId: string,
    stage: PipelineStage,
    reason: string,
  ): Promise<void> {
    await this.audit.record({ entityId: applicationId, action: stage, outcome: 'REJECTED', metadata: { reason } });
    await this.updateStatus(applicationId, 'rejected');
    // TODO: notify applicant via notification service
  }

  private async updateStatus(applicationId: string, status: ApplicationStatus): Promise<void> {
    await this.supabase.from('applications').update({ status }).eq('id', applicationId);
    await this.mqtt.publish('land/registration/status', {
      applicationId,
      status,
      timestamp: new Date().toISOString(),
    }, 1);
  }

  private async loadApplication(applicationId: string): Promise<ApplicationRecord> {
    const { data, error } = await this.supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single();
    if (error || !data) throw new Error(`Application not found: ${applicationId}`);
    return data as ApplicationRecord;
  }
}
```

---

### Component 8 — Statutory Revocation Service (Backend)

```typescript
// apps/backend/src/revocation/revocation.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { ethers } from 'ethers';

export type RevocationGround = 'OverridingPublicInterest' | 'BreachOfStatutoryCondition';

@Injectable()
export class RevocationService {
  constructor(
    private readonly blockchain:  BlockchainService,
    private readonly supabase:    SupabaseClientService,
    private readonly mqtt:        MqttService,
    private readonly audit:       AuditService,
    private readonly notifier:    NotificationService,
  ) {}

  async revoke(
    tokenId: string,
    ground: RevocationGround,
    governorId: string,
    governorWallet: ethers.Wallet,
  ): Promise<void> {
    const groundIndex = ground === 'OverridingPublicInterest' ? 0 : 1;

    // Execute on-chain revocation — emits TitleRevoked event as distinct immutable record
    const txHash = await this.blockchain.revokeTitle(BigInt(tokenId), groundIndex, governorWallet);

    // Update Supabase and GIS layer
    await this.supabase.from('land_titles').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('token_id', tokenId);
    await this.supabase.from('parcels').update({ status: 'reverted' }).eq('token_id', tokenId);

    // Record audit entry
    await this.audit.record({
      entityId: tokenId,
      actorId:  governorId,
      action:   'STATUTORY_REVOCATION',
      outcome:  'REVOKED',
      metadata: { ground, txHash },
    });

    // Publish MQTT at QoS 2
    await this.mqtt.publish('land/title/revoked', {
      tokenId,
      ground,
      revokedBy: governorId,
      timestamp: new Date().toISOString(),
    }, 2);

    // Notify titleholder and registry office
    await this.notifier.notifyRevocation(tokenId, ground);
  }
}
```

---

### Component 9 — Offline Queue (Mobile App)

The mobile app uses MMKV for synchronous key-value persistence of the offline queue,
and the `@react-native-community/netinfo` library to detect connectivity state.

```typescript
// apps/mobile/src/store/offline-queue.ts
import { MMKV } from 'react-native-mmkv';
import NetInfo from '@react-native-community/netinfo';

const storage = new MMKV({ id: 'anagu-offline-queue' });
const QUEUE_KEY = 'offline_submissions';

export interface QueuedSubmission {
  id:          string;  // uuid
  payload:     Record<string, unknown>;
  queuedAt:    string;  // ISO 8601
  retryCount:  number;
}

export function enqueue(payload: Record<string, unknown>): void {
  const queue = dequeue();
  const entry: QueuedSubmission = {
    id:        crypto.randomUUID(),
    payload,
    queuedAt:  new Date().toISOString(),
    retryCount: 0,
  };
  storage.set(QUEUE_KEY, JSON.stringify([...queue, entry]));
}

export function dequeue(): QueuedSubmission[] {
  const raw = storage.getString(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as QueuedSubmission[]) : [];
}

export function remove(id: string): void {
  const updated = dequeue().filter(item => item.id !== id);
  storage.set(QUEUE_KEY, JSON.stringify(updated));
}

// Flush all queued submissions to the backend when connectivity is restored
export async function flushQueue(
  apiClient: AnaguApiClient,
  onItemFlushed: (id: string) => void,
): Promise<void> {
  const queue = dequeue();
  for (const item of queue) {
    await apiClient.submitApplication(item.payload);
    remove(item.id);
    onItemFlushed(item.id);
  }
}

// Register listener — auto-flush on reconnect
export function registerConnectivityListener(apiClient: AnaguApiClient): () => void {
  return NetInfo.addEventListener(state => {
    if (state.isConnected && dequeue().length > 0) {
      flushQueue(apiClient, () => {});
    }
  });
}
```

---

### Component 10 — Conventional Baseline Simulator

The baseline simulator is a NestJS service used exclusively by the cross-cutting evaluation
module. It replicates a manual/paper process: checks only that all named documents are present
(non-empty strings), performs no spatial geometry check, and performs no ownership cross-check.

```typescript
// apps/backend/src/baseline/baseline-simulator.service.ts
export interface BaselineSubmission {
  applicationId: string;
  documents:     Record<string, string | null>;
  parcelCoords:  [number, number][];
  ownerName:     string;
  documentNumber: string;
}

export type BaselineOutcome = 'accepted' | 'rejected_missing_documents';

@Injectable()
export class BaselineSimulatorService {
  process(submission: BaselineSubmission): BaselineOutcome {
    const requiredDocs = ['titleDeed', 'surveyPlan', 'identityDocument'];
    const allPresent = requiredDocs.every(
      doc => submission.documents[doc]?.trim(),
    );
    return allPresent ? 'accepted' : 'rejected_missing_documents';
    // No spatial check. No ownership check.
  }
}
```

---

## Data Models

### Supabase Database Schema

```sql
-- parcels — spatial data
CREATE TABLE parcels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID REFERENCES applications(id),
  token_id        TEXT,               -- set after NFT minting
  geom            GEOMETRY(POLYGON, 4326) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
                  -- 'pending' | 'registered' | 'reverted'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX parcels_geom_idx ON parcels USING GIST (geom);

-- applications — workflow state
CREATE TABLE applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id          UUID NOT NULL,   -- Supabase auth user id
  owner_name          TEXT NOT NULL,
  owner_wallet_address TEXT NOT NULL,
  document_number     TEXT NOT NULL,
  document_type       TEXT NOT NULL,
  issuing_authority   TEXT NOT NULL,
  parcel_ref          TEXT NOT NULL,
  spatial_hash        TEXT,
  title_metadata_uri  TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- land_titles — NFT issuance records
CREATE TABLE land_titles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id),
  token_id        TEXT NOT NULL UNIQUE,
  owner_id        UUID NOT NULL,        -- Supabase auth user id
  parcel_id       UUID NOT NULL REFERENCES parcels(id),
  tx_hash         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
                  -- 'active' | 'revoked'
  issued_at       TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ
);

-- audit_trail — append-only immutable log
CREATE TABLE audit_trail (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   TEXT NOT NULL,            -- applicationId or tokenId
  actor_id    UUID,                     -- nullable for system actions
  action      TEXT NOT NULL,
  outcome     TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: allow INSERT via service role only; deny UPDATE and DELETE for all roles
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_insert ON audit_trail FOR INSERT TO service_role USING (true);
CREATE POLICY audit_no_update ON audit_trail FOR UPDATE USING (false);
CREATE POLICY audit_no_delete ON audit_trail FOR DELETE USING (false);

-- mqtt_events — system monitoring log
CREATE TABLE mqtt_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic        TEXT NOT NULL,
  payload_size INTEGER NOT NULL,        -- bytes
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- users_roles — role assignment (maps Supabase auth user to system role)
CREATE TABLE user_roles (
  user_id  UUID PRIMARY KEY,             -- Supabase auth user id
  role     TEXT NOT NULL
           CHECK (role IN ('citizen','surveyor','registrar','land_admin','governor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### On-Chain Storage Fields (per land title record)

| Field | Variable | Stored Type | Typical Size |
|---|---|---|---|
| Parcel identity hash | `S_id` | `uint256` token ID | 256 bits |
| Spatial geometry reference | `S_geom` | `bytes32` keccak256 of WKT | 256 bits |
| Ownership / NFT-holder | `S_owner` | Ethereum address | 160 bits |
| Oracle payload | `S_oracle` | IPFS CID in `titleMetadata` string | variable |
| Timestamp | `S_time` | `uint256` block.timestamp | 256 bits |
| Revocation flag | `S_rev` | `bool` isRevoked | 8 bits |
| Mint transaction hash | `S_sig` | `bytes32` mintTxHash | 256 bits |

**Total fixed fields per record:** 1,448 bits = 181 bytes (excluding variable-length titleMetadata).

---

## Interfaces

### REST API Endpoints (NestJS)

| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | `/applications` | Citizen | Submit new land application |
| `GET` | `/applications/:id` | Citizen (own), Registrar, Land Admin | Get application status |
| `GET` | `/applications` | Registrar, Land Admin | List all applications |
| `POST` | `/applications/:id/approve` | Registrar | Approve and trigger blockchain registration |
| `POST` | `/applications/:id/reject` | Registrar | Reject application |
| `POST` | `/parcels/validate` | Surveyor | Submit coordinates for spatial validation |
| `POST` | `/titles/:tokenId/revoke` | Governor | Invoke statutory revocation |
| `GET` | `/audit/:entityId` | Registrar, Land Admin, Governor | Get audit trail |
| `GET` | `/health` | Public | Service health check |

### MQTT Topic Schema

| Topic | QoS | Payload Fields |
|---|---|---|
| `land/registration/status` | 1 | `applicationId`, `status`, `timestamp` |
| `land/title/issued` | 1 | `tokenId`, `owner`, `parcelId`, `timestamp` |
| `land/title/revoked` | 2 | `tokenId`, `ground`, `revokedBy`, `timestamp` |
| `land/verification/result` | 1 | `applicationId`, `outcome`, `timestamp` |

### Docker Compose Infrastructure

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  mqtt:
    image: emqx/emqx:latest
    ports:
      - "1883:1883"
      - "8083:8083"
      - "18083:18083"
    healthcheck:
      test: ["CMD", "emqx", "ping"]
      interval: 15s
      timeout: 10s
      retries: 5

  besu:
    image: hyperledger/besu:latest
    volumes:
      - ./infra/besu:/config
    command: >
      --config-file=/config/config.toml
      --genesis-file=/config/genesis.json
      --rpc-http-enabled
      --rpc-http-api=ETH,NET,QBFT,ADMIN
      --host-allowlist=*
      --rpc-http-cors-origins=*
    ports:
      - "8545:8545"
      - "8546:8546"
    healthcheck:
      test: ["CMD-SHELL", "curl -s -X POST --data '{\"jsonrpc\":\"2.0\",\"method\":\"net_version\",\"params\":[],\"id\":1}' http://localhost:8545"]
      interval: 15s
      timeout: 10s
      retries: 10
```

### Besu Genesis Configuration

```json
{
  "config": {
    "chainId": 1337,
    "berlinBlock": 0,
    "qbft": {
      "blockperiodseconds": 1,
      "epochlength": 30000,
      "requesttimeoutseconds": 4
    }
  },
  "gasLimit": "0x1fffffffffffff",
  "difficulty": "0x1",
  "alloc": {}
}
```

---

## Error Handling

### Spatial Verification Errors

| Code | Meaning | HTTP Status |
|---|---|---|
| `GEOM_INVALID` | Polygon failed `ST_IsValid()` — self-intersecting or malformed | 422 |
| `PARCEL_OVERLAP` | Polygon intersects existing registered parcel within 0.5 m buffer | 409 |

### Oracle Verification Outcomes (not HTTP errors — returned as result objects)

| Outcome | Pipeline Effect |
|---|---|
| `SuccessfullyVerified` | Pipeline proceeds |
| `OwnershipConflict` | Pipeline halted; application rejected for admin review |
| `IncompleteDocuments` | Pipeline halted; application returned to citizen |
| `LegalVerificationPending` | Pipeline suspended; application held pending legal resolution |

### Blockchain Errors

Smart contract reverts are caught by the NestJS blockchain service and translated to HTTP
500 with structured error codes. The `GOVERNOR_ROLE` revert surfaces as HTTP 403 before the
transaction is ever submitted (checked at the API RBAC layer first).

### RBAC Errors

All role violations return HTTP 403 with a structured body:

```typescript
{
  statusCode: 403,
  error: 'Forbidden',
  message: 'Role <role> is not authorised to perform <operation>',
  operation: string,
  requiredRoles: UserRole[],
}
```

Every 403 response triggers an audit entry via the `AuditInterceptor`.

### Offline Queue Error Handling

If a flush attempt fails (network re-acquired but backend temporarily unreachable), the item
remains in the queue and retryCount is incremented. After 5 retries the item is marked as
`failed` and the user is notified. Failed items are never silently dropped.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions
of a system — essentially, a formal statement about what the system should do. Properties serve
as the bridge between human-readable specifications and machine-verifiable correctness
guarantees.*

---

### Property 1: Spatial verification records every outcome in the audit trail

*For any* parcel submission — regardless of whether it results in approval, geometry rejection,
or overlap rejection — the Supabase `audit_trail` table SHALL contain exactly one entry for
that `applicationId` with the correct outcome code and an ISO 8601 timestamp.

**Validates: Requirements 2.5, 2.6, 2.8**

---

### Property 2: Invalid geometry is always rejected with the correct diagnostic code

*For any* set of coordinates that forms a self-intersecting or otherwise malformed polygon,
the Spatial Verifier SHALL return `outcome: 'rejected_invalid_geometry'` and
`diagnosticCode: 'GEOM_INVALID'`. No such polygon SHALL ever receive an `'approved'` result.

**Validates: Requirements 2.2, 2.5**

---

### Property 3: Overlapping parcel is always rejected with conflicting parcel ID

*For any* parcel polygon that intersects an existing registered parcel within the 0.5-metre
buffer, the Spatial Verifier SHALL return `outcome: 'rejected_overlap'`,
`diagnosticCode: 'PARCEL_OVERLAP'`, and a non-null `conflictingParcelId` that identifies the
conflicting registered parcel. No overlapping polygon SHALL ever receive an `'approved'` result.

**Validates: Requirements 2.3, 2.6**

---

### Property 4: NFT minting always produces unique token IDs

*For any* sequence of valid minting operations executed against the `LandTitleNFT` contract,
all resulting token identifiers SHALL be distinct. No two minted tokens SHALL share the same
`tokenId`.

**Validates: Requirements 3.1**

---

### Property 5: Every minted NFT contains all five required metadata fields

*For any* valid mint operation, the resulting token's on-chain metadata SHALL have all five
fields populated and non-zero/non-empty: `tokenId`, `parcelRef`, `mintTxHash`, `spatialHash`,
and `titleMetadata`.

**Validates: Requirements 3.2**

---

### Property 6: Direct owner-initiated transfers always revert

*For any* token holder address and *any* target recipient address, calling
`transferFrom`, `safeTransferFrom`, or any standard ERC-721 transfer function directly SHALL
revert with the message `"LandTitleNFT: direct transfers are disabled"`, regardless of whether
the token is revoked or active.

**Validates: Requirements 3.4**

---

### Property 7: Only GOVERNOR_ROLE can revoke, and revocation is permanent

*For any* account that does not hold `GOVERNOR_ROLE`, calling `revoke()` SHALL revert.
*For any* token that has been successfully revoked by a `GOVERNOR_ROLE` address, `isRevoked[tokenId]`
SHALL be `true` in every subsequent query, and any subsequent transfer attempt on that token
SHALL revert with `"LandTitleNFT: token is revoked"`.

**Validates: Requirements 4.1, 4.3, 4.5, 4.6, 10.7**

---

### Property 8: Every valid revocation emits a TitleRevoked event with complete fields

*For any* successful revocation call by a `GOVERNOR_ROLE` address, the transaction receipt
SHALL contain exactly one `TitleRevoked` event with all four fields populated: `tokenId`
matching the revoked token, `ground` matching the submitted `RevocationGround` enum value,
`revokedBy` matching the caller's address, and `timestamp` equal to `block.timestamp`.

**Validates: Requirements 4.2, 4.4**

---

### Property 9: Oracle outcome is deterministic with respect to documented match/conflict rules

*For any* ownership claim and any retrieved institutional record, applying the Oracle match
rules SHALL produce the same outcome every time the same inputs are evaluated. Specifically:

- If `jaroWinkler(claim.ownerName, record.activeOwnerName) >= 0.85` AND
  `claim.documentNumber === record.documentNumber` → `SuccessfullyVerified`
- If `jaroWinkler(claim.ownerName, record.activeOwnerName) < 0.85` → `OwnershipConflict`
- If any required field in the claim is absent or whitespace-only → `IncompleteDocuments`
- If `record.legalHold === true` → `LegalVerificationPending`

**Validates: Requirements 5.2, 5.3, 5.4, 5.5**

---

### Property 10: Oracle always records verification outcome in the audit trail and publishes MQTT

*For any* ownership claim that produces any verification outcome, the Supabase `audit_trail`
SHALL contain one entry for that `applicationId`, AND the MQTT broker SHALL receive a message
on `land/verification/result` with `applicationId`, `outcome`, and `timestamp` fields.

**Validates: Requirements 5.7, 5.8**

---

### Property 11: Every MQTT published message matches its defined topic schema

*For any* workflow event published via `MqttService.publish()`, the topic, QoS level, and
payload field set SHALL exactly match the corresponding entry in `MQTT_TOPICS`. No message
SHALL be published to a defined topic with missing required fields or incorrect QoS.

**Validates: Requirements 6.1, 6.2**

---

### Property 12: Offline queue preserves all submissions made without network connectivity

*For any* registration submission made while the device has no network connectivity, the
submission SHALL appear in the device's Offline Queue (persisted in MMKV) immediately after
the submission call returns. The queue entry SHALL contain the full original payload.

**Validates: Requirements 6.4, 12.5**

---

### Property 13: Offline queue is fully flushed upon connectivity restoration

*For any* non-empty Offline Queue, when network connectivity is restored, all queued items
SHALL be delivered to the backend API and confirmed, after which the queue SHALL be empty.
No item SHALL be silently dropped; failed items SHALL increment `retryCount`.

**Validates: Requirements 6.5**

---

### Property 14: Every MQTT event is logged in the system monitoring table

*For any* call to `MqttService.publish()`, the `mqtt_events` table in Supabase SHALL receive
one row containing the correct `topic`, the correct `payload_size` (byte length of the JSON
string), and a non-null `created_at` timestamp.

**Validates: Requirements 6.6**

---

### Property 15: Role-based access control enforces the RBAC matrix for every operation

*For any* authenticated user with role R and *any* API operation O: if R is listed in
`RBAC_MATRIX[O]`, the request SHALL succeed (2xx); if R is not listed, the backend SHALL
return HTTP 403. This property holds for all five roles and all defined operations.

**Validates: Requirements 7.3, 7.4, 7.5, 7.6, 7.7, 7.8**

---

### Property 16: Every audit trail entry contains all five required fields in correct format

*For any* workflow state transition of any type, the resulting `audit_trail` row SHALL have
all five fields populated: `entity_id` (non-null), `actor_id` (non-null for user-initiated
actions), `action` (one of the eight defined transition types), `outcome` (non-empty string),
and `created_at` as a valid ISO 8601 timestamp.

**Validates: Requirements 8.1, 8.3**

---

### Property 17: Audit trail entries are immutable — no update or delete ever succeeds

*For any* existing row in the `audit_trail` table, any attempt to execute an SQL `UPDATE` or
`DELETE` against that row (regardless of the Supabase client or role used) SHALL be rejected
by Supabase RLS policy. The row SHALL remain unchanged.

**Validates: Requirements 8.2, 8.5**

---

### Property 18: Pipeline stage ordering is always preserved

*For any* submitted application that reaches the blockchain registration stage, the audit
trail SHALL contain entries in the following strict order: `SPATIAL_VERIFICATION` before
`ORACLE_VERIFICATION`, `ORACLE_VERIFICATION` before `REGISTRAR_APPROVAL`,
`REGISTRAR_APPROVAL` before `BLOCKCHAIN_REGISTRATION`, `BLOCKCHAIN_REGISTRATION` before
`NFT_ISSUANCE`, `NFT_ISSUANCE` before `MQTT_NOTIFICATION`. No stage SHALL appear in the
audit trail before its predecessor.

**Validates: Requirements 9.1**

---

### Property 19: Pipeline rejection at any stage triggers all four consequences

*For any* pipeline stage that produces a rejection outcome, all four of the following SHALL
occur atomically before the pipeline returns: (1) the audit trail records the rejection reason,
(2) the application status in Supabase is set to `'rejected'`, (3) an MQTT message is published
to `land/registration/status` with `status: 'rejected'`, and (4) no subsequent pipeline stage
is invoked.

**Validates: Requirements 9.2**

---

### Property 20: Successful pipeline completion always produces all three post-completion records

*For any* application that completes all pipeline stages, after `completeAfterRegistrarApproval`
returns: (1) the application status in Supabase SHALL be `'completed'`, (2) the `land_titles`
table SHALL contain a row with the issued `token_id`, and (3) the MQTT broker SHALL have
received a `land/title/issued` message with matching `tokenId`, `owner`, `parcelId`, and
`timestamp`.

**Validates: Requirements 9.3**

---
