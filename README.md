Anagu Land Administration Framework
Overview
Anagu is a permissioned, full-stack land title administration system for Nigeria. It combines GIS-based spatial validation, Hyperledger Besu QBFT blockchain recording, ERC-721 NFT land titles, a community ownership verification oracle, and MQTT real-time event broadcasting into a single integrated pipeline.

The system enforces the Nigerian Land Use Act (1978) Section 28 for statutory revocation and applies role-based access control across every workflow stage.

Language: TypeScript throughout all three application tiers. Solidity for smart contracts.

Infrastructure: Docker Compose (Besu, Redis, EMQX) + Supabase (managed PostgreSQL + PostGIS + Storage + Auth).
