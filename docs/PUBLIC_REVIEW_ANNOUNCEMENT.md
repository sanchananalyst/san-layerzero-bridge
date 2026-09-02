# Public Security Review Announcement Drafts

> **DO NOT PUBLISH YET.** The GitHub repository remains private because the
> responsible-disclosure contact is unresolved. Use these drafts only after the
> repository visibility is independently verified as public and the security
> contact has replaced the placeholder in `SECURITY.md`.

## Short X/Twitter draft

We're open-sourcing the proposed $SAN Solana ↔ Robinhood Chain LayerZero bridge
before mainnet deployment.

The full testnet lock → mint → burn → unlock round trip is complete.

No canonical SAN mainnet bridge is live yet.

We're inviting Solana, LayerZero, EVM, and security developers to review the
implementation before real SAN is put at risk.

GitHub: <https://github.com/sanchananalyst/san-layerzero-bridge>

Community review is not a formal audit. Potentially exploitable findings should
be reported privately through the repository's security policy.

## Technical community draft

The proposed SAN LayerZero V2 bridge implementation is ready for pre-mainnet
technical review.

Architecture:

- canonical six-decimal legacy SPL SAN remains on Solana;
- the official Solana OFT Adapter locks/unlocks canonical SAN;
- a non-upgradeable Robinhood `SanOFT` burns on send and credits only through
  LayerZero's authenticated receive path; and
- the principal invariant is `Robinhood supply <= OFTStore.tvl_ld <= Solana SAN
escrow balance`, accounting explicitly for in-flight messages.

A separate tSAN environment completed the complete Solana Devnet → Robinhood
Testnet → Solana Devnet round trip. No canonical SAN mainnet bridge is deployed
or active.

Review priorities include Adapter escrow constraints and `withdraw_fee`,
Endpoint/peer/replay authentication, ULN/DVN configuration, decimal conversion,
EVM pause/rate-limit hooks, arbitrary-mint resistance, four-direction limiter
coverage, upgrade/governance authorities, and fail-closed deployment tooling.

Audit candidate:
`f5e0c819f85db394e719f3948c1c101b94a3c37c`

Review package: <https://github.com/sanchananalyst/san-layerzero-bridge>

Please follow `SECURITY.md` for private disclosure of exploitable findings. No
bug bounty is promised, and community review should not be described as a formal
audit.
