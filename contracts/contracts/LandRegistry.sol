// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./LandTitleNFT.sol";

/**
 * @title LandRegistry
 * @notice Registry-controlled ownership transfer contract for the Anagu Land
 *         Administration Framework.
 *
 *         Because LandTitleNFT disables all direct (peer-to-peer) ERC-721
 *         transfers, the only legitimate way to move a title to a new owner is
 *         through this contract.  It burns the existing token and mints a fresh
 *         one preserving the parcel metadata.
 *
 * Requirements: 3.4, 3.5
 */
contract LandRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    /// @notice Immutable reference to the LandTitleNFT contract.
    LandTitleNFT public immutable titleNFT;

    // ─── Events ──────────────────────────────────────────────────────────────
    event RegistryTransfer(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(address landTitleNFTAddress, address registrarAddress) {
        titleNFT = LandTitleNFT(landTitleNFTAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, registrarAddress);
    }

    // ─── Registry-controlled transfer ────────────────────────────────────────
    /**
     * @notice Transfer ownership of a land title to a new address.
     *
     *         The old token is burned and a new token is minted to `to`,
     *         preserving the original parcelRef, spatialHash, and titleMetadata.
     *
     * @param tokenId Existing token to transfer.
     * @param from    Current owner address (informational — used in the event).
     * @param to      New owner address.
     *
     * Requirements: 3.5
     */
    function registryTransfer(
        uint256 tokenId,
        address from,
        address to
    ) external onlyRole(REGISTRAR_ROLE) {
        require(!titleNFT.isRevoked(tokenId), "LandRegistry: token is revoked");

        // Read metadata before burning
        LandTitleNFT.TitleMetadata memory meta = titleNFT.getMetadata(tokenId);

        // Burn the existing token
        titleNFT.registryBurn(tokenId);

        // Mint a fresh token to the new owner with the same parcel data
        uint256 newTokenId = titleNFT.mint(
            to,
            meta.parcelRef,
            meta.spatialHash,
            meta.titleMetadata
        );

        emit RegistryTransfer(newTokenId, from, to, block.timestamp);
    }
}
