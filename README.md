Anagu Land Administration Framework
Overview
Anagu is a permissioned, full-stack land title administration system for Nigeria. It combines GIS-based spatial validation, Hyperledger Besu QBFT blockchain recording, ERC-721 NFT land titles, a community ownership verification oracle, and MQTT real-time event broadcasting into a single integrated pipeline.

The system enforces the Nigerian Land Use Act (1978) Section 28 for statutory revocation and applies role-based access control across every workflow stage.

Language: TypeScript throughout all three application tiers. Solidity for smart contracts.

Infrastructure: Docker Compose (Besu, Redis, EMQX) + Supabase (managed PostgreSQL + PostGIS + Storage + Auth).

## Deploy on Vercel (Prompts for Supabase Integration)

Use the Deploy buttons below so Vercel automatically prompts you to add and connect **Supabase** during deployment:

### Frontend (`frontend/web`)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Folag29144%2FAnagu&root-directory=frontend%2Fweb&project-name=anagu-web&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6&env=BACKEND_URL,NEXT_PUBLIC_RPC_URL,NEXT_PUBLIC_LAND_TITLE_NFT_ADDRESS,NEXT_PUBLIC_LAND_REGISTRY_ADDRESS,NEXT_PUBLIC_LAND_FEE_TOKEN_ADDRESS&envDescription=Backend%20API%20URL%20and%20smart%20contract%20addresses%20for%20Anagu)

### Backend API (`backend`)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Folag29144%2FAnagu&root-directory=backend&project-name=anagu-api&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6&env=CORS_ORIGIN,BESU_RPC_URL,REGISTRAR_PRIVATE_KEY,LAND_TITLE_NFT_ADDRESS,LAND_REGISTRY_ADDRESS,MQTT_DISABLED&envDescription=Frontend%20origin%2C%20RPC%20URL%2C%20contract%20addresses%2C%20and%20wallet%20key)

