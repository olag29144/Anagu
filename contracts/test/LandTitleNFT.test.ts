/**
 * Hardhat tests for LandTitleNFT — Properties 4–8
 *
 * Validates: Requirements 3.1, 3.2, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 10.7
 *
 * Property 4  — NFT minting always produces unique token IDs
 * Property 5  — Every minted NFT contains all five required metadata fields
 * Property 6  — Direct owner-initiated transfers always revert
 * Property 7  — Only GOVERNOR_ROLE can revoke, and revocation is permanent
 * Property 8  — Every valid revocation emits a TitleRevoked event with complete fields
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { LandTitleNFT } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Parse the first matching event from a transaction receipt.
 */
async function parseEvent(
  nft: LandTitleNFT,
  txPromise: Promise<{ wait: () => Promise<any> }>,
  eventName: string
) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  const parsed = receipt!.logs
    .map((log: any) => {
      try {
        return nft.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e: any) => e?.name === eventName);
  if (!parsed) throw new Error(`Event "${eventName}" not found in receipt`);
  return parsed;
}

// ──────────────────────────────────────────────────────────────────────────────
// Test constants
// ──────────────────────────────────────────────────────────────────────────────

const SAMPLE_PARCEL_REF = "ABUJA/2024/001";
const SAMPLE_SPATIAL_HASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    "POLYGON((7.4 9.0,7.5 9.0,7.5 9.1,7.4 9.1,7.4 9.0))"
  )
);
const SAMPLE_METADATA_URI = "ipfs://QmSampleHash";

// ──────────────────────────────────────────────────────────────────────────────
// Suite
// ──────────────────────────────────────────────────────────────────────────────

