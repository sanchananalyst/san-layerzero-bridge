# TypeScript Tooling Repair

## Result

`pnpm exec tsc --noEmit` now exits zero for the supported Solana/EVM production
tooling. Type checking remains enabled and no `@ts-ignore` or broad safety-
weakening `any` conversion was introduced.

| Original failure                                 | Root cause                                                           | Fix                                                                                                       | Runtime change                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Aptos example imports/API errors                 | unused starter Aptos tasks did not match installed packages          | excluded only `tasks/aptos` from the production TypeScript surface                                        | none for supported Solana/EVM paths                            |
| `Buffer`/`Uint8Array` incompatibilities          | stricter Node/TypeScript library types                               | added explicit byte conversions at SDK boundaries                                                         | representation only                                            |
| ethers signer/type conflicts                     | both ethers v5 and v6 Hardhat plugins augmented the same environment | retained the installed/runtime ethers v5 plugin and removed incompatible v6 Hardhat augmentation packages | aligns types with actual runtime signer                        |
| Umi signer union/overload failures               | installed Umi SDK returns a wider signer shape                       | narrowed with explicit overload-compatible handling                                                       | no transaction semantic change                                 |
| missing `@solana-developers/helpers` declaration | package lacked the declaration used by task code                     | added a narrow local declaration matching the invoked API                                                 | none                                                           |
| arithmetic/optional task argument errors         | strict inference exposed unsafe implicit conversions                 | made numeric and optional conversions explicit                                                            | fail-closed validation is clearer; no approved send path added |

The lockfile was regenerated offline against already installed versions; no
broad dependency-family upgrade was performed.
