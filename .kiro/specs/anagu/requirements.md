# Requirements Document

## Introduction

Anagu is an integrated land title administration framework for Nigeria that digitises the full lifecycle of parcel registration, ownership verification, and lawful title revocation. The system combines GIS-based spatial validation (via Supabase's PostGIS), permissioned blockchain recording (Hyperledger Besu QBFT), ERC-721 NFT land titles (Solidity/Hardhat), a community ownership verification oracle (NestJS), and real-time event broadcasting via MQTT (EMQX). Three client surfaces are delivered together: a NestJS backend API, a Next.js web portal, and a React Native Expo mobile application.

The framework enforces the Nigerian Land Use Act (1978), Section 28 for statutory revocation, and applies role-based access control across all workflow stages.

Infrastructure runs on Docker Compose (Besu, Redis, EMQX) with Supabase (PostgreSQL + PostGIS + Storage) as the managed data and file layer.

---

## Glossary

- **System**: The Anagu Land Administration Framework as a whole.
- **Backend**: The NestJS TypeScript API service that orchestrates all business logic.
- **Web Portal**: The Next.js TypeScript citizen-facing and registrar dashboard frontend.
- **Mobile App**: The React Native Expo TypeScript application used by field officers and citizens in low-connectivity conditions.
- **Spatial Verifier**: The Backend module that performs GIS geometry validation and overlap detection using Supabase PostGIS.
- **Oracle**: The Backend NestJS service that verifies ownership claims against institutional and community sources.
- **Blockchain Node**: The local Hyperledger Besu QBFT node running in Docker Compose.
- **LandTitleNFT**: The ERC-721 Solidity smart contract that represents individual land titles as non-fungible tokens.
- **LandRegistry**: The Solidity smart contract that manages issuance and registry-controlled transfers of land title NFTs.
- **MQTT Broker**: The EMQX instance running in Docker Compose that handles real-time message delivery.
- **Supabase**: The managed platform providing PostgreSQL + PostGIS database, authentication, and object storage.
- **Parcel**: A geospatially defined land unit submitted for registration, represented as a GIS polygon in WGS 84 (EPSG:4326).
- **Citizen**: A user role permitted to submit land applications and view their own application status.
- **Surveyor**: A user role permitted to submit parcel coordinates and validate geometry.
- **Registrar**: A user role permitted to approve or reject applications and trigger blockchain registration.
- **Land Administrator**: A user role permitted to manage the registry and oversee all workflows.
- **Governor**: A user role exclusively permitted to invoke statutory revocation under the Nigerian Land Use Act (1978), Section 28.
- **GOVERNOR_ROLE**: The on-chain AccessControl role identifier (`keccak256("GOVERNOR_ROLE")`) assigned only to the Governor's designated address.
- **RevocationGround**: An on-chain enum with two values — `OverridingPublicInterest` (0) and `BreachOfStatutoryCondition` (1) — corresponding to the two grounds defined in the Land Use Act Section 28.
- **Audit Trail**: An append-only, immutable log of every workflow state transition, stored in Supabase.
- **Offline Queue**: A local buffer on the Mobile App that stores pending submissions when network connectivity is unavailable, and flushes them to the Backend upon reconnection.
- **Overlap Tolerance Buffer**: A 0.5-metre spatial buffer applied during parcel overlap detection using `ST_Buffer`, accounting for real-world survey accuracy limits.
- **Conventional Baseline**: A simplified simulator representing a manual/paper-based process that checks document presence only, with no automated spatial or ownership cross-checks, used as a comparison point in cross-cutting evaluation.

---

## Requirements

### Requirement 1 — Environment and Infrastructure Setup

**User Story:** As a Land Administrator, I want all infrastructure services to start from a single command, so that the development and deployment environment is reproducible and verifiable before any business logic is built.

#### Acceptance Criteria

1. THE System SHALL provide a `docker-compose.yml` that defines and starts a Hyperledger Besu QBFT node (ports 8545 and 8546), a Redis instance (port 6379), and an EMQX MQTT broker (ports 1883, 8083, and 18083).
2. WHEN `docker compose up` is executed, THE System SHALL bring all three Docker Compose services to a healthy state as reported by `docker compose ps`.
3. WHEN the Backend starts, THE System SHALL establish a connection to the Supabase PostgreSQL database and log a confirmation message.
4. WHEN a trivial Solidity contract is deployed to the Blockchain Node using Hardhat, THE System SHALL return a confirmed on-chain transaction hash.
5. THE Blockchain Node SHALL use QBFT consensus with a block period of 1 second and an epoch length of 30,000 blocks as configured in `infra/besu/genesis.json`.
6. THE System SHALL configure the Besu genesis file with `chainId` 1337, `berlinBlock` 0, and `requesttimeoutseconds` 4.
7. IF any Docker Compose service fails its health check, THEN THE System SHALL surface the failure status in `docker compose ps` output so that the operator can identify which service is unhealthy.

---

### Requirement 2 — GIS-Based Spatial Verification

**User Story:** As a Surveyor, I want submitted parcel coordinates to be automatically validated for geometry correctness and overlap with existing parcels, so that registration of invalid or conflicting land claims is prevented before the application proceeds.

#### Acceptance Criteria

1. WHEN a parcel is submitted for registration, THE Spatial Verifier SHALL convert the submitted coordinates into a GIS polygon referenced to WGS 84 (EPSG:4326).
2. WHEN a parcel polygon is constructed, THE Spatial Verifier SHALL execute `ST_IsValid()` via Supabase PostGIS to determine whether the polygon is well-formed and non-self-intersecting.
3. WHEN a parcel polygon passes the `ST_IsValid()` check, THE Spatial Verifier SHALL execute `ST_Intersects()` with a 0.5-metre `ST_Buffer` against all existing parcels in the Supabase parcels table, excluding the submitted parcel's own record.
4. WHEN the parcel satisfies both the geometry validity check and the overlap check, THE Spatial Verifier SHALL return an approval result that permits the application to proceed to the next stage.
5. IF a parcel polygon fails `ST_IsValid()`, THEN THE Spatial Verifier SHALL return a rejection result that includes a diagnostic code identifying the geometry invalidity failure.
6. IF a parcel polygon intersects an existing parcel within the 0.5-metre buffer, THEN THE Spatial Verifier SHALL return a rejection result that includes a diagnostic code identifying the overlap failure and the identifier of the conflicting parcel.
7. THE Spatial Verifier SHALL use an overlap tolerance buffer value of exactly 0.5 metres, and THE Backend SHALL expose this value in its API documentation and test reports.
8. WHEN spatial verification is complete, THE Spatial Verifier SHALL record the outcome in the Audit Trail with the application identifier, the result, and a timestamp.

---

### Requirement 3 — Blockchain NFT Title Issuance

**User Story:** As a Registrar, I want approved land registrations to be issued as immutable ERC-721 NFT land titles on the permissioned blockchain, so that ownership is recorded in a tamper-evident and auditable form.

#### Acceptance Criteria

1. WHEN an application has passed spatial verification, oracle verification, and Registrar approval, THE LandTitleNFT SHALL mint a unique ERC-721 token representing the registered land parcel.
2. THE LandTitleNFT SHALL associate each minted token with the following five fields: a unique token identifier, a reference to the corresponding land parcel, the blockchain transaction hash of the minting event, a hash of the parcel's spatial information, and title metadata.
3. WHEN an NFT land title is minted, THE LandRegistry SHALL update the Supabase database with the minted token's identifier and associate it with the corresponding parcel and owner records.
4. THE LandRegistry SHALL disable all owner-initiated ERC-721 transfer functions so that land ownership changes are only possible through the authorised registry process.
5. WHEN a registry-controlled transfer is executed by the Registrar, THE LandRegistry SHALL update the on-chain owner record and the Supabase ownership record accordingly.
6. WHEN an NFT land title is issued, THE MQTT Broker SHALL publish a message to the topic `land/title/issued` with the payload fields `tokenId`, `owner`, `parcelId`, and `timestamp` at QoS level 1.

---

### Requirement 4 — Statutory Title Revocation

**User Story:** As a Governor, I want to revoke a land title under the Nigerian Land Use Act (1978) Section 28, so that lawful executive revocation is enforced and permanently recorded as a distinct, auditable blockchain event.

#### Acceptance Criteria

1. WHEN a revocation request is received, THE LandTitleNFT SHALL verify that the requesting address holds the `GOVERNOR_ROLE` on-chain access control role before executing any revocation action.
2. WHEN a revocation request is received, THE LandTitleNFT SHALL validate that the revocation ground is one of the two values defined in `RevocationGround`: `OverridingPublicInterest` or `BreachOfStatutoryCondition`.
3. WHEN a valid revocation is executed by a `GOVERNOR_ROLE` address, THE LandTitleNFT SHALL set the `isRevoked` mapping for the target token identifier to `true`.
4. WHEN a valid revocation is executed, THE LandTitleNFT SHALL emit a `TitleRevoked` event containing the token identifier, the `RevocationGround` value, the revoking address, and the block timestamp, recording it as a distinct, immutable on-chain event separate from the original issuance record.
5. IF an address without the `GOVERNOR_ROLE` attempts to invoke the `revoke()` function, THEN THE LandTitleNFT SHALL revert the transaction.
6. IF a token with `isRevoked` set to `true` is the subject of any transfer attempt, THEN THE LandTitleNFT SHALL revert the transfer via the `_beforeTokenTransfer` hook (OpenZeppelin v4) or `_update` override (OpenZeppelin v5).
7. WHEN a title is revoked, THE Backend SHALL update the Supabase database and GIS layer to reflect the parcel's reverted status.
8. WHEN a title is revoked, THE Backend SHALL notify the affected titleholder and the relevant registry office through the system's notification channel.
9. WHEN a title is revoked, THE MQTT Broker SHALL publish a message to the topic `land/title/revoked` with the payload fields `tokenId`, `ground`, `revokedBy`, and `timestamp` at QoS level 2.

---

### Requirement 5 — Community Verification Oracle

**User Story:** As a Registrar, I want submitted ownership claims to be cross-checked against institutional and community sources before they reach the blockchain, so that fraudulent or conflicting ownership claims are identified at the application stage.

#### Acceptance Criteria

1. WHEN an ownership claim is submitted during land registration, THE Oracle SHALL forward the claim to the verification service for cross-checking against authorised institutional and community sources.
2. WHEN the Oracle receives verification results, THE Oracle SHALL compare the retrieved ownership records against the submitted claim using documented match and conflict rules that define exactly what constitutes a match and what constitutes a conflict.
3. WHEN the submitted ownership information matches the retrieved records according to the documented match rules, THE Oracle SHALL return a `SuccessfullyVerified` outcome and permit the application to proceed.
4. IF the submitted ownership information conflicts with retrieved records according to the documented conflict rules, THEN THE Oracle SHALL return an `OwnershipConflict` outcome and reject the application for administrative review.
5. IF the submitted ownership documentation is incomplete, THEN THE Oracle SHALL return an `IncompleteDocuments` outcome and reject the application.
6. IF the ownership verification process cannot be completed due to a pending legal check, THEN THE Oracle SHALL return a `LegalVerificationPending` outcome and hold the application.
7. WHEN ownership verification is complete, THE Oracle SHALL record the outcome, application identifier, and timestamp in the Audit Trail.
8. WHEN ownership verification produces any outcome, THE MQTT Broker SHALL publish a message to the topic `land/verification/result` with the payload fields `applicationId`, `outcome`, and `timestamp` at QoS level 1.

---

### Requirement 6 — MQTT Real-Time Communication and Offline Synchronisation

**User Story:** As a field officer using the Mobile App in low-connectivity conditions, I want land registration events to be broadcast in real time and pending submissions to be queued locally when offline, so that workflow continuity is maintained regardless of network availability.

#### Acceptance Criteria

1. WHEN a significant workflow event occurs (registration status change, title issuance, title revocation, or verification result), THE MQTT Broker SHALL publish the corresponding message to the defined topic using the payload schema and QoS level specified in the MQTT topic schema.
2. THE Backend SHALL publish messages to the following four MQTT topics: `land/registration/status` (QoS 1, fields: `applicationId`, `status`, `timestamp`), `land/title/issued` (QoS 1), `land/title/revoked` (QoS 2), and `land/verification/result` (QoS 1).
3. WHEN a workflow message is published, THE MQTT Broker SHALL confirm successful delivery to all subscribed system components.
4. WHEN the Mobile App is operating without network connectivity, THE Mobile App SHALL store pending land registration submissions in a local Offline Queue on the device.
5. WHEN network connectivity is restored on the Mobile App, THE Mobile App SHALL flush all pending submissions from the Offline Queue to the Backend and confirm delivery of each queued item.
6. THE Backend SHALL record every MQTT communication event in the system monitoring log with the topic, payload size, and timestamp.
7. WHEN operating under moderate network degradation (200ms latency, 10% packet loss), THE MQTT Broker SHALL successfully deliver messages at a rate that can be measured and reported in the Component 3 delivery performance table.
8. WHEN operating under severe network degradation (500ms latency, 25% packet loss), THE MQTT Broker SHALL successfully deliver messages at a rate that can be measured and reported in the Component 3 delivery performance table.

---

### Requirement 7 — Role-Based Access Control

**User Story:** As a Land Administrator, I want every workflow action to be gated by the actor's assigned role, so that no actor can perform operations outside their authorised scope.

#### Acceptance Criteria

1. THE System SHALL enforce five distinct roles: Citizen, Surveyor, Registrar, Land Administrator, and Governor.
2. THE System SHALL use Supabase authentication as the identity provider and derive role assignments from the authenticated session.
3. WHEN a Citizen is authenticated, THE Backend SHALL permit the Citizen to submit land applications and view the status of their own applications only.
4. WHEN a Surveyor is authenticated, THE Backend SHALL permit the Surveyor to submit parcel coordinates and invoke the geometry validation endpoint.
5. WHEN a Registrar is authenticated, THE Backend SHALL permit the Registrar to approve or reject applications, trigger blockchain registration, issue NFT titles, and view all applications.
6. WHEN a Land Administrator is authenticated, THE Backend SHALL permit the Land Administrator to manage the registry, oversee all workflows, and view all applications and the Audit Trail.
7. WHEN a Governor is authenticated, THE Backend SHALL permit the Governor to invoke statutory revocation and view the Audit Trail; THE Backend SHALL deny the Governor access to any other mutating workflow operation.
8. IF an authenticated actor attempts an operation not permitted by their role, THEN THE Backend SHALL return an HTTP 403 response and record the unauthorised attempt in the Audit Trail.
9. THE Backend SHALL validate role-based authorisation at the API layer before delegating to any service or smart contract function.

---

### Requirement 8 — Immutable Audit Trail

**User Story:** As a Land Administrator, I want every state transition across the entire workflow to be logged to an immutable audit record, so that the full history of any application or title can be reconstructed and verified.

#### Acceptance Criteria

1. THE Backend SHALL record an audit entry for every workflow state transition, including: application submission, spatial verification outcome, oracle verification outcome, Registrar approval or rejection, blockchain registration, NFT issuance, statutory revocation, and any unauthorised access attempt.
2. THE System SHALL store audit entries in Supabase as append-only records; no audit entry SHALL be modified or deleted after creation.
3. WHEN an audit entry is created, THE Backend SHALL include the application or title identifier, the actor's authenticated identifier, the action performed, the outcome, and an ISO 8601 timestamp.
4. WHEN the Registrar, Land Administrator, or Governor requests the Audit Trail, THE Backend SHALL return the full, ordered history of entries for the requested application or title.
5. IF an attempt is made to modify or delete an existing audit entry, THEN THE Backend SHALL reject the operation and return an error.

---

### Requirement 9 — End-to-End Registration Pipeline

**User Story:** As a Citizen, I want my land registration application to flow automatically through all verification and approval stages, so that a valid application results in an issued NFT land title without manual re-entry at each stage.

#### Acceptance Criteria

1. WHEN a land registration application is submitted, THE Backend SHALL route the application through the following sequential stages in order: spatial verification, oracle ownership verification, legal verification, Registrar approval, blockchain registration, NFT title issuance, and MQTT notification.
2. WHEN any pipeline stage rejects an application, THE Backend SHALL halt the pipeline at that stage, record the rejection reason in the Audit Trail, update the application status to rejected, and notify the applicant.
3. WHEN all pipeline stages succeed and the NFT title is issued, THE Backend SHALL update the application status to completed, record the NFT token identifier in Supabase, and publish the `land/title/issued` MQTT message.
4. WHEN the Registrar reviews an application, THE Web Portal SHALL display the spatial verification result, the oracle verification result, and all submitted documents to the Registrar in a single consolidated view.
5. WHEN the Mobile App submits a registration application, THE Mobile App SHALL display the current pipeline stage and status to the applicant in real time using MQTT subscription updates.

---

### Requirement 10 — Cross-Cutting Evaluation

**User Story:** As a Land Administrator, I want the fully integrated system to be evaluated against a conventional baseline across fraud resistance, processing latency, and storage overhead, so that the framework's benefits over a non-automated process are objectively demonstrated.

#### Acceptance Criteria

1. THE System SHALL include a Conventional Baseline simulator that checks document presence only, performs no automated spatial cross-check, and performs no automated ownership cross-check.
2. WHEN fraud scenario testing is conducted, THE System SHALL run each of the four defined adversary scenarios (forged document, duplicate parcel, colluding verification informant, post-revocation NFT reuse) at least 20 times against both the proposed framework and the Conventional Baseline, recording detection and rejection rates separately for each scenario.
3. WHEN processing latency testing is conducted, THE Backend SHALL instrument the five pipeline stages (spatial verification, oracle verification, smart contract execution, NFT issuance, MQTT synchronisation) using the `performance.now()` API and record mean and standard deviation across at least 30 separate complete registration transactions.
4. WHEN storage overhead analysis is conducted, THE System SHALL measure the actual on-chain bit length of each of the seven defined storage fields (parcel identity hash, spatial geometry reference, ownership reference, oracle payload, timestamp, validator signature, Merkle proof metadata) and compute the total per-record byte size.
5. THE System SHALL compute and report a percentage reduction in storage overhead between the proposed framework and the Conventional Baseline.
6. THE System SHALL compute and report a percentage reduction in end-to-end processing latency between the proposed framework and the Conventional Baseline for the same transaction type.
7. WHEN post-revocation NFT reuse is tested, THE System SHALL attempt a transaction against a previously revoked token identifier and THE LandTitleNFT SHALL revert the attempt in every trial.

---

### Requirement 11 — Web Portal Interface

**User Story:** As a Citizen or Registrar, I want a web-based portal to submit applications and manage the registration workflow, so that land administration tasks are accessible from a standard browser without specialist tooling.

#### Acceptance Criteria

1. THE Web Portal SHALL provide authenticated login using Supabase authentication and display role-appropriate navigation based on the authenticated user's role.
2. WHEN a Citizen logs in, THE Web Portal SHALL display a dashboard showing the Citizen's submitted applications, their current pipeline stage, and their status.
3. WHEN a Registrar logs in, THE Web Portal SHALL display a queue of applications pending review, each showing the spatial verification result, oracle verification result, and submitted documents.
4. WHEN a Land Administrator logs in, THE Web Portal SHALL display a registry management view that includes all applications, all issued titles, and access to the Audit Trail.
5. WHEN a Governor logs in, THE Web Portal SHALL display only the statutory revocation interface and the Audit Trail, with no access to other mutating workflow actions.
6. THE Web Portal SHALL be implemented in Next.js with TypeScript and SHALL connect to the Backend API for all data operations.

---

### Requirement 12 — Mobile Application

**User Story:** As a field officer or Citizen using a mobile device in the field, I want to submit land registration applications and receive status updates through a mobile app, so that registrations can be initiated from remote locations with intermittent connectivity.

#### Acceptance Criteria

1. THE Mobile App SHALL provide authenticated login using Supabase authentication and enforce role-based access consistent with Requirement 7.
2. WHEN a Surveyor uses the Mobile App, THE Mobile App SHALL allow the Surveyor to capture and submit parcel coordinates for spatial verification.
3. WHEN a Citizen uses the Mobile App, THE Mobile App SHALL allow the Citizen to submit a land registration application and track its pipeline status.
4. WHEN the Mobile App has network connectivity, THE Mobile App SHALL subscribe to MQTT topics relevant to the authenticated user's applications and display real-time status updates.
5. WHEN the Mobile App loses network connectivity during a registration submission, THE Mobile App SHALL store the in-progress submission in the Offline Queue and display a clear indication to the user that the submission is queued.
6. THE Mobile App SHALL be implemented in React Native with Expo and TypeScript.