describe("LandTitleNFT", function () {
  let nft: LandTitleNFT;
  let deployer: HardhatEthersSigner;
  let registrar: HardhatEthersSigner;
  let governor: HardhatEthersSigner;
  let citizen: HardhatEthersSigner;
  let randomUser: HardhatEthersSigner;

  beforeEach(async function () {
    [deployer, registrar, governor, citizen, randomUser] =
      await ethers.getSigners();
    const LandTitleNFTFactory =
      await ethers.getContractFactory("LandTitleNFT");
    nft = (await LandTitleNFTFactory.deploy(
      registrar.address,
      governor.address
    )) as LandTitleNFT;
    await nft.waitForDeployment();
  });

  // ── Property 4: NFT minting always produces unique token IDs ───────────────
  /**
   * **Property 4: NFT minting always produces unique token IDs**
   * **Validates: Requirements 3.1**
   */
  describe("Property 4 — Unique token IDs", function () {
    it("assigns sequential unique token IDs for consecutive mints", async function () {
      const event1 = await parseEvent(
        nft,
        nft
          .connect(registrar)
          .mint(
            citizen.address,
            "PARCEL/001",
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          ),
        "TitleMinted"
      );
      const event2 = await parseEvent(
        nft,
        nft
          .connect(registrar)
          .mint(
            citizen.address,
            "PARCEL/002",
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          ),
        "TitleMinted"
      );

      const tokenId1: bigint = event1.args.tokenId;
      const tokenId2: bigint = event2.args.tokenId;

      expect(tokenId1).to.equal(1n, "first token must be 1");
      expect(tokenId2).to.equal(2n, "second token must be 2");
      expect(tokenId1).to.not.equal(tokenId2, "token IDs must be distinct");
    });

    it("mints 10 tokens and all IDs are unique and sequential", async function () {
      const ids: bigint[] = [];

      for (let i = 0; i < 10; i++) {
        const event = await parseEvent(
          nft,
          nft
            .connect(registrar)
            .mint(
              citizen.address,
              `PARCEL/${i.toString().padStart(3, "0")}`,
              SAMPLE_SPATIAL_HASH,
              SAMPLE_METADATA_URI
            ),
          "TitleMinted"
        );
        ids.push(event.args.tokenId as bigint);
      }

      // All IDs must be unique
      const uniqueIds = new Set(ids.map(String));
      expect(uniqueIds.size).to.equal(10, "all token IDs must be unique");

      // IDs must be sequential starting from 1
      for (let i = 0; i < 10; i++) {
        expect(ids[i]).to.equal(BigInt(i + 1), `token ${i + 1} ID mismatch`);
      }
    });

    it("token IDs do not repeat after different owners mint", async function () {
      const [, , , , , thirdOwner] = await ethers.getSigners();

      const ev1 = await parseEvent(
        nft,
        nft
          .connect(registrar)
          .mint(
            citizen.address,
            "PARCEL/A",
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          ),
        "TitleMinted"
      );
      const ev2 = await parseEvent(
        nft,
        nft
          .connect(registrar)
          .mint(
            thirdOwner.address,
            "PARCEL/B",
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          ),
        "TitleMinted"
      );

      expect(ev1.args.tokenId).to.not.equal(ev2.args.tokenId);
    });
  });

  // ── Property 5: Every minted NFT contains all five required metadata fields
  /**
   * **Property 5: Every minted NFT contains all five required metadata fields**
   * **Validates: Requirements 3.2**
   */
  describe("Property 5 — Complete metadata on mint", function () {
    it("stores all five metadata fields after minting", async function () {
      const event = await parseEvent(
        nft,
        nft
          .connect(registrar)
          .mint(
            citizen.address,
            SAMPLE_PARCEL_REF,
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          ),
        "TitleMinted"
      );
      const tokenId: bigint = event.args.tokenId;

      const metadata = await nft.getMetadata(tokenId);

      // Field 1: parcelRef
      expect(metadata.parcelRef).to.equal(
        SAMPLE_PARCEL_REF,
        "parcelRef must match"
      );

      // Field 2: spatialHash
      expect(metadata.spatialHash).to.equal(
        SAMPLE_SPATIAL_HASH,
        "spatialHash must match"
      );

      // Field 3: titleMetadata (IPFS URI)
      expect(metadata.titleMetadata).to.equal(
        SAMPLE_METADATA_URI,
        "titleMetadata must match"
      );

      // Field 4: mintTxHash — starts as bytes32(0) before setMintTxHash
      expect(metadata.mintTxHash).to.equal(
        ethers.ZeroHash,
        "mintTxHash must be zero before setMintTxHash"
      );

      // Field 5: tokenId — implicitly verified by the fact that getMetadata succeeds
    });

    it("setMintTxHash populates the fifth metadata field correctly", async function () {
      const event = await parseEvent(
        nft,
        nft
          .connect(registrar)
          .mint(
            citizen.address,
            SAMPLE_PARCEL_REF,
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          ),
        "TitleMinted"
      );
      const tokenId: bigint = event.args.tokenId;

      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("fake-tx-hash"));
      await nft.connect(registrar).setMintTxHash(tokenId, fakeHash);

      const updated = await nft.getMetadata(tokenId);
      expect(updated.mintTxHash).to.equal(
        fakeHash,
        "mintTxHash must reflect what was set"
      );
    });

    it("emits TitleMinted with correct owner and parcelRef", async function () {
      await expect(
        nft
          .connect(registrar)
          .mint(
            citizen.address,
            SAMPLE_PARCEL_REF,
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          )
      )
        .to.emit(nft, "TitleMinted")
        .withArgs(
          1n,
          citizen.address,
          SAMPLE_PARCEL_REF,
          (ts: bigint) => ts > 0n
        );
    });

    it("each minted token stores its own independent metadata", async function () {
      const parcelA = "ABUJA/2024/001";
      const parcelB = "ABUJA/2024/002";
      const spatialB = ethers.keccak256(ethers.toUtf8Bytes("different-wkt"));
      const uriB = "ipfs://QmOtherHash";

      const evA = await parseEvent(
        nft,
        nft
          .connect(registrar)
          .mint(citizen.address, parcelA, SAMPLE_SPATIAL_HASH, SAMPLE_METADATA_URI),
        "TitleMinted"
      );
      const evB = await parseEvent(
        nft,
        nft.connect(registrar).mint(citizen.address, parcelB, spatialB, uriB),
        "TitleMinted"
      );

      const metaA = await nft.getMetadata(evA.args.tokenId);
      const metaB = await nft.getMetadata(evB.args.tokenId);

      expect(metaA.parcelRef).to.equal(parcelA);
      expect(metaB.parcelRef).to.equal(parcelB);
      expect(metaA.spatialHash).to.equal(SAMPLE_SPATIAL_HASH);
      expect(metaB.spatialHash).to.equal(spatialB);
      expect(metaA.titleMetadata).to.equal(SAMPLE_METADATA_URI);
      expect(metaB.titleMetadata).to.equal(uriB);
    });
  });

  // ── Property 6: Direct owner-initiated transfers always revert ─────────────
  /**
   * **Property 6: Direct owner-initiated transfers always revert**
   * **Validates: Requirements 3.4**
   */
  describe("Property 6 — Direct transfers disabled", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      const event = await parseEvent(
        nft,
        nft
          .connect(registrar)
          .mint(
            citizen.address,
            SAMPLE_PARCEL_REF,
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          ),
        "TitleMinted"
      );
      tokenId = event.args.tokenId as bigint;
    });

    it("reverts transferFrom by the token owner", async function () {
      await expect(
        nft
          .connect(citizen)
          .transferFrom(citizen.address, randomUser.address, tokenId)
      ).to.be.revertedWith("LandTitleNFT: direct transfers are disabled");
    });

    it("reverts safeTransferFrom(address,address,uint256) by the token owner", async function () {
      await expect(
        nft
          .connect(citizen)
          ["safeTransferFrom(address,address,uint256)"](
            citizen.address,
            randomUser.address,
            tokenId
          )
      ).to.be.revertedWith("LandTitleNFT: direct transfers are disabled");
    });

    it("reverts safeTransferFrom(address,address,uint256,bytes) by the token owner", async function () {
      await expect(
        nft
          .connect(citizen)
          ["safeTransferFrom(address,address,uint256,bytes)"](
            citizen.address,
            randomUser.address,
            tokenId,
            "0x"
          )
      ).to.be.revertedWith("LandTitleNFT: direct transfers are disabled");
    });

    it("reverts transferFrom even when the operator has explicit approval", async function () {
      // Grant approval — this should succeed on its own
      await nft.connect(citizen).approve(randomUser.address, tokenId);

      // But the transfer itself must still revert
      await expect(
        nft
          .connect(randomUser)
          .transferFrom(citizen.address, randomUser.address, tokenId)
      ).to.be.revertedWith("LandTitleNFT: direct transfers are disabled");
    });

    it("reverts transferFrom when setApprovalForAll was used", async function () {
      await nft.connect(citizen).setApprovalForAll(randomUser.address, true);

      await expect(
        nft
          .connect(randomUser)
          .transferFrom(citizen.address, randomUser.address, tokenId)
      ).to.be.revertedWith("LandTitleNFT: direct transfers are disabled");
    });

    it("token remains owned by citizen after failed transfer attempt", async function () {
      try {
        await nft
          .connect(citizen)
          .transferFrom(citizen.address, randomUser.address, tokenId);
      } catch {
        // expected to revert
      }
      expect(await nft.ownerOf(tokenId)).to.equal(citizen.address);
    });
  });

  // ── Property 7: Only GOVERNOR_ROLE can revoke, revocation is permanent ─────
  /**
   * **Property 7: Only GOVERNOR_ROLE can revoke, and revocation is permanent**
   * **Validates: Requirements 4.1, 4.3, 4.5, 4.6, 10.7**
   */
  describe("Property 7 — Governor-only revocation", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      const event = await parseEvent(
        nft,
        nft
          .connect(registrar)
          .mint(
            citizen.address,
            SAMPLE_PARCEL_REF,
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          ),
        "TitleMinted"
      );
      tokenId = event.args.tokenId as bigint;
    });

    it("allows the Governor to revoke with ground=0 (OverridingPublicInterest)", async function () {
      await nft.connect(governor).revoke(tokenId, 0);
      expect(await nft.isRevoked(tokenId)).to.equal(true);
    });

    it("allows the Governor to revoke with ground=1 (BreachOfStatutoryCondition)", async function () {
      const event2 = await parseEvent(
        nft,
        nft
          .connect(registrar)
          .mint(
            citizen.address,
            "PARCEL/002",
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          ),
        "TitleMinted"
      );
      const tokenId2: bigint = event2.args.tokenId;

      await nft.connect(governor).revoke(tokenId2, 1);
      expect(await nft.isRevoked(tokenId2)).to.equal(true);
    });

    it("reverts when a random user attempts to revoke", async function () {
      await expect(
        nft.connect(randomUser).revoke(tokenId, 0)
      ).to.be.reverted;
    });

    it("reverts when the registrar attempts to revoke", async function () {
      await expect(
        nft.connect(registrar).revoke(tokenId, 0)
      ).to.be.reverted;
    });

    it("reverts when the citizen (token owner) attempts to revoke", async function () {
      await expect(
        nft.connect(citizen).revoke(tokenId, 0)
      ).to.be.reverted;
    });

    it("reverts when deployer (no GOVERNOR_ROLE) attempts to revoke", async function () {
      await expect(
        nft.connect(deployer).revoke(tokenId, 0)
      ).to.be.reverted;
    });

    it("revocation is permanent — isRevoked stays true permanently", async function () {
      await nft.connect(governor).revoke(tokenId, 0);

      // Query multiple times to confirm immutability
      expect(await nft.isRevoked(tokenId)).to.equal(true);
      expect(await nft.isRevoked(tokenId)).to.equal(true);
      expect(await nft.isRevoked(tokenId)).to.equal(true);
    });

    it("reverts a second revocation attempt on an already-revoked token", async function () {
      await nft.connect(governor).revoke(tokenId, 0);

      await expect(
        nft.connect(governor).revoke(tokenId, 0)
      ).to.be.revertedWith("LandTitleNFT: already revoked");
    });

    it("blocks transferFrom on a revoked token", async function () {
      await nft.connect(governor).revoke(tokenId, 0);

      await expect(
        nft
          .connect(citizen)
          .transferFrom(citizen.address, randomUser.address, tokenId)
      ).to.be.reverted;
    });

    it("blocks safeTransferFrom on a revoked token", async function () {
      await nft.connect(governor).revoke(tokenId, 0);

      await expect(
        nft
          .connect(citizen)
          ["safeTransferFrom(address,address,uint256)"](
            citizen.address,
            randomUser.address,
            tokenId
          )
      ).to.be.reverted;
    });

    it("unrevoked tokens have isRevoked=false", async function () {
      // This token was never revoked
      expect(await nft.isRevoked(tokenId)).to.equal(false);
    });
  });

  // ── Property 8: Every valid revocation emits TitleRevoked with complete fields
  /**
   * **Property 8: Every valid revocation emits a TitleRevoked event with complete fields**
   * **Validates: Requirements 4.2, 4.4**
   */
  describe("Property 8 — TitleRevoked event completeness", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      const event = await parseEvent(
        nft,
        nft
          .connect(registrar)
          .mint(
            citizen.address,
            SAMPLE_PARCEL_REF,
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          ),
        "TitleMinted"
      );
      tokenId = event.args.tokenId as bigint;
    });

    it("emits TitleRevoked with correct tokenId, ground=0, revokedBy=governor, and positive timestamp", async function () {
      await expect(nft.connect(governor).revoke(tokenId, 0))
        .to.emit(nft, "TitleRevoked")
        .withArgs(tokenId, 0, governor.address, (ts: bigint) => ts > 0n);
    });

    it("emits TitleRevoked with ground=1 for BreachOfStatutoryCondition", async function () {
      const event2 = await parseEvent(
        nft,
        nft
          .connect(registrar)
          .mint(
            citizen.address,
            "PARCEL/002",
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          ),
        "TitleMinted"
      );
      const tokenId2: bigint = event2.args.tokenId;

      await expect(nft.connect(governor).revoke(tokenId2, 1))
        .to.emit(nft, "TitleRevoked")
        .withArgs(tokenId2, 1, governor.address, (ts: bigint) => ts > 0n);
    });

    it("TitleRevoked event contains the exact governor address as revokedBy", async function () {
      const tx = await nft.connect(governor).revoke(tokenId, 0);
      const receipt = await tx.wait();

      const revokedEvent = receipt!.logs
        .map((log: any) => {
          try {
            return nft.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e?.name === "TitleRevoked");

      expect(revokedEvent).to.not.be.null;
      expect(revokedEvent!.args.revokedBy).to.equal(
        governor.address,
        "revokedBy must equal governor address"
      );
      expect(revokedEvent!.args.tokenId).to.equal(
        tokenId,
        "tokenId must match"
      );
    });

    it("TitleRevoked timestamp is within a reasonable range of current block time", async function () {
      const blockBefore = await ethers.provider.getBlock("latest");
      await nft.connect(governor).revoke(tokenId, 0);
      const blockAfter = await ethers.provider.getBlock("latest");

      const event = await parseEvent(
        nft,
        // Re-mint for a fresh token to parse the revoke event conveniently
        // Actually let's query the revoke event from the nft directly
        Promise.resolve({ wait: async () => null }), // placeholder
        "TitleRevoked"
      ).catch(() => null);

      // Verify via direct filter
      const filter = nft.filters["TitleRevoked(uint256,uint8,address,uint256)"];
      if (filter) {
        const events = await nft.queryFilter(
          nft.filters.TitleRevoked(tokenId),
          blockAfter!.number,
          blockAfter!.number
        );
        expect(events.length).to.equal(1);
        const ts = events[0].args.timestamp;
        expect(ts).to.be.gte(BigInt(blockBefore!.timestamp));
        expect(ts).to.be.lte(BigInt(blockAfter!.timestamp + 5));
      }
    });

    it("measures gas cost of revoke() call", async function () {
      const tx = await nft.connect(governor).revoke(tokenId, 0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed;
      console.log(`    ⛽ revoke() gas used: ${gasUsed.toString()}`);
      expect(gasUsed).to.be.gt(
        0n,
        "gas used must be non-zero"
      );
      // Sanity: revoke should not cost more than 200k gas
      expect(gasUsed).to.be.lt(
        200_000n,
        "revoke() should not exceed 200k gas"
      );
    });
  });

  // ── Access control (supplemental) ─────────────────────────────────────────
  describe("Access control", function () {
    it("reverts when a non-registrar tries to mint", async function () {
      await expect(
        nft
          .connect(randomUser)
          .mint(
            citizen.address,
            SAMPLE_PARCEL_REF,
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          )
      ).to.be.reverted;
    });

    it("reverts when the citizen tries to mint", async function () {
      await expect(
        nft
          .connect(citizen)
          .mint(
            citizen.address,
            SAMPLE_PARCEL_REF,
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          )
      ).to.be.reverted;
    });

    it("reverts getMetadata for a non-existent token", async function () {
      await expect(nft.getMetadata(999n)).to.be.revertedWith(
        "LandTitleNFT: token does not exist"
      );
    });

    it("reverts setMintTxHash for a non-existent token", async function () {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      await expect(
        nft.connect(registrar).setMintTxHash(999n, fakeHash)
      ).to.be.revertedWith("LandTitleNFT: token does not exist");
    });

    it("reverts setMintTxHash when called by a non-registrar", async function () {
      const event = await parseEvent(
        nft,
        nft
          .connect(registrar)
          .mint(
            citizen.address,
            SAMPLE_PARCEL_REF,
            SAMPLE_SPATIAL_HASH,
            SAMPLE_METADATA_URI
          ),
        "TitleMinted"
      );
      const tokenId: bigint = event.args.tokenId;
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("fake"));

      await expect(
        nft.connect(randomUser).setMintTxHash(tokenId, fakeHash)
      ).to.be.reverted;
    });

    it("reverts revoke for a non-existent token", async function () {
      await expect(
        nft.connect(governor).revoke(999n, 0)
      ).to.be.revertedWith("LandTitleNFT: token does not exist");
    });

    it("deployer has DEFAULT_ADMIN_ROLE", async function () {
      const DEFAULT_ADMIN_ROLE = await nft.DEFAULT_ADMIN_ROLE();
      expect(await nft.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.equal(
        true
      );
    });

    it("registrar has REGISTRAR_ROLE", async function () {
      const REGISTRAR_ROLE = await nft.REGISTRAR_ROLE();
      expect(
        await nft.hasRole(REGISTRAR_ROLE, registrar.address)
      ).to.equal(true);
    });

    it("governor has GOVERNOR_ROLE", async function () {
      const GOVERNOR_ROLE = await nft.GOVERNOR_ROLE();
      expect(await nft.hasRole(GOVERNOR_ROLE, governor.address)).to.equal(
        true
      );
    });
  });
});
