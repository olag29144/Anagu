# Fraud scenario evaluation fixtures

The fraud endpoints execute at least 20 trials and count detections from the
verification results. Scenarios 1 and 3 use a deterministic institutional
record fixture to test document-number and owner-name mismatches against the
same Oracle rules used for normal verification. The baseline receives complete
documents and performs its documented presence-only checks.

Scenarios 2 and 4 require operator-prepared fixtures and fail explicitly if
they are absent:

- `FRAUD_SCENARIO_OVERLAP_RING` — JSON array of `[longitude, latitude]` pairs
  for a valid polygon that overlaps a registered parcel.
- `FRAUD_SCENARIO_OVERLAP_PARCEL_ID` — ID of the registered parcel expected
  to be reported as the conflict.
- `FRAUD_SCENARIO_REVOKED_TOKEN_ID` — ID of an existing, already-revoked NFT.

Scenario 2 calls the spatial verifier against the configured ring and verifies
that each trial reports the expected parcel. Scenario 4 reads the on-chain
revocation flag and performs read-only `eth_call` transfer simulations; it does
not revoke tokens or submit transactions. Prepare these fixtures in a
non-production environment before running those scenarios. The values in
scenario results are only as representative as the configured data and the
institutional source implementation.

## Storage report

`GET /evaluation/storage?tokenId=<existing-token>&parcels=1000` reads the
selected token's metadata, owner, and revocation flag from the configured
contract. The oracle field is measured as the UTF-8 byte length of its metadata
URI. `S_time` is reported as zero because the contract emits timestamps in
events but does not store a per-title timestamp. The proposed byte total is a
sum of these field payload widths; it is not EVM storage-slot or gas accounting.
The baseline is an estimate based on ten representative WKT strings plus fixed
owner, timestamp, and identifier widths, so its reduction percentage is an
estimate rather than a chain measurement.
