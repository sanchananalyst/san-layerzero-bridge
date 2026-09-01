# Solana OFT Adapter Runtime Security Tests

## Result

The Phase 3.5 runtime suite passes **8/8 tests** against a real local `solana-test-validator`. It deploys the repository's actual OFT program and a test-only Endpoint mock, creates a fresh six-decimal legacy SPL mint, and executes real Anchor instructions and SPL Token CPIs. It never uses the canonical SAN mint and never connects to mainnet.

Command:

```bash
pnpm test:anchor
```

The ignored local test wallet is generated at `target/deploy/local-runtime-test-wallet.json` with mode `0600`. It is not a production identity and is never logged.

## Runtime coverage

| Behavior                | Executed assertion                                                                                                                     | Result |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Adapter initialization  | Adapter OFT Store and escrow initialize; escrow authority is the Store PDA; mint and freeze authorities remain byte-for-byte unchanged | pass   |
| Outbound debit          | holder decreases, escrow increases, and `tvl_ld` increases by the same `X`                                                             | pass   |
| Unauthorized debit      | another signer cannot debit the holder                                                                                                 | pass   |
| Surplus withdrawal      | exact `escrow.amount - tvl_ld` surplus is withdrawable                                                                                 | pass   |
| Principal protection    | one unit of accounted TVL cannot be withdrawn                                                                                          | pass   |
| Unauthorized withdrawal | non-admin fails                                                                                                                        | pass   |
| Authenticated credit    | committed Endpoint message reduces escrow and TVL and credits recipient by `X`                                                         | pass   |
| Wrong peer              | fails atomically with no escrow release                                                                                                | pass   |
| Wrong Endpoint          | direct/unauthorized receive fails with no escrow release                                                                               | pass   |
| Malformed message       | fails atomically with no escrow release                                                                                                | pass   |
| Replay                  | consumed Endpoint commitment cannot be reused                                                                                          | pass   |
| Pause                   | quote/send and inbound receive fail while paused                                                                                       | pass   |
| Callable while paused   | `withdraw_fee` remains callable, but only for surplus and only by admin                                                                | pass   |
| Outbound limiter        | below-capacity send succeeds; above-capacity send fails; refill restores capacity                                                      | pass   |
| Inbound limiter         | below-capacity credit succeeds; above-capacity credit fails; refill restores capacity                                                  | pass   |
| Custody invariant       | `escrow.amount >= tvl_ld` after every successful custody-relevant transaction                                                          | pass   |

## Endpoint mock boundary

The test-only Endpoint program is CPI compatible with the OFT's `send` and `clear` calls. Its administrator/delegate first commits the hash and exact origin, peer, nonce, GUID, and payload; `clear` then requires the OFT Store signer and an exact commitment match and consumes the commitment. This exercises the actual OFT authentication boundary, peer validation, CPI, token transfer, accounting, rollback, and replay behavior.

It does **not** reproduce DVN cryptography, Executor operation, real Endpoint state layout, network ordering, or cross-chain delivery. Those remain integration-test and operational-validation work for an explicitly authorized non-production deployment.

## Pause behavior

The installed OFT implementation checks the global pause flag for outbound quote/send and inbound receive, so both directions halt. Administrative configuration remains callable according to its own authority checks. `withdraw_fee` does not consult the pause flag; it remains available to the OFT Store admin but its arithmetic restricts withdrawal to unaccounted surplus. Incident procedures must not assume pause disables fee withdrawal.
