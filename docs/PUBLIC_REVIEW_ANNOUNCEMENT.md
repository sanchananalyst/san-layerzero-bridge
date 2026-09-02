# Public Security Review Announcement Drafts

> **PUBLICATION VERIFIED.** The recreated repository is public and GitHub
> Private Vulnerability Reporting is enabled. These drafts have not been posted
> automatically.

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
`a53a86bcc0a18934a19f2889ba61ceb1633fa359`

Review package: <https://github.com/sanchananalyst/san-layerzero-bridge>

Please follow `SECURITY.md` for private disclosure of exploitable findings. No
bug bounty is promised, and community review should not be described as a formal
audit.
