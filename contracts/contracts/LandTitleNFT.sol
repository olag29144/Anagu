// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title LandTitleNFT
 * @notice ERC-721 land title token for the Anagu Land Administration Framework.
 *
 * Key design decisions:
 *  - Only addresses holding REGISTRAR_ROLE may mint or update the mint-tx hash.
 *  - Only addresses holding GOVERNOR_ROLE may revoke a title under the
 *    Nigerian Land Use Act (1978) Section 28.
 *  - All peer-to-peer ERC-721 transfers are disabled; ownership can only change
 *    through the LandRegistry contract (which burns and re-mints).
 *  - A revoked token can never be transferred.
 */
contract LandTitleNFT is ERC721, ERC721Burnable, AccessControl {
    using Counters for Counters.Counter;

    // -----------------------------------------------------------------------
    // Roles
    // -----------------------------------------------------------------------

    bytes32 public constant GOVERNOR_ROLE  = keccak256("GOVERNOR_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    // -----------------------------------------------------------------------
    // Token ID counter
    // -----------------------------------------------------------------------

    Counters.Counter private _tokenIds;

    // -----------------------------------------------------------------------
    // Types
    // -----------------------------------------------------------------------

    /**
     * @notice Grounds for statutory revocation under the Land Use Act.
     * @dev Maps 1-to-1 to the RevocationGround enum in the NestJS backend.
     */
    enum RevocationGround {
        OverridingPublicInterest,      // 0
        BreachOfStatutoryCondition     // 1
    }

    /**
     * @notice On-chain metadata stored per minted land title.
     * @dev All five fields must be populated. `mintTxHash` is set after
     *      mining via a separate `setMintTxHash()` call because the
     *      transaction hash is not available inside the mint transaction itself.
     */
    struct TitleMetadata {
        string  parcelRef;      // Off-chain parcel identifier (e.g. "ABUJA/2024/001")
        bytes32 mintTxHash;     // keccak256 of the mint transaction hash (set post-mine)
        bytes32 spatialHash;    // keccak256 of the WKT geometry string
        string  titleMetadata;  // IPFS CID or metadata URI
    }

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    /// @notice Whether a given token has been statutorily revoked.
    mapping(uint256 => bool) public isRevoked;

    /// @dev Full metadata for each token; not externally enumerable by design.
    mapping(uint256 => TitleMetadata) private _metadata;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    /**
     * @notice Emitted when a new land title NFT is minted.
     * @param tokenId   The newly assigned token identifier.
     * @param owner     The address that received the token.
     * @param parcelRef The off-chain parcel reference string.
     * @param timestamp block.timestamp at mint time.
     */
    event TitleMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string  parcelRef,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a land title is revoked by the Governor.
     * @param tokenId   The revoked token identifier.
     * @param ground    The statutory ground for revocation.
     * @param revokedBy The address of the Governor who invoked revocation.
     * @param timestamp block.timestamp at revocation time.
     */
    event TitleRevoked(
        uint256 indexed tokenId,
        RevocationGround ground,
        address indexed revokedBy,
        uint256 timestamp
    );

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /**
     * @param registrarAddress Address that will hold REGISTRAR_ROLE (the NestJS backend wallet).
     * @param governorAddress  Address that will hold GOVERNOR_ROLE  (the Governor's wallet).
     */
    constructor(address registrarAddress, address governorAddress)
        ERC721("AnaguLandTitle", "ALT")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE,    registrarAddress);
        _grantRole(GOVERNOR_ROLE,     governorAddress);
    }

    // -----------------------------------------------------------------------
    // Minting
    // -----------------------------------------------------------------------

    /**
     * @notice Mint a new land title NFT.
     * @dev Restricted to REGISTRAR_ROLE.  `mintTxHash` is intentionally left
     *      as bytes32(0) here and must be set separately via `setMintTxHash()`
     *      once the calling transaction is confirmed and its hash is known.
     *
     * @param to            Recipient address (the titleholder's wallet).
     * @param parcelRef     Off-chain parcel reference string.
     * @param spatialHash   keccak256 of the WKT polygon geometry.
     * @param titleMetadata IPFS CID or metadata URI.
     * @return tokenId      The newly assigned ERC-721 token identifier.
     */
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
            mintTxHash:    bytes32(0),   // populated post-mine via setMintTxHash()
            spatialHash:   spatialHash,
            titleMetadata: titleMetadata
        });

        emit TitleMinted(tokenId, to, parcelRef, block.timestamp);
        return tokenId;
    }

    // -----------------------------------------------------------------------
    // Post-mint tx hash update
    // -----------------------------------------------------------------------

    /**
     * @notice Record the mint transaction hash once it is confirmed on-chain.
     * @dev Restricted to REGISTRAR_ROLE.  Called by the NestJS BlockchainService
     *      after `mintTitle()` receives the transaction receipt.
     *
     * @param tokenId The token whose mint hash to set.
     * @param txHash  The bytes32-encoded mint transaction hash.
     */
    function setMintTxHash(uint256 tokenId, bytes32 txHash)
        external
        onlyRole(REGISTRAR_ROLE)
    {
        require(_exists(tokenId), "LandTitleNFT: token does not exist");
        _metadata[tokenId].mintTxHash = txHash;
    }

    // -----------------------------------------------------------------------
    // Revocation
    // -----------------------------------------------------------------------

    /**
     * @notice Statutorily revoke a land title under the Land Use Act (1978) s.28.
     * @dev Restricted to GOVERNOR_ROLE.  Revocation is permanent — the flag can
     *      never be cleared.  The on-chain `TitleRevoked` event serves as the
     *      distinct immutable revocation record.
     *
     * @param tokenId The token to revoke.
     * @param ground  The statutory ground for revocation.
     */
    function revoke(uint256 tokenId, RevocationGround ground)
        external
        onlyRole(GOVERNOR_ROLE)
    {
        require(_exists(tokenId),    "LandTitleNFT: token does not exist");
        require(!isRevoked[tokenId], "LandTitleNFT: already revoked");

        isRevoked[tokenId] = true;
        emit TitleRevoked(tokenId, ground, msg.sender, block.timestamp);
    }

    // -----------------------------------------------------------------------
    // Metadata read
    // -----------------------------------------------------------------------

    /**
     * @notice Return all on-chain metadata for a given token.
     * @param tokenId The token to query.
     * @return metadata The `TitleMetadata` struct for that token.
     */
    function getMetadata(uint256 tokenId)
        external
        view
        returns (TitleMetadata memory)
    {
        require(_exists(tokenId), "LandTitleNFT: token does not exist");
        return _metadata[tokenId];
    }

    // -----------------------------------------------------------------------
    // Registrar burn (used by LandRegistry for registry-controlled transfer)
    // -----------------------------------------------------------------------

    /**
     * @notice Burn a token on behalf of the registry.
     * @dev Restricted to REGISTRAR_ROLE. Called by LandRegistry before re-minting
     *      under a new owner. Bypasses the ERC721Burnable owner-check.
     *
     * @param tokenId The token to burn.
     */
    function registryBurn(uint256 tokenId)
        external
        onlyRole(REGISTRAR_ROLE)
    {
        require(_exists(tokenId), "LandTitleNFT: token does not exist");
        _burn(tokenId);
    }

    // -----------------------------------------------------------------------
    // Transfer lock
    // -----------------------------------------------------------------------

    /**
     * @notice Block all direct ERC-721 transfers.
     * @dev Minting (from == address(0)) is still permitted.  Any other transfer
     *      attempt — including transfers of revoked tokens — is reverted here.
     *      Legitimate ownership changes go through LandRegistry, which burns
     *      the old token and mints a new one.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        // Allow minting (from == address(0)) and registry burns (to == address(0)).
        // Revert all peer-to-peer transfers.
        if (from != address(0) && to != address(0)) {
            revert("LandTitleNFT: direct transfers are disabled");
        }

        // Block minting of an already-revoked token (edge-case safety)
        if (from == address(0)) {
            require(!isRevoked[tokenId], "LandTitleNFT: token is revoked");
        }

        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // -----------------------------------------------------------------------
    // Interface support
    // -----------------------------------------------------------------------

    /**
     * @notice Declare support for ERC-721 and AccessControl interfaces.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
