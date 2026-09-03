# Robinhood Chain Finality and Reorg Evidence

## 1. Executive summary

This study supports **30 Robinhood Chain source confirmations as a reasonable
soft source-reorg mitigation**, not as Ethereum settlement finality. It is the
top of LayerZero's generic `15-30` range for optimistic L2s and, in the sampled
window, cost a median `3 seconds` (`p95 4 seconds`). Thirty blocks therefore add
meaningful canonical-chain depth at negligible latency compared with 15 blocks,
but the evidence does not establish a reorg-depth probability or a security
threshold at exactly 30.

The public Robinhood RPC exposed very fast canonical blocks. Across 1,024
contiguous mainnet blocks (`53,482,427` through `53,483,450`), the 1,023
timestamp differences had a mean of `0.1017 seconds`, median `0 seconds`, and
`p95 1 second`. The median is zero because the RPC timestamps have one-second
resolution: 919 adjacent pairs shared a timestamp and 104 advanced by one
second. The elapsed span, 104 seconds over 1,023 intervals, is the more useful
rate measurement.

No reorg was directly observed. All 1,023 parent links were coherent, all 1,024
block hashes and parent hashes matched when re-read later in the collection,
and 12 sampled transaction receipts still referred to the expected block hash.
This is **indirect evidence of short-window stability only**. A canonical RPC
normally forgets displaced history, and the explorer does not document fork
retention or completeness, so this study cannot determine Robinhood's
historical reorg frequency or depth.

Ten consecutive Nitro batch records were associated with Ethereum blob
transactions using the Robinhood Blockscout explorer and then verified through
Ethereum JSON-RPC. From each batch's final L2 block timestamp to its Ethereum
posting block was `23m11s-23m50s` (median `23m30.5s`). Ethereum's `finalized`
tag passed all ten posting blocks `15m32s-18m08s` after their L1 block
timestamps (median `16m37.7s`, observed with a 12-second poll interval). The
combined final-L2-block-to-observed-L1-finality delay was `39m12s-41m20s`
(median `40m17.7s`). These are a single time-window sample, not service-level
guarantees.

The conclusion is deliberately narrow:

- `30` protects against shallow changes to the currently exposed Robinhood
  canonical chain by delaying DVN verification by 30 L2 blocks.
- `30` does not prove batch posting, Ethereum finality, rollup state correctness,
  or completion of Robinhood's approximately seven-day optimistic challenge
  period.
- Moving to `50` added about 2 median seconds; moving to `128` added about 10
  median seconds. Both buy more mechanical depth cheaply, but the available
  evidence is insufficient to quantify a material reduction in reorg risk or
  to show that either is required.
- The proposed 2-of-3 DVNs, rate limit, and multisig pause are independent
  defense-in-depth controls. They do not convert L2 block depth into L1
  finality, and correlated RPC/sequencer assumptions can affect multiple DVNs.

This evidence task did not approve or alter production configuration. The
repository's unresolved/fail-closed setting remains unchanged pending human
security approval.

## 2. Scope and methodology

The work was performed on branch `security/robinhood-finality-evidence`. The
repository names commit `d28762288bb5180ff292f57eef7132191f2037ec` as the
production audit target. At the start of this study, the working branch was
clean and based on `security/phase5a3-evidence-hardening` at
`89faecf30f...`.

Repository review found:

- `scripts/layerZeroConfigPolicy.ts` deliberately keeps
  `robinhoodSourceConfirmations: null`, so production validation fails closed;
- the planned Robinhood security stack is three optional DVNs with threshold
  two (any two of three), not three independent finality mechanisms;
- the normal-operation rate-limit proposal is a 50,000,000 SAN token bucket per
  86,400 seconds; and
- the existing finality policy correctly warns that L2 block depth is not L1
  finality, but it lacked the empirical measurements in this report.

All chain interactions were read-only. No account, wallet, private key, signing
method, transaction-submission method, contract write, deployment, or
configuration write was used.

### L2 canonical sample

At collection start, `latest`, `safe`, and `finalized` were queried from the
official Robinhood public RPC. The historical sample ended 256 blocks behind
the returned `latest` head to avoid sampling the moving edge. The collector
then:

