# Robinhood Mainnet Finality Policy

## Decision

Robinhood-source LayerZero confirmations remain **unapproved and fail-closed**.
No single count of fast Robinhood L2 blocks demonstrates Ethereum economic
finality. A human security decision must state which sequencer, DVN, L1-posting,
and challenge-period risks are accepted before a positive value is inserted.

## What the stages mean

1. **L2 inclusion:** Robinhood's sequencer orders a transaction into a fast L2
   block. This is useful operational evidence, not Ethereum finality.
2. **Sequencer behavior and L2 reorgs:** prior to durable L1 anchoring, the
   security assumption includes sequencer ordering/availability and the Nitro
   node model. More L2 blocks mainly add soft depth under that model.
3. **Posting to Ethereum:** Nitro batches L2 transaction data/state commitments
   to L1 asynchronously. An L2 block's exposed `l1BlockNumber` alone does not
   prove that its batch was posted or finalized.
4. **Ethereum safe/finalized:** after posting, L1 consensus safe/finalized status
   is a separate clock. It must be observed through the rollup/DVN system, not
   approximated by an L2-block count.
5. **Optimistic challenge:** L1 posting/finality does not erase the optimistic
   fraud-proof/challenge model. The withdrawal/challenge horizon is materially
   longer than ordinary messaging latency.
6. **LayerZero confirmations:** ULN `confirmations` is a source-chain block-depth
   value used by DVNs before verification. It does not itself express “wait for
   this Nitro batch to be L1 posted, Ethereum-finalized, and challenge-complete.”

Official references: [Robinhood Chain overview](https://docs.robinhood.com/chain/),
[connecting](https://docs.robinhood.com/chain/connecting/),
[full node](https://docs.robinhood.com/chain/run-a-full-node/),
[bridging](https://docs.robinhood.com/chain/bridging/),
[Arbitrum Nitro whitepaper](https://docs.arbitrum.io/nitro-whitepaper.pdf),
[Ethereum Gasper/finality](https://ethereum.org/developers/docs/consensus-mechanisms/pos/gasper/),
and [LayerZero production DVN guidance](https://docs.layerzero.network/v2/concepts/modular-security/production-dvn-configuration).

## Candidate depths and observed latency

Read-only RPC sampling near Robinhood block 51,910,050 observed approximately
0.10 seconds per L2 block. Conditions can change; these are measurements, not
SLAs.

| Candidate | Approximate sampled L2 delay | Security interpretation                                           |
| --------: | ---------------------------: | ----------------------------------------------------------------- |
|        32 |                    4 seconds | shallow soft confirmation only                                    |
|        64 |                    7 seconds | deeper soft confirmation only                                     |
|       128 |                   13 seconds | preferred provisional soft-depth candidate, still not L1 finality |
|     1,000 |                  102 seconds | still not a semantic proof of batch posting/finality              |
|    10,000 |                1,010 seconds | still not the fraud-proof challenge period                        |

If governance explicitly accepts a sequencer/DVN soft-confirmation security
model, `128` is the recommended provisional LayerZero value because its small
latency cost materially exceeds 32/64 in L2 depth. It remains unapproved here.
If policy instead requires L1 posting/finalized or challenge-complete semantics,
the requirement must be implemented and monitored outside the numeric
confirmation field or confirmed as a supported DVN behavior. The production
checker therefore requires an explicit non-null approved value and currently
rejects configuration.
