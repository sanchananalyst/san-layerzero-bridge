# SAN Bridge Authority Handoff

## Required final state

Before public bridging:

- the **Solana SAN multisig vault PDA** controls OFT Store admin, Endpoint/OApp delegate, and program upgrade authority;
- the **Robinhood SAN Safe** controls `SanOFT` ownership and the Endpoint/OApp delegate; and
- no deployer, transaction payer, workstation wallet, or generated program identity retains a governance role.

No authority exists on-chain in Phase 3 because the program, OFT Store, and `SanOFT` are not deployed. Every command below is proposed for a later approved phase and contains placeholders.

## Supported authority mechanisms

### Solana OFT Store admin

`OFTStore.admin` is enforced by Anchor's `has_one = admin` constraint on `set_oft_config`, `set_peer_config`, and `withdraw_fee`. The installed official SDK exposes:

```ts
oft.setOFTConfig(
  { oftStore, admin: currentAdminSigner },
  { __kind: "Admin", admin: solanaSanMultisigVault },
  { oft: sanOftProgramId, endpoint: endpointProgramId },
);
```

The current admin must sign. A Squads multisig uses its vault PDA as the authority and executes the generated instruction through a reviewed multisig proposal.

### Solana Endpoint/OApp delegate

The same SDK call supports `Delegate`:

```ts
oft.setOFTConfig(
  { oftStore, admin: currentAdminSigner },
  { __kind: "Delegate", delegate: solanaSanMultisigVault },
  { oft: sanOftProgramId, endpoint: endpointProgramId },
);
```

The OFT program CPIs to EndpointV2 `set_delegate`, signing as the OFT Store PDA. The OFT Store admin authorizes this call. Adapter initialization initially sets the Endpoint delegate equal to `params.admin`, which the current starter task obtains from the payer.

### Solana program upgrade authority

The BPF Upgradeable Loader stores this authority independently of the OFT Store. In a later authorized phase, the current upgrade authority would use:

```bash
solana program set-upgrade-authority \
  9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD \
  --new-upgrade-authority <SOLANA_SAN_MULTISIG_VAULT_PDA> \
  --upgrade-authority <CURRENT_UPGRADE_AUTHORITY_SIGNER> \
  --skip-new-upgrade-authority-signer-check \
  --url <VERIFIED_SOLANA_MAINNET_RPC>
```

The skip flag is needed only because a multisig vault PDA has no keypair to prove possession at the CLI. It raises typo risk: independently derive and compare the vault PDA before signing. Do not make the program immutable without a separate governance decision.

### Robinhood owner and delegate

`SanOFT` passes the constructor's `delegate_` to both LayerZero `OAppCore` and OpenZeppelin `Ownable`. The safest production deployment is therefore:

```text
delegate_ = <ROBINHOOD_SAN_SAFE>
```

This makes the Safe both owner and Endpoint delegate at construction, so the deployer never holds either role. If a reviewed deployment mechanism cannot do that, the temporary owner must call, in this order:

```solidity
sanOFT.setDelegate(ROBINHOOD_SAN_SAFE);
sanOFT.transferOwnership(ROBINHOOD_SAN_SAFE);
```

`setDelegate` must occur first because it is `onlyOwner`. EndpointV2 records delegates under `delegates[SanOFT address]`; ownership and delegation are separate state.

## Exact proposed sequence

All addresses, bytecode, hashes, multisig thresholds, and proposal calldata must receive two-person review before signing.

1. Create and independently verify the Solana SAN multisig and Robinhood SAN Safe; test proposal execution on a non-production environment.
2. Build reproducible/verifiable Solana and EVM artifacts and record hashes. Confirm the program ID is `9myH…TvcD` and `SanOFT.decimals() == 6`.
3. If deployment is later approved, deploy the Solana program with a tightly controlled bootstrap upgrade authority. Do not deposit SAN.
4. Create the Adapter only in an approved later phase. Record the payer-initialized OFT Store admin and Endpoint delegate.
5. Keep the Adapter globally paused. Configure and read back peer, explicit ULN libraries/configs, enforced options, rate limits, pause roles, and zero/default fees while the bootstrap admin still has authority.
6. Submit the SDK `Delegate` instruction to set the Solana Endpoint/OApp delegate to `<SOLANA_SAN_MULTISIG_VAULT_PDA>`. Read it back.
7. Submit the SDK `Admin` instruction **last among OFT Store admin actions** to set `OFTStore.admin` to the same multisig vault. Read it back and prove the deployer can no longer authorize an admin instruction.
8. Transfer the Solana program upgrade authority to the same verified multisig vault PDA. Read the loader state back and prove the deployer is no longer authority.
9. Deploy `SanOFT` with `<ROBINHOOD_SAN_SAFE>` as `delegate_`, making the Safe owner and delegate immediately. If and only if temporary ownership is unavoidable, execute `setDelegate(Safe)` then `transferOwnership(Safe)` and read both back.
10. From both multisigs, execute harmless/read-only governance drills and prepare—but do not yet exercise—the pause/rollback procedures.
11. Independently verify all five deployer-removal conditions, archive the signed evidence, and require a human go/no-go before unpausing or accepting deposits.

## Read-only verification commands

These commands are templates; replace placeholders and use independently verified RPCs. They perform reads only.

### Solana OFT Store admin and delegate

```bash
pnpm hardhat lz:oft:solana:debug \
  --eid 30168 \
  --oft-store <SAN_OFT_STORE_PDA> \
  --action GET_ADMIN

pnpm hardhat lz:oft:solana:debug \
  --eid 30168 \
  --oft-store <SAN_OFT_STORE_PDA> \
  --action GET_DELEGATE
```

Expected for both: `<SOLANA_SAN_MULTISIG_VAULT_PDA>`. The debug task decodes `OFTStore.admin` and EndpointV2's OApp registry delegate through the installed official SDK.

### Solana upgrade authority

```bash
solana program show \
  9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD \
  --url <VERIFIED_SOLANA_MAINNET_RPC> \
  --output json
```

Expected `authority`: `<SOLANA_SAN_MULTISIG_VAULT_PDA>`. Also verify executable program-data address and deployed slot/hash against the release record.

### Robinhood owner and delegate

```bash
cast call <SAN_OFT_ADDRESS> 'owner()(address)' \
  --rpc-url <VERIFIED_ROBINHOOD_RPC>

cast call 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B \
  'delegates(address)(address)' <SAN_OFT_ADDRESS> \
  --rpc-url <VERIFIED_ROBINHOOD_RPC>
```

Expected for both: `<ROBINHOOD_SAN_SAFE>`. Separately inspect the Safe threshold, owners, modules, guards, fallback handler, nonce, and transaction history; merely matching the Safe address is not sufficient.

## Governance risks

- Program upgrade authority can replace all escrow restrictions and is effectively a custody key.
- OFT Store admin can change the peer, fee, pause, rate-limit, and Endpoint delegate configuration. A malicious peer plus permissive LayerZero configuration can induce authenticated releases.
- The Endpoint delegate can weaken libraries, DVNs, confirmations, and Executor configuration.
- `SanOFT` owner can change peers, delegate, enforced options, and other inherited configuration. It cannot call an arbitrary mint function because none exists, but malicious peer/security settings can cause standard authenticated credit.

Multisigs reduce single-key risk, not malicious-governance risk. Thresholds, signer independence, key custody, proposal delay, emergency powers, monitoring, and incident response remain human decisions.