1. requested 1,024 consecutive blocks with `eth_getBlockByNumber`;
2. retained number, timestamp, hash, parent hash, transaction count, one
   transaction hash, exposed `l1BlockNumber`, and retrieval time;
3. checked every consecutive parent relationship;
4. obtained receipts for 12 evenly spaced transaction-bearing blocks;
5. re-requested all 1,024 block numbers and compared hash and parent hash; and
6. queried a second public RPC for a contemporaneous-head sanity check.

Confirmation latency at depth `d` is
`timestamp(block N + d) - timestamp(block N)`. This uses the chain's exposed
timestamps, not collector wall-clock latency. Each possible sliding window was
used; therefore the number of observations is `1,024 - d`. “Thirty
confirmations” in the latency table means 30 subsequent L2 blocks after the
subject block.

### Batch and Ethereum sample

At `2026-09-03T14:31:56.098Z`, the explorer showed ten consecutive batches
(`184411-184420`) as `Unfinalized` and exposed each batch's L1 block, blob
transaction, and L2 block count. The batch pages' block lists established a
contiguous L2 range. Boundary blocks and ten representative end-block receipts
were then verified through Robinhood RPC.

The ten Ethereum transactions and receipts, their L1 blocks, and the Ethereum
`finalized` tag were queried directly. The tag was polled every 12 seconds from
`2026-09-03T14:38:23.642Z` until it advanced past all posting blocks at
`2026-09-03T14:46:54.651Z`. This gives an observation interval, not the
consensus event's exact sub-second time.

## 3. Data sources

### Live endpoints

| Purpose                     | Endpoint                                                        | Role and caveat                                                                    |
| --------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Robinhood mainnet RPC       | `https://rpc.mainnet.chain.robinhood.com`                       | Official public endpoint; primary L2 block/receipt source                          |
| Corroborating Robinhood RPC | `https://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`      | Public secondary head check only; not treated as independent consensus evidence    |
| Robinhood explorer          | `https://robinhoodchain.blockscout.com`                         | Robinhood-linked Blockscout UI; batch association and current fork-tab observation |
| Batch list/API route        | `https://robinhoodchain.blockscout.com/api/v2/arbitrum/batches` | Explorer data route; the browser UI was used when direct access was client-blocked |
| Ethereum RPC                | `https://ethereum-rpc.publicnode.com`                           | Public JSON-RPC used for L1 txs, receipts, blocks, and `finalized` tag             |

The secondary Robinhood endpoint returned block `53,483,765` while the primary
sample's initial `latest` was `53,483,706`; the calls were sequential on a chain
producing about ten blocks per second, so this is a timing sanity check rather
than a same-instant hash comparison.

### Architecture and policy references

