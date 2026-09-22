/**
 * Hardhat tests for LandRegistry — registry-controlled transfer
 *
 * Validates: Requirements 3.4, 3.5
 *
 * Tests:
 *  - Deploy both LandTitleNFT and LandRegistry
 *  - Mint a token; verify direct transfer reverts
 *  - registryTransfer accessible to REGISTRAR_ROLE
 *  - registryTransfer reverts on revoked token
 *  - registryTransfer emits RegistryTransfer with expected fields
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { LandTitleNFT, LandRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function parseTitleMinted(nft: LandTitleNFT, txPromise: Promise<any>) {
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
    .find((e: any) => e?.name === "TitleMinted");
  if (!parsed) throw new Error("TitleMinted event not found");
  return parsed.args.tokenId as bigint;
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const PARCEL_REF = "ABUJA/2024/REG/001";
const SPATIAL_HASH = ethers.keccak256(
  ethers.toUtf8Bytes("POLYGON((7.4 9.0,7.5 9.0,7.5 9.1,7.4 9.1,7.4 9.0))")
);
const METADATA_URI = "ipfs://QmRegistryTestHash";

// ──────────────────────────────────────────────────────────────────────────────
// Suite
// ──────────────────────────────────────────────────────────────────────────────

describe("LandRegistry", function () {
  let nft: LandTitleNFT;
  let registry: LandRegistry;
  let deployer: HardhatEthersSigner;
  let registrar: HardhatEthersSigner;
  let governor: HardhatEthersSigner;
  let citizen: HardhatEthersSigner;
  let newOwner: HardhatEthersSigner;
  let randomUser: HardhatEthersSigner;

  beforeEach(async function () {
    [deployer, registrar, governor, citizen, newOwner, randomUser] =
      await ethers.getSigners();

    // Deploy LandTitleNFT
    const LandTitleNFTFactory =
      await ethers.getContractFactory("LandTitleNFT");
    nft = (await LandTitleNFTFactory.deploy(
      registrar.address,
      governor.address
    )) as LandTitleNFT;
    await nft.waitForDeployment();

    // Deploy LandRegistry (registrar has REGISTRAR_ROLE on the registry too)
    const LandRegistryFactory =
      await ethers.getContractFactory("LandRegistry");
    registry = (await LandRegistryFactory.deploy(
      await nft.getAddress(),
      registrar.address
    )) as LandRegistry;
    await registry.waitForDeployment();

    // Grant REGISTRAR_ROLE on the NFT to the LandRegistry contract address
    // so LandRegistry can call mint() and registryBurn() on the NFT.
    const REGISTRAR_ROLE = await nft.REGISTRAR_ROLE();
    await nft
      .connect(deployer)
      .grantRole(REGISTRAR_ROLE, await registry.getAddress());
  });

  // ── Deployment sanity ──────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("LandRegistry holds the correct titleNFT reference", async function () {
      expect(await registry.titleNFT()).to.equal(await nft.getAddress());
    });

    it("LandRegistry is deployed to a valid contract address", async function () {
      expect(await registry.getAddress()).to.match(/^0x[0-9a-fA-F]{40}$/);
    });

    it("registrar has REGISTRAR_ROLE on the registry contract", async function () {
      const REGISTRAR_ROLE = await registry.REGISTRAR_ROLE();
      expect(
        await registry.hasRole(REGISTRAR_ROLE, registrar.address)
      ).to.equal(true);
    });

    it("LandRegistry contract has REGISTRAR_ROLE on the NFT", async function () {
      const REGISTRAR_ROLE = await nft.REGISTRAR_ROLE();
      expect(
        await nft.hasRole(REGISTRAR_ROLE, await registry.getAddress())
      ).to.equal(true);
    });
  });

  // ── Direct transfer blocked (Requirement 3.4) ──────────────────────────────
  describe("Direct transfers remain blocked", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      tokenId = await parseTitleMinted(
        nft,
        nft
          .connect(registrar)
          .mint(citizen.address, PARCEL_REF, SPATIAL_HASH, METADATA_URI)
      );
    });

    it("reverts a direct transferFrom even with LandRegistry in the picture", async function () {
      await expect(
        nft
          .connect(citizen)
          .transferFrom(citizen.address, newOwner.address, tokenId)
      ).to.be.revertedWith("LandTitleNFT: direct transfers are disabled");
    });

    it("citizen cannot bypass the lock via safeTransferFrom", async function () {
      await expect(
        nft
          .connect(citizen)
          ["safeTransferFrom(address,address,uint256)"](
            citizen.address,
            newOwner.address,
            tokenId
          )
      ).to.be.revertedWith("LandTitleNFT: direct transfers are disabled");
    });
  });

  // ── registryTransfer — happy path (Requirement 3.5) ───────────────────────
  describe("registryTransfer — happy path", function () {
    let originalTokenId: bigint;

    beforeEach(async function () {
      originalTokenId = await parseTitleMinted(
        nft,
        nft
          .connect(registrar)
          .mint(citizen.address, PARCEL_REF, SPATIAL_HASH, METADATA_URI)
      );
    });

    it("registrar can call registryTransfer successfully", async function () {
      await expect(
        registry
          .connect(registrar)
          .registryTransfer(
            originalTokenId,
            citizen.address,
            newOwner.address
          )
      ).to.not.be.reverted;
    });

    it("new owner receives a fresh token after registryTransfer", async function () {
      const tx = await registry
        .connect(registrar)
        .registryTransfer(
          originalTokenId,
          citizen.address,
          newOwner.address
        );
      const receipt = await tx.wait();

      // Parse RegistryTransfer event to get the new token ID
      const transferEvent = receipt!.logs
        .map((log: any) => {
          try {
            return registry.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e?.name === "RegistryTransfer");

      expect(transferEvent).to.not.be.null;
      const newTokenId: bigint = transferEvent!.args.tokenId;
      expect(await nft.ownerOf(newTokenId)).to.equal(newOwner.address);
    });

    it("old token is burned after registryTransfer", async function () {
      await registry
        .connect(registrar)
        .registryTransfer(
          originalTokenId,
          citizen.address,
          newOwner.address
        );

      // The original token no longer exists
      await expect(nft.ownerOf(originalTokenId)).to.be.reverted;
    });

    it("new token preserves parcelRef from original token", async function () {
      const tx = await registry
        .connect(registrar)
        .registryTransfer(
          originalTokenId,
          citizen.address,
          newOwner.address
        );
      const receipt = await tx.wait();

      const transferEvent = receipt!.logs
        .map((log: any) => {
          try {
            return registry.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e?.name === "RegistryTransfer");

      const newTokenId: bigint = transferEvent!.args.tokenId;
      const metadata = await nft.getMetadata(newTokenId);
      expect(metadata.parcelRef).to.equal(PARCEL_REF);
      expect(metadata.spatialHash).to.equal(SPATIAL_HASH);
      expect(metadata.titleMetadata).to.equal(METADATA_URI);
    });

    it("emits RegistryTransfer with correct from, to, and positive timestamp", async function () {
      await expect(
        registry
          .connect(registrar)
          .registryTransfer(
            originalTokenId,
            citizen.address,
            newOwner.address
          )
      )
        .to.emit(registry, "RegistryTransfer")
        .withArgs(
          (id: bigint) => id > 0n,   // new token ID
          citizen.address,
          newOwner.address,
          (ts: bigint) => ts > 0n    // timestamp
        );
    });
  });

  // ── registryTransfer — revoked token (Requirement 4.1, 4.6) ───────────────
  describe("registryTransfer — revoked token", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      tokenId = await parseTitleMinted(
        nft,
        nft
          .connect(registrar)
          .mint(citizen.address, PARCEL_REF, SPATIAL_HASH, METADATA_URI)
      );
      // Revoke the token before attempting registry transfer
      await nft.connect(governor).revoke(tokenId, 0);
    });

    it("reverts registryTransfer on a revoked token", async function () {
      await expect(
        registry
          .connect(registrar)
          .registryTransfer(tokenId, citizen.address, newOwner.address)
      ).to.be.revertedWith("LandRegistry: token is revoked");
    });

    it("newOwner does not receive any token when transfer is blocked", async function () {
      const balanceBefore = await nft.balanceOf(newOwner.address);

      try {
        await registry
          .connect(registrar)
          .registryTransfer(tokenId, citizen.address, newOwner.address);
      } catch {
        // expected revert
      }

      const balanceAfter = await nft.balanceOf(newOwner.address);
      expect(balanceAfter).to.equal(
        balanceBefore,
        "newOwner balance must not change on reverted transfer"
      );
    });
  });

  // ── registryTransfer — access control ─────────────────────────────────────
  describe("registryTransfer — access control", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      tokenId = await parseTitleMinted(
        nft,
        nft
          .connect(registrar)
          .mint(citizen.address, PARCEL_REF, SPATIAL_HASH, METADATA_URI)
      );
    });

    it("reverts when a random user attempts registryTransfer", async function () {
      await expect(
        registry
          .connect(randomUser)
          .registryTransfer(tokenId, citizen.address, newOwner.address)
      ).to.be.reverted;
    });

    it("reverts when the citizen (token owner) attempts registryTransfer", async function () {
      await expect(
        registry
          .connect(citizen)
          .registryTransfer(tokenId, citizen.address, newOwner.address)
      ).to.be.reverted;
    });

    it("reverts when the governor attempts registryTransfer", async function () {
      await expect(
        registry
          .connect(governor)
          .registryTransfer(tokenId, citizen.address, newOwner.address)
      ).to.be.reverted;
    });
  });
});
