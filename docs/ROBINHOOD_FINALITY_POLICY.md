# Robinhood Mainnet Source-Confirmation Policy

## Frozen Phase 5A.4 policy

The approved/proposed production pathway policy is:

| Source pathway            | Source-chain confirmations |
| ------------------------- | -------------------------: |
| Robinhood Chain to Solana | **30 Robinhood L2 blocks** |
| Solana to Robinhood Chain |       **32 Solana blocks** |

The word “confirmations” here has LayerZero ULN's source-chain block-depth
meaning. **Thirty Robinhood confirmations are L2 block-depth/reorg mitigation;
they are not Ethereum finality, Nitro challenge-period completion, or a
guarantee that the relevant batch has been posted to and finalized on
Ethereum.** This policy must never be described as “finality guaranteed.”

## Empirical basis

The read-only study in `ROBINHOOD_FINALITY_EVIDENCE.md` sampled 1,024 contiguous
Robinhood mainnet blocks and ten consecutive Nitro batches. In that sample:

- 30 L2 confirmations took approximately 3 seconds median and 4 seconds p95;
- L2-to-Ethereum batch posting took approximately 23.5 minutes median; and
- L2-to-observed Ethereum finality took approximately 40.3 minutes median.

The large difference between seconds of L2 depth and tens of minutes of
observed L1 settlement is the central limitation. The 30-block value is a
deliberate low-latency L2 source-depth choice supported by the observed sample;
it is not a substitute for L1-aware risk controls. Measurements are not an SLA
and must be refreshed when chain or DVN behavior changes.

## Security interpretation

More fast L2 blocks add mechanical depth against shallow Robinhood reorgs under
the current sequencer/node model. They do not prove that the corresponding
Nitro batch is available on L1, that an assertion is Ethereum-finalized, or that
the optimistic dispute horizon has elapsed. LayerZero DVNs independently decide
when their verification conditions are met; the repository does not prove that
each DVN maps `30` to the same L1-aware settlement semantics.

The policy therefore retains these residual assumptions:

- Robinhood sequencer correctness and availability;
- Robinhood L2 reorg behavior, including depths absent from the sample;
- timely and correct Nitro batch posting;
- Ethereum consensus and finality after posting;
- rollup state correctness and the optimistic challenge process;
- independent, correct LayerZero Labs, Nethermind, and Horizen DVN behavior;
- uncompromised governance and exact configuration execution;
- complete monitoring of delivery, reorg, posting, accounting, and liveness;
- a timely pause response before the applicable bucket can be exhausted.

The pathway uses 2-of-3 DVNs to reduce reliance on one verifier, but correlated
DVN, sequencer, rollup, governance, or monitoring failures remain possible.

## Operational requirements

The production checker must observe exact explicit ULN settings: Robinhood send
and Solana receive use 30; Solana send and Robinhood receive use 32. Missing,
inherited, reversed, or different values fail closed. Activation remains blocked
until independent reviewers accept the limitations above, current metadata and
DVN contracts are rechecked, monitoring/pause procedures are staffed, and all
other Phase 5B gates pass.

Official background references and the reproducible measurement method are
listed in `ROBINHOOD_FINALITY_EVIDENCE.md`.