- [Robinhood Chain overview](https://docs.robinhood.com/chain/) identifies the
  network as an Arbitrum Dedicated L2 with a sequencer.
- [Connecting to Robinhood Chain](https://docs.robinhood.com/chain/connecting/)
  documents chain ID `4663`, the public RPC, sequencer/feed endpoints, and
  Ethereum blob data availability.
- [Running a full node](https://docs.robinhood.com/chain/run-a-full-node/)
  documents the Nitro node, Ethereum execution/beacon dependencies, and
  sequencer feed.
- [Robinhood governance](https://docs.robinhood.com/chain/governance/) states
  that BoLD validation is permissioned and currently names Offchain Labs and
  Alchemy as validators.
- [Robinhood bridging](https://docs.robinhood.com/chain/bridging/) describes an
  approximately seven-day L2-to-L1 canonical withdrawal challenge period.
- The [Arbitrum Nitro whitepaper](https://docs.arbitrum.io/nitro-whitepaper.pdf)
  describes sequencer feeds, later L1 batch posting, and L1 data availability.
- Offchain Labs' [BoLD description](https://blog.arbitrum.io/bold-permissionless-validation-for-arbitrum-chains/)
  explains claims, challenges, and bounded dispute resolution; Robinhood's own
  documentation controls for the network-specific permission model.
- [Ethereum proof-of-stake finality](https://ethereum.org/developers/docs/consensus-mechanisms/pos/)
  explains checkpoint finalization and the slashing cost of reverting finalized
  blocks.
- [LayerZero production DVN configuration](https://docs.layerzero.network/v2/concepts/modular-security/production-dvn-configuration)
  defines `confirmations` as source blocks waited by a DVN, says higher values
  protect against source-chain reorgs, and gives `15-30` as the typical range
  for optimistic L2s while advising review of chain reorg history before going
  below 15.

Documentation was reviewed on 2026-09-03 and can change after this report.

## 4. Robinhood block timing measurements

The sampled blocks were `53,482,427-53,483,450`. Their timestamps covered
`2026-09-03T14:20:59Z-14:22:43Z`; RPC collection ran from
`14:23:10.647Z-14:27:55.513Z`.

| Metric                                     |            Result |
| ------------------------------------------ | ----------------: |
| Blocks / adjacent intervals                |     1,024 / 1,023 |
| Elapsed block-timestamp span               |       104 seconds |
| Mean interval                              |    0.1017 seconds |
| Minimum                                    |         0 seconds |
| Median                                     |         0 seconds |
| p90 / p95 / p99                            | 1 / 1 / 1 seconds |
| Maximum                                    |          1 second |
| Zero-second / one-second differences       |         919 / 104 |
| Negative/non-monotonic timestamp anomalies |                 0 |

The apparent distribution is dominated by one-second timestamp quantization.
It proves that the RPC exposes many distinct canonical blocks per timestamp,
not that those blocks were literally simultaneous. The 104-second overall span
is consistent with roughly 102 ms per block during this window. This is an
observation, not a protocol SLA or a guarantee under congestion or sequencer
failure.

At `2026-09-03T14:23:10.999Z`, one RPC response set returned:

| Tag         |      Block | L2 timestamp |        Distance from `latest` |
| ----------- | ---------: | ------------ | ----------------------------: |
| `latest`    | 53,483,706 | `14:23:10Z`  |                             0 |
| `safe`      | 53,476,559 | `14:10:43Z`  |    7,147 blocks / 747 seconds |
| `finalized` | 53,472,478 | `14:03:36Z`  | 11,228 blocks / 1,174 seconds |

Robinhood's public documentation does not establish that these L2 RPC tags mean
“the L2 data batch is posted and Ethereum-finalized,” and the later batch
measurements show why that inference would be unsafe. The tags are recorded as
observations, not used as proof of settlement semantics.

## 5. Reorg and canonical-stability observations

| Check                                               |           Observation |
| --------------------------------------------------- | --------------------: |
| Directly observed reorg events                      |                 **0** |
| Broken parent links in 1,023 links                  |                     0 |
| Block hash/parent changes on 1,024 re-reads         |                     0 |
| Sampled receipts still matching expected block      |              12 of 12 |
| Sampled receipt success status                      |              12 of 12 |
| Batch-boundary receipts matching expected end block |              10 of 10 |
| Explorer fork/reorg tab at inspection time          | “There are no blocks” |

The blocks were first read over approximately 2.3 minutes and all were re-read
before collection finished about 4.75 minutes after start. This establishes
short-lived stability of this one canonical window. It does not establish that
all those blocks had been L1 posted or finalized during the observation.

### What was not observable

Standard `eth_getBlockByNumber` returns the provider's current canonical answer.
If a provider has already discarded a displaced block, a later study cannot
reconstruct the fork from that method. Blockscout displayed an empty historical
fork tab, but its retention, ingestion completeness, and definition were not
documented. No archive containing authenticated orphaned Robinhood blocks or a
published reorg-depth time series was found.

Consequently:

- directly observed reorgs: zero;
- indirectly observed stability: yes, for the sampled short window; and
- reliable historical reorg frequency/depth evidence: unavailable.

The correct conclusion is not “no reorgs occurred”; it is “no reorg was seen by
these observers during this finite sample.”

## 6. Confirmation-depth latency

| Subsequent blocks | Windows | Min |  Median |     p95 | Max |    Mean |
| ----------------: | ------: | --: | ------: | ------: | --: | ------: |
|                 1 |   1,023 |  0s |      0s |      1s |  1s |  0.102s |
|                 5 |   1,019 |  0s |      1s |      1s |  2s |  0.507s |
|                10 |   1,014 |  0s |      1s |      2s |  2s |  1.014s |
|                15 |   1,009 |  0s |  **2s** |  **2s** |  3s |  1.520s |
|                20 |   1,004 |  0s |      2s |      3s |  3s |  2.027s |
|                30 |     994 |  0s |  **3s** |  **4s** |  4s |  3.039s |
|                50 |     974 |  0s |  **5s** |  **6s** |  7s |  5.059s |
|               128 |     896 |  8s | **13s** | **14s** | 15s | 12.859s |

Zero minima through depth 50 are another timestamp-resolution artifact: bursts
of more than 50 L2 blocks can share the same integer-second timestamp. They
should not be interpreted as zero wall-clock waiting time.

Relative to 15, 30 added 15 blocks for about one median second. Relative to 30,
50 added 20 blocks for about two median seconds, and 128 added 98 blocks for
about ten median seconds. This accurately quantifies depth and latency; it does
not quantify risk reduction because no reliable reorg-depth distribution was
available.

## 7. Nitro and L1 batch-posting observations

The ten batch records were consecutive. Their L2 ranges were inferred from the
explorer's batch block count and block list, then validated as contiguous by
boundary hashes/parents and receipt matches. Every associated Ethereum
transaction had status `1`, type `3`, three blob versioned hashes, the same
sender `0xdaa526086787d9debe1d7f3ffdb1fe50cf8687f4`, and destination
`0xbd0d173eeb87d57a09521c24388a12789f33ba96`.

|  Batch | L2 range              | L2 blocks |   L1 block | Ethereum posting transaction                                         | Last L2 block to L1 block time |
| -----: | --------------------- | --------: | ---------: | -------------------------------------------------------------------- | -----------------------------: |
| 184420 | 53,474,686-53,474,830 |       145 | 25,897,393 | `0x80265e8dbe331981510f24470127857ea487f8534b2f4effd70931d9599bfd91` |                         23m40s |
| 184419 | 53,474,551-53,474,685 |       135 | 25,897,391 | `0x30d4422a03d469ddce2df4d0c7072d85964ff6f1e7d355552ba1377d8e805930` |                         23m31s |
| 184418 | 53,474,407-53,474,550 |       144 | 25,897,389 | `0x0e7fa42b48b3a695d8645d631f747feec46e4aa768a7896911a6b849acc761b9` |                         23m21s |
| 184417 | 53,474,272-53,474,406 |       135 | 25,897,389 | `0xada6077ff05a3ee6edc02c22ac88206c912860fb42049e856a19df6447ce2d1c` |                         23m36s |
| 184416 | 53,474,123-53,474,271 |       149 | 25,897,389 | `0x010ce70bb1bb2edbbd1b3e75e91a3645ad507035e6eb0cd3274a33900ef001b4` |                         23m50s |
| 184415 | 53,473,987-53,474,122 |       136 | 25,897,386 | `0xbb0a19e5fa8c8567e5c8a5a16cbebab6c93186535623d16b491dbaed257b6ecb` |                         23m30s |
| 184414 | 53,473,851-53,473,986 |       136 | 25,897,386 | `0xa72b28675943613495c1f37b5237c17487e8851fbc55399d947c48715ccd1e9d` |                         23m44s |
| 184413 | 53,473,727-53,473,850 |       124 | 25,897,382 | `0x1efe54bdf39d1372a3a3de42e8fcfd61036159e57af18fd14b9d4b09129dc795` |                         23m11s |
| 184412 | 53,473,610-53,473,726 |       117 | 25,897,381 | `0x9f3537f8109e48ad1aeb8ef0a07c4de8984600eab703bf4a0a3047862a1bd15f` |                         23m12s |
| 184411 | 53,473,495-53,473,609 |       115 | 25,897,380 | `0x4b2c1744f492b3bd059dc12c732716350c6f269aa7af1c00362705f62fa47cc4` |                         23m12s |

The last-L2-block-to-posting median was `1,410.5 seconds` (`23m30.5s`),
minimum `1,391 seconds`, and maximum `1,430 seconds`. From the first block in
each batch, the median was `1,424.5 seconds`; individual batches spanned only
12-16 L2 timestamp seconds.

This is a strong public association but not a cryptographic re-decoding of each
blob: Blockscout supplied the batch-to-Ethereum-transaction mapping, while both
chains' RPCs verified the referenced blocks, receipts, timestamps, transaction
type, and blob hashes.

## 8. Ethereum finality observations

The ten posting blocks ranged from `25,897,380` to `25,897,393`. At
`14:46:42.456Z`, Ethereum's `finalized` tag was still `25,897,375`; at
`14:46:54.651Z`, it advanced to `25,897,406`. Thus all sampled posting blocks
were directly below the finalized head at the latter observation.

| Metric, 10 batches                               | Minimum |   Median | Maximum |
| ------------------------------------------------ | ------: | -------: | ------: |
| L1 block timestamp to observed `finalized`       |  15m32s | 16m37.7s |  18m08s |
| Final L2 block timestamp to observed L1 finality |  39m12s | 40m17.7s |  41m20s |

The poll interval adds at most about 12.2 seconds to the recorded observation
time. This study checked Ethereum consensus finality of the posting transaction's
block. It did not prove the semantic correctness of the batch contents or
complete the rollup dispute period.

The sample also demonstrates that an Ethereum transaction's mere existence or
successful receipt is not finality: each posting transaction was first observed
below the `finalized` head and became finalized only later.

## 9. BoLD and state correctness

Four stages must remain distinct:

1. **Robinhood L2 inclusion.** The sequencer places a transaction in an L2
   block. Thirty later L2 blocks measure depth on that exposed chain.
2. **Ethereum finality of batch data.** A batch transaction is posted to
   Ethereum and its L1 block later becomes finalized. The ten measurements show
   this is a different, much slower clock.
3. **Rollup state correctness.** Validators make and, where necessary, dispute
   claims about correct execution. Ethereum data availability and transaction
   finality do not themselves prove that the asserted state transition is
   correct.
4. **Challenge-period settlement.** Robinhood documents an approximately
   seven-day canonical L2-to-L1 withdrawal challenge horizon. Ordinary
   cross-chain messaging latency must not be described as waiting through it.

Robinhood's current documentation says its BoLD validator set is permissioned
and names two validators. This leaves validator correctness, liveness,
permissioning, upgrades, and governance as network assumptions. BoLD's bounded
dispute process is not a reason to relabel 30 L2 blocks as Ethereum or
challenge-period finality.

## 10. LayerZero confirmation guidance

LayerZero defines ULN `confirmations` as source-chain blocks a DVN waits before
verification. Its current production guidance gives optimistic L2s a typical
range of `15-30` and recommends reviewing chain reorg history before going below 15. Therefore:

- 15 is the bottom of the generic range;
- 30 is **within the range and at its upper edge**;
- 50 and 128 are above the generic range; and
- LayerZero does not, in the reviewed material, endorse 30 specifically for
  Robinhood.

A 2-of-3 configuration requires two optional DVNs to verify before delivery and
can tolerate one unavailable provider. It raises the attestation-compromise
threshold, but does not necessarily diversify the source chain, sequencer,
public RPC, batch-posting, or L1-finality assumption. Provider-specific RPC and
finality behavior must be verified separately.

## 11. Assessment of 30 confirmations

### Decision

**Yes: 30 is a defensible engineering choice for LayerZero source-chain reorg
mitigation, subject to explicit human acceptance of its limited semantics.**

The evidence supporting that judgment is:

- 30 is at the conservative end of LayerZero's generic optimistic-L2 range;
- it doubles the depth of 15 for about one additional median second in this
  sample;
- its sampled cost was only median 3 seconds / p95 4 seconds; and
- no canonical instability was seen across the finite re-read sample.

The evidence does **not** prove a 30-block safety threshold. Historical
reorg-depth evidence was unavailable, and the only direct reorg count is zero in
a short observation window. The choice is consequently a standards-aligned,
low-latency engineering buffer, not a statistically derived guarantee.

### Exact security meaning

Thirty confirmations protects against a transaction being acted upon at the
tip or within the next 29 exposed L2 blocks. It gives RPCs and DVNs time to
converge on shallow canonical changes and increases the work/coordination
window for an adversary trying to exploit very short-lived ordering.

It does not protect against:

- sequencer equivocation, censorship, extended outage, or malicious history
  presented consistently for more than 30 blocks;
- a correlated or compromised RPC/indexer view;
- a bad or unavailable batch poster;
- an Ethereum reorg before the posting block is finalized;
- invalid rollup state, validator/governance failure, or an unresolved BoLD
  dispute;
- completion of the optimistic challenge period;
- compromised DVNs, owner/multisig, pauser, upgrade authority, or endpoint;
- message-configuration mistakes, peer mistakes, replay/implementation bugs,
  or economic loss within the rate-limit and response window.

It does not provide Ethereum settlement finality. In the sampled period, 30 L2
blocks took about 3 seconds, while final L2 inclusion to observed Ethereum
finality took about 40 minutes.

### 50 and 128

Fifty confirmations are a cheap conservative margin: 20 more blocks for about
two median seconds. One hundred twenty-eight are also low in absolute latency:
98 more blocks for about ten median seconds. They provide proportionally more
soft depth, but **there is insufficient evidence to claim a material reduction
in actual reorg probability** because no reliable reorg-depth distribution was
available. There is likewise no empirical evidence here requiring a depth
substantially above 30.

If governance prefers added unquantified margin, 50 or 128 is operationally
affordable. That would be a risk-appetite decision, not a conclusion forced by
this data. No L2 block count should be increased until it is described as L1
finality; even 10,000 fast blocks do not by themselves prove batch posting,
Ethereum finality, or challenge completion.

### Interaction with other controls

The proposed 2-of-3 DVNs reduce single-DVN compromise/availability risk. The
50M SAN/86,400-second token bucket bounds immediate directional capacity but is
not a strict rolling-day cap: a full bucket can release 50M immediately and
refill roughly another 50M during the following 24 hours. Multisig pause is a
reactive containment control whose effectiveness depends on detection and
signing latency. These controls reduce different failure modes and must not be
counted as evidence that 30 blocks are final.

## 12. Residual risks

- No authenticated historical orphan/fork dataset was available.
- One 104-second block window cannot represent congestion, maintenance,
  sequencer failover, or adversarial conditions.
- Block timestamps are integer seconds and sequencer-controlled within protocol
  constraints; collector wall time was not used as a substitute.
- The batch sample covers ten consecutive batches in one approximately
  two-minute posting cluster. The roughly 23.5-minute posting delay may vary.
- Batch association relied on a public explorer and was corroborated, not
  independently reconstructed from blob payloads.
- A public Ethereum RPC was used for finality tags; no second beacon/execution
  provider was polled in lockstep.
- Robinhood's `safe` and `finalized` RPC tag semantics were not sufficiently
  documented to treat them as batch-posting or challenge-completion evidence.
- DVN providers may share RPC infrastructure or choose different observation
  rules; their exact Robinhood verification implementations were not available.
- Permissioned validator, sequencer, batch-poster, upgrade, and governance
  assumptions remain.
- Rate limits and pause reduce blast radius only after detection; they do not
  validate a message.

## 13. Recommended production wording

These are recommended documentation edits for human review. This evidence task
does not apply or operationally approve them.

### `docs/ROBINHOOD_FINALITY_POLICY.md`

> Robinhood-source LayerZero `confirmations` should be set to 30 only after
> explicit governance and independent security approval. Thirty is a
> source-chain reorg-mitigation delay at the upper edge of LayerZero's generic
> 15-30 guidance for optimistic L2s. In the 2026-09-03 sample it represented a
> median 3 seconds and p95 4 seconds of exposed Robinhood L2 depth. It does not
> mean that the relevant Nitro batch has been posted to Ethereum, that its
> Ethereum transaction is finalized, that rollup state correctness is resolved,
> or that the optimistic challenge period has completed. Production monitoring
> must separately cover sequencer health, batch-posting lag, Ethereum finality,
> DVN agreement, message backlog, rate-limit state, and pause readiness. The
> production checker must remain fail-closed until the value and these residual
> assumptions are explicitly approved.

### `docs/AUDITOR_HANDOFF.md`

> Robinhood -> Solana uses a proposed 30-block source-confirmation policy as
> soft reorg mitigation, not settlement finality. Empirical evidence from
> 2026-09-03 measured 30 blocks at median 3 seconds / p95 4 seconds, while ten
> sampled Nitro batches reached observed Ethereum finality roughly 39-41 minutes
> after their last included L2 block. Review `ROBINHOOD_FINALITY_EVIDENCE.md`,
> verify the any-2-of-3 DVN identities and independence, and treat the 50M SAN
> token bucket plus multisig pause as defense in depth rather than substitutes
> for finality. Historical Robinhood reorg frequency and depth remain unknown.

### `docs/REVIEWER_QUICKSTART.md`

> Do not interpret `30` Robinhood confirmations as Ethereum finality. It is
> approximately 3 seconds of sampled L2 block depth and is intended only to
> reduce exposure to shallow source-chain reorgs. Before approval, read
> `ROBINHOOD_FINALITY_EVIDENCE.md` and confirm acceptance of the remaining
> sequencer, RPC, batch-poster, permissioned-validator, Ethereum-finality, DVN,
> governance, monitoring, rate-limit, and pause assumptions.

## 14. Limitations

This is an empirical snapshot, not a formal proof, protocol audit, long-running
reorg monitor, or guarantee about future network behavior. No directly observed
reorg means there is no measured reorg depth from which to estimate a tail
distribution. The study can compare depth and latency, but cannot attach a
probability of loss to 15, 30, 50, or 128.

The report also does not determine when LayerZero's individual production DVNs
would verify these exact messages. That requires provider-specific behavior or
message telemetry. Ethereum finality of data posting is not equivalent to
rollup assertion correctness, and neither is equivalent to completion of the
canonical withdrawal challenge period.

## 15. Reproduction instructions

Use a credential-free Node.js runtime with `fetch`. Never add a wallet or call
`eth_sendRawTransaction`, `eth_sendTransaction`, signing, deployment, or admin
methods.

1. Query Robinhood `latest`, choose `end = latest - 256`, and set
   `start = end - 1,023`.
2. Batch `eth_getBlockByNumber([hex(number), false])` over every number from
   start through end. Persist the raw response with an ISO retrieval time.
3. Assert `blocks[i].parentHash === blocks[i - 1].hash`, then re-read all block
   numbers and compare hash and parent hash.
4. Select transaction-bearing blocks across the range and call
   `eth_getTransactionReceipt`. Compare receipt block number/hash with the saved
   block.
5. For each depth in `[1, 5, 10, 15, 20, 30, 50, 128]`, calculate every sliding
   timestamp delta `timestamp[i + depth] - timestamp[i]` and report count,
   min, median, p90, p95, p99, max, and mean. Preserve the histogram so integer
   timestamp resolution remains visible.
6. In the Robinhood Blockscout batch UI, save batch number, block list/count,
   L1 transaction hash, L1 block, observed status, and observation time. Verify
   L2 boundary blocks and representative receipts through Robinhood RPC.
7. Through an Ethereum RPC, call `eth_getTransactionByHash`,
   `eth_getTransactionReceipt`, and `eth_getBlockByNumber` for each posting
   transaction. Poll `eth_getBlockByNumber(["finalized", false])` with ISO wall
   time until the finalized number passes the posting block.
8. Report posting latency from the representative L2 block timestamp to the L1
   block timestamp, and finality latency from the L1 block timestamp to the
   first polling observation that covers it. State the poll interval.
9. Repeat over multiple days, providers, sequencer incidents, and elevated-load
   periods before using the observations as a durable operational baseline.

The compact machine-readable companion is
`docs/data/robinhood-finality-sample.json`. It contains derived statistics,
selected identifiers, all ten batch observations, collection metadata, and
SHA-256 digests for the raw temporary collector outputs used to prepare this
report. The raw 1,024-block response was intentionally not committed because
the compact data plus the deterministic block range and method are sufficient
to reproduce and independently challenge the calculations.
