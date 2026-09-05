import { PublicKey } from '@solana/web3.js'
import { ethers } from 'ethers'

import { InFlightManifest } from '../../scripts/inFlightInventory'
import { SAN_LAYERZERO_POLICY } from '../../scripts/layerZeroConfigPolicy'
import {
    ApprovedProductionState,
    PRODUCTION_ROBINHOOD_ENDPOINT,
    PRODUCTION_SQUADS_PROGRAM,
    PRODUCTION_SOLANA_ENDPOINT,
    PRODUCTION_SOLANA_OFT_PROGRAM,
    ProductionExpectedState,
    ProductionMainnetObservation,
    collectRepeatedProductionObservations,
    validateProductionMainnetObservation,
    validateRepeatedProductionObservations,
} from '../../scripts/productionMainnetPolicy'
import { PRODUCTION_RATE_LIMIT_PROFILES } from '../../scripts/productionRateLimitPolicy'
import { CANONICAL_SAN_MINT, LEGACY_SPL_TOKEN_PROGRAM, SOLANA_MAINNET_GENESIS_HASH } from '../../scripts/sanMintConfig'

const solanaAddress = (fill: number): string => new PublicKey(Uint8Array.from({ length: 32 }, () => fill)).toBase58()
const evmAddress = (fill: string): string => ethers.utils.getAddress(`0x${fill.repeat(40)}`)

const caseVariant = (value: string): string => {
    for (let index = 0; index < value.length; index++) {
        const character = value[index]
        if (!/[A-Za-z]/.test(character)) continue
        const toggled = character === character.toLowerCase() ? character.toUpperCase() : character.toLowerCase()
        const candidate = `${value.slice(0, index)}${toggled}${value.slice(index + 1)}`
        try {
            new PublicKey(candidate)
            return candidate
        } catch {
            // Try the next case-sensitive Base58 character.
        }
    }
    throw new Error('Could not construct a valid case-variant Solana public key')
}

const approved = (): ApprovedProductionState => ({
    solanaOftStore: solanaAddress(1),
    solanaEscrow: solanaAddress(2),
    solanaUpgradeAuthority: solanaAddress(3),
    solanaStoreAdmin: solanaAddress(4),
    solanaDelegate: solanaAddress(4),
    robinhoodOft: evmAddress('1'),
    robinhoodOwner: evmAddress('2'),
    robinhoodDelegate: evmAddress('2'),
    solanaPauser: solanaAddress(6),
    solanaUnpauser: solanaAddress(7),
    robinhoodSourceConfirmations: 30n,
    rateLimitProfile: PRODUCTION_RATE_LIMIT_PROFILES.canary,
    expectedRobinhoodSupplyRaw: 0n,
    expectedSolanaMintSupplyRaw: 1_000_000n,
    expectedSolanaMintAuthority: null,
    expectedSolanaFreezeAuthority: null,
    forbiddenSolanaBootstrapAuthorities: [solanaAddress(9)],
    forbiddenRobinhoodBootstrapAuthorities: [evmAddress('9')],
    solanaSquadsMultisig: solanaAddress(14),
    solanaSquadsVaultIndex: 0,
    solanaSquadsThreshold: 3,
    solanaSquadsMembers: [
        solanaAddress(15),
        solanaAddress(16),
        solanaAddress(17),
        solanaAddress(18),
        solanaAddress(19),
    ],
    solanaSquadsVoters: [solanaAddress(15), solanaAddress(16), solanaAddress(17), solanaAddress(18), solanaAddress(19)],
    robinhoodSafeThreshold: 3,
    robinhoodSafeOwners: [evmAddress('4'), evmAddress('5'), evmAddress('6'), evmAddress('7'), evmAddress('8')],
    expectedSolanaProgramData: solanaAddress(8),
    expectedSolanaProgramDataSha256: `0x${'11'.repeat(32)}`,
    expectedSolanaEndpointProgramData: solanaAddress(10),
    expectedSolanaEndpointProgramDataSha256: `0x${'33'.repeat(32)}`,
    expectedSolanaEndpointUpgradeAuthority: solanaAddress(11),
    expectedSolanaUlnProgramData: solanaAddress(12),
    expectedSolanaUlnProgramDataSha256: `0x${'44'.repeat(32)}`,
    expectedSolanaUlnUpgradeAuthority: solanaAddress(13),
    expectedRobinhoodRuntimeCodeHash: `0x${'22'.repeat(32)}`,
    expectedInFlight: {
        inventoryId: 'pre-activation-zero-state',
        inventorySha256: `0x${'44'.repeat(32)}`,
        scannerSourceCommit: '1'.repeat(40),
        solanaFromSlot: 0n,
        solanaToSlot: 1n,
        robinhoodFromBlock: 0n,
        robinhoodToBlock: 1n,
        solanaToRobinhoodRaw: 0n,
        robinhoodToSolanaRaw: 0n,
    },
})

const fixture = (): ProductionMainnetObservation => {
    const policy = approved()
    const profile = policy.rateLimitProfile
    const solanaLimit = { capacity: profile.capacity, available: profile.capacity, refill: profile.refillPerSecond }
    const evmLimit = {
        capacity: profile.capacity,
        available: profile.capacity,
        refill: profile.capacity,
        durationSeconds: 86_400n,
    }
    const uln = (chain: 'solana' | 'robinhood', confirmations: bigint) => ({
        confirmations,
        requiredDvns: [],
        optionalDvns: [...SAN_LAYERZERO_POLICY[chain].optionalDvns],
        optionalThreshold: 2,
        explicitNoRequired: true,
        explicitConfirmations: true,
        explicitOptionalDvns: true,
    })
    const contextBlockhash = solanaAddress(20)
    const robinhoodBlockHash = `0x${'66'.repeat(32)}`
    const unsignedManifest: Omit<InFlightManifest, 'manifestChecksum'> = {
        schemaVersion: 2,
        inventoryId: policy.expectedInFlight.inventoryId,
        scanner: {
            name: 'scanProductionInFlight',
            version: '1.0.0',
            bridgeCodeAuditTarget: 'd28762288bb5180ff292f57eef7132191f2037ec',
            scannerSourceCommit: policy.expectedInFlight.scannerSourceCommit,
        },
        generatedAt: '2026-09-03T00:00:00.000Z',
        identities: {
            solana: {
                chain: 'solana-mainnet',
                eid: 30168,
                endpoint: PRODUCTION_SOLANA_ENDPOINT,
                oftProgram: PRODUCTION_SOLANA_OFT_PROGRAM,
                oftStore: policy.solanaOftStore,
            },
            robinhood: { chainId: 4663, eid: 30416, endpoint: PRODUCTION_ROBINHOOD_ENDPOINT, oft: policy.robinhoodOft },
        },
        ranges: {
            solana: {
                fromSlot: '0',
                toSlot: '1',
                finalizedSlot: '1',
                genesisHash: SOLANA_MAINNET_GENESIS_HASH,
                startBlockhash: 'start',
                endBlockhash: contextBlockhash,
                complete: true,
                paginationComplete: true,
            },
            robinhood: {
                fromBlock: '0',
                toBlock: '1',
                finalizedBlock: '1',
                startBlockHash: `0x${'55'.repeat(32)}`,
                endBlockHash: robinhoodBlockHash,
                complete: true,
                paginationComplete: true,
            },
        },
        provenance: {
            model: 'DUAL_RPC_RECONCILED',
            solanaProviders: ['a', 'b'],
            robinhoodProviders: ['c', 'd'],
            sourceEvidenceAgreement: true,
            destinationEvidenceAgreement: true,
            layerZeroApiCorroborated: true,
            layerZeroApiDisagreements: [],
        },
        messages: [],
        summary: { resultCount: 0, unresolvedPacketCount: 0, solanaToRobinhoodRaw: '0', robinhoodToSolanaRaw: '0' },
    }
    const manifest: InFlightManifest = {
        ...unsignedManifest,
        manifestChecksum: policy.expectedInFlight.inventorySha256,
    }
    return {
        solana: {
            eid: 30168,
            genesisHash: SOLANA_MAINNET_GENESIS_HASH,
            mint: CANONICAL_SAN_MINT,
            tokenProgram: LEGACY_SPL_TOKEN_PROGRAM,
            decimals: 6,
            sharedDecimals: 6,
            oftType: 1,
            mintSupplyRaw: policy.expectedSolanaMintSupplyRaw,
            mintAuthority: policy.expectedSolanaMintAuthority,
            freezeAuthority: policy.expectedSolanaFreezeAuthority,
            programId: PRODUCTION_SOLANA_OFT_PROGRAM,
            endpoint: PRODUCTION_SOLANA_ENDPOINT,
            oftStore: policy.solanaOftStore,
            escrow: policy.solanaEscrow,
            tvlRaw: 0n,
            escrowBalanceRaw: 0n,
            upgradeAuthority: policy.solanaUpgradeAuthority,
            storeAdmin: policy.solanaStoreAdmin,
            delegate: policy.solanaDelegate,
            squadsMultisig: policy.solanaSquadsMultisig,
            squadsVault: policy.solanaStoreAdmin,
            squadsProgramOwner: PRODUCTION_SQUADS_PROGRAM,
            squadsThreshold: policy.solanaSquadsThreshold,
            squadsMembers: [...policy.solanaSquadsMembers],
            squadsVotingMembers: [...policy.solanaSquadsVoters],
            paused: true,
            pauser: policy.solanaPauser,
            unpauser: policy.solanaUnpauser,
            programExecutable: true,
            programOwner: 'BPFLoaderUpgradeab1e11111111111111111111111',
            programData: policy.expectedSolanaProgramData,
            programDataSha256: policy.expectedSolanaProgramDataSha256,
            programDataOwner: 'BPFLoaderUpgradeab1e11111111111111111111111',
            programDataExecutable: false,
            endpointProgramData: policy.expectedSolanaEndpointProgramData,
            endpointProgramDataSha256: policy.expectedSolanaEndpointProgramDataSha256,
            endpointUpgradeAuthority: policy.expectedSolanaEndpointUpgradeAuthority,
            endpointProgramDataOwner: 'BPFLoaderUpgradeab1e11111111111111111111111',
            endpointProgramDataExecutable: false,
            ulnProgramData: policy.expectedSolanaUlnProgramData,
            ulnProgramDataSha256: policy.expectedSolanaUlnProgramDataSha256,
            ulnUpgradeAuthority: policy.expectedSolanaUlnUpgradeAuthority,
            ulnProgramDataOwner: 'BPFLoaderUpgradeab1e11111111111111111111111',
            ulnProgramDataExecutable: false,
            escrowProgramOwner: LEGACY_SPL_TOKEN_PROGRAM,
            escrowMint: CANONICAL_SAN_MINT,
            escrowAuthority: policy.solanaOftStore,
        },
        robinhood: {
            chainId: 4663,
            eid: 30416,
            endpoint: PRODUCTION_ROBINHOOD_ENDPOINT,
            oft: policy.robinhoodOft,
            decimals: 6,
            sharedDecimals: 6,
            totalSupplyRaw: 0n,
            owner: policy.robinhoodOwner,
            delegate: policy.robinhoodDelegate,
            safeThreshold: policy.robinhoodSafeThreshold,
            safeOwners: [...policy.robinhoodSafeOwners],
            paused: true,
            runtimeCodeHash: policy.expectedRobinhoodRuntimeCodeHash,
            proxyImplementation: null,
            proxyAdmin: null,
            blockHash: robinhoodBlockHash,
        },
        layerZero: {
            deprecatedDvns: ['0xdead'],
            solana: {
                sendLibrary: SAN_LAYERZERO_POLICY.solana.sendLibrary,
                receiveLibrary: SAN_LAYERZERO_POLICY.solana.receiveLibrary,
                executor: SAN_LAYERZERO_POLICY.solana.executor,
                sendLibraryExplicit: true,
                receiveLibraryExplicit: true,
                executorExplicit: true,
                peer: ethers.utils.hexZeroPad(policy.robinhoodOft, 32),
                send: uln('solana', 32n),
                receive: uln('solana', 30n),
            },
            robinhood: {
                sendLibrary: SAN_LAYERZERO_POLICY.robinhood.sendLibrary,
                receiveLibrary: SAN_LAYERZERO_POLICY.robinhood.receiveLibrary,
                executor: SAN_LAYERZERO_POLICY.robinhood.executor,
                sendLibraryExplicit: true,
                receiveLibraryExplicit: true,
                executorExplicit: true,
                peer: ethers.utils.hexlify(new PublicKey(policy.solanaOftStore).toBytes()),
                send: uln('robinhood', 30n),
                receive: uln('robinhood', 32n),
            },
        },
        enforcedOptions: {
            solanaReceive: { gasOrCompute: 200_000n, value: 0n },
            robinhoodReceive: { gasOrCompute: 200_000n, value: 0n },
        },
        rateLimits: {
            solana: { outbound: { ...solanaLimit }, inbound: { ...solanaLimit } },
            robinhood: { outbound: { ...evmLimit }, inbound: { ...evmLimit } },
        },
        solanaContext: {
            model: 'COMMON_CONTEXT_STRONG',
            commitment: 'finalized',
            contextSlot: 1n,
            finalizedSlotBefore: 1n,
            finalizedSlotAfter: 1n,
            blockhash: contextBlockhash,
            parentSlot: 0n,
            accounts: [
                'OFT Store',
                'OFT peer config',
                'canonical SAN mint',
                'SAN escrow token account',
                'production OFT program',
                'production OFT ProgramData',
                'LayerZero Endpoint program',
                'LayerZero Endpoint ProgramData',
                'LayerZero ULN302 program',
                'LayerZero ULN302 ProgramData',
                'Solana Squads multisig',
                'Endpoint OApp registry',
                'Endpoint default send-library config',
                'Endpoint app send-library config',
                'Endpoint default receive-library config',
                'Endpoint app receive-library config',
                'ULN message-library PDA',
                'ULN custom send config',
                'ULN custom receive config',
            ].map((label, index) => ({
                label,
                address: solanaAddress(index + 30),
                owner: solanaAddress(60),
                executable: false,
                lamports: '1',
                dataLength: 1,
                accountSha256: `0x${(index + 1).toString(16).padStart(2, '0').repeat(32)}`,
            })),
            remainingCrossCallGaps: ['Robinhood state is pinned independently.'],
        },
        inFlight: {
            manifest,
            inventoryId: policy.expectedInFlight.inventoryId,
            inventorySha256: policy.expectedInFlight.inventorySha256,
            messageCount: 0,
            solanaSlot: 1n,
            robinhoodBlock: 1n,
            solanaToRobinhoodRaw: 0n,
            robinhoodToSolanaRaw: 0n,
        },
    }
}

const fails = (mutate: (value: ProductionMainnetObservation, policy: ApprovedProductionState) => void): void => {
    const value = fixture()
    const policy = approved()
    mutate(value, policy)
    expect(() =>
        validateProductionMainnetObservation(value, policy, ProductionExpectedState.PRE_ACTIVATION_INERT)
    ).toThrow()
}

describe('complete production mainnet policy', () => {
    it('accepts a complete explicit zero-state production fixture', () => {
        expect(() =>
            validateProductionMainnetObservation(fixture(), approved(), ProductionExpectedState.PRE_ACTIVATION_INERT)
        ).not.toThrow()
    })

    it('rejects a state transition between consecutive RPC observations', () => {
        const first = fixture()
        const second = fixture()
        second.solana.paused = false
        expect(() => validateRepeatedProductionObservations(first, second)).toThrow(
            'consecutive production observations differ'
        )
        second.solana.paused = true
        second.inFlight.solanaSlot += 1n
        second.inFlight.robinhoodBlock += 1n
        second.solanaContext.contextSlot += 1n
        second.solanaContext.finalizedSlotBefore += 1n
        second.solanaContext.finalizedSlotAfter += 1n
        second.solanaContext.blockhash = solanaAddress(21)
        second.robinhood.blockHash = `0x${'77'.repeat(32)}`
        expect(() => validateRepeatedProductionObservations(first, second)).not.toThrow()
    })

    it('accepts a finalized manifest ending before the state snapshot and rejects a future end', () => {
        const value = fixture()
        value.solanaContext.contextSlot = 2n
        value.solanaContext.finalizedSlotAfter = 2n
        value.solanaContext.blockhash = solanaAddress(21)
        value.inFlight.solanaSlot = 2n
        value.inFlight.robinhoodBlock = 2n
        value.robinhood.blockHash = `0x${'77'.repeat(32)}`
        expect(() =>
            validateProductionMainnetObservation(value, approved(), ProductionExpectedState.PRE_ACTIVATION_INERT)
        ).not.toThrow()
        value.inFlight.manifest.ranges.solana.toSlot = '3'
        const policy = approved()
        policy.expectedInFlight.solanaToSlot = 3n
        expect(() =>
            validateProductionMainnetObservation(value, policy, ProductionExpectedState.PRE_ACTIVATION_INERT)
        ).toThrow('newer than or conflict')
    })

    it('fails closed when the second RPC observation is interrupted', async () => {
        let calls = 0
        await expect(
            collectRepeatedProductionObservations(async () => {
                calls += 1
                if (calls === 2) throw new Error('simulated finalized RPC interruption')
                return fixture()
            })
        ).rejects.toThrow('simulated finalized RPC interruption')
        expect(calls).toBe(2)
    })

    it('accepts CANARY_ACTIVE only when both applications are unpaused', () => {
        const value = fixture()
        value.solana.paused = false
        value.robinhood.paused = false
        expect(() =>
            validateProductionMainnetObservation(value, approved(), ProductionExpectedState.CANARY_ACTIVE)
        ).not.toThrow()
    })

    it('restricts CANARY_ACTIVE to the initial zero-state public activation boundary', () => {
        const value = fixture()
        const policy = approved()
        value.solana.paused = false
        value.robinhood.paused = false
        value.solana.tvlRaw = 1n
        value.solana.escrowBalanceRaw = 1n
        value.robinhood.totalSupplyRaw = 1n
        policy.expectedRobinhoodSupplyRaw = 1n
        expect(() =>
            validateProductionMainnetObservation(value, policy, ProductionExpectedState.CANARY_ACTIVE)
        ).toThrow('initial zero-state public activation boundary')
    })

    it('fails closed without an approved Robinhood confirmation value', () => {
        const policy = approved()
        policy.robinhoodSourceConfirmations = null
        expect(() =>
            validateProductionMainnetObservation(fixture(), policy, ProductionExpectedState.PRE_ACTIVATION_INERT)
        ).toThrow('Approved Robinhood-source confirmations are required')
    })

    it('fails closed when approved Robinhood confirmations differ from the frozen policy', () => {
        const policy = approved()
        policy.robinhoodSourceConfirmations = 31n
        expect(() =>
            validateProductionMainnetObservation(fixture(), policy, ProductionExpectedState.PRE_ACTIVATION_INERT)
        ).toThrow('frozen 30-block policy')
    })

    it.each([
        ['Solana testnet EID', (v: ProductionMainnetObservation) => (v.solana.eid = 40168)],
        ['wrong Solana genesis', (v: ProductionMainnetObservation) => (v.solana.genesisHash = 'devnet')],
        ['Robinhood testnet chain ID', (v: ProductionMainnetObservation) => (v.robinhood.chainId = 46630)],
        ['Robinhood testnet EID', (v: ProductionMainnetObservation) => (v.robinhood.eid = 40451)],
        [
            'tSAN mint',
            (v: ProductionMainnetObservation) => (v.solana.mint = 'Hec7jHowvQnD1ZHYUt98mWfqh5VoBXdjciC2DQPHcja'),
        ],
        [
            'test OFT program',
            (v: ProductionMainnetObservation) => (v.solana.programId = 'EgA4Cc59PAdJvh6G13H3mM3iYprAvwTcU5J8H8jnjoN8'),
        ],
        ['wrong Solana Endpoint', (v: ProductionMainnetObservation) => (v.solana.endpoint = solanaAddress(9))],
        ['wrong Robinhood Endpoint', (v: ProductionMainnetObservation) => (v.robinhood.endpoint = evmAddress('9'))],
    ])('rejects %s', (_, mutate) => fails((value) => mutate(value)))

    it('rejects wrong decimals and shared decimals', () =>
        fails((value) => {
            value.robinhood.sharedDecimals = 18
        }))

    it('compares Solana identities by decoded public-key bytes, not lowercased text', () =>
        fails((value) => {
            value.solana.mint = caseVariant(CANONICAL_SAN_MINT)
        }))

    it('rejects supply above TVL and escrow below TVL', () => {
        fails((value, policy) => {
            value.robinhood.totalSupplyRaw = 1n
            policy.expectedRobinhoodSupplyRaw = 1n
        })
        fails((value) => {
            value.solana.tvlRaw = 1n
        })
    })

    it('rejects unexpected or one-sided activation states', () => {
        fails((value) => {
            value.solana.paused = false
        })
        const active = fixture()
        active.solana.paused = false
        expect(() =>
            validateProductionMainnetObservation(active, approved(), ProductionExpectedState.CANARY_ACTIVE)
        ).toThrow('CANARY_ACTIVE requires both bridge applications unpaused')
    })

    it('rejects missing pause roles, bytecode mismatch, proxy state, and wrong escrow semantics', () => {
        fails((value) => {
            value.solana.pauser = null
        })
        fails((value) => {
            value.solana.programDataSha256 = `0x${'33'.repeat(32)}`
        })
        fails((value) => {
            value.robinhood.proxyImplementation = evmAddress('4')
        })
        fails((value) => {
            value.solana.escrowMint = solanaAddress(9)
        })
        fails((value) => {
            value.solana.programDataOwner = solanaAddress(9)
        })
        fails((value) => {
            value.solana.programDataExecutable = true
        })
        fails((value) => {
            value.solana.endpointProgramDataSha256 = `0x${'55'.repeat(32)}`
        })
        fails((value) => {
            value.solana.endpointUpgradeAuthority = solanaAddress(20)
        })
        fails((value) => {
            value.solana.ulnProgramData = solanaAddress(21)
        })
        fails((value) => {
            value.solana.ulnProgramDataSha256 = `0x${'66'.repeat(32)}`
        })
        fails((value) => {
            value.solana.endpointProgramDataOwner = solanaAddress(22)
        })
        fails((value) => {
            value.solana.ulnProgramDataExecutable = true
        })
    })

    it('rejects Native mode or unexpected canonical mint authorities and supply', () => {
        fails((value) => {
            value.solana.oftType = 0
        })
        fails((value) => {
            value.solana.mintSupplyRaw += 1n
        })
        fails((value) => {
            value.solana.mintAuthority = solanaAddress(10)
        })
    })

    it('rejects every privileged role still held by a forbidden bootstrap identity', () => {
        fails((value, policy) => {
            policy.forbiddenSolanaBootstrapAuthorities = [value.solana.pauser!]
        })
        fails((value, policy) => {
            policy.forbiddenRobinhoodBootstrapAuthorities = [value.robinhood.owner]
        })
        const policy = approved()
        policy.forbiddenSolanaBootstrapAuthorities = []
        expect(() =>
            validateProductionMainnetObservation(fixture(), policy, ProductionExpectedState.PRE_ACTIVATION_INERT)
        ).toThrow('At least one forbidden Solana bootstrap authority')
        fails((value, policy) => {
            policy.forbiddenSolanaBootstrapAuthorities = [value.solana.squadsMembers[0]]
        })
        fails((value, policy) => {
            policy.forbiddenRobinhoodBootstrapAuthorities = [value.robinhood.safeOwners[0]]
        })
    })

    it('fails closed on wrong or weak Squads governance evidence', () => {
        fails((value) => {
            value.solana.squadsVault = solanaAddress(20)
        })
        fails((value) => {
            value.solana.squadsProgramOwner = solanaAddress(20)
        })
        fails((value) => {
            value.solana.squadsThreshold = 2
        })
        fails((value) => {
            value.solana.squadsVotingMembers.pop()
        })
        const policy = approved()
        policy.solanaSquadsThreshold = 1
        expect(() =>
            validateProductionMainnetObservation(fixture(), policy, ProductionExpectedState.PRE_ACTIVATION_INERT)
        ).toThrow('must require multiple signers')
        const nonMemberVoterPolicy = approved()
        nonMemberVoterPolicy.solanaSquadsVoters[0] = solanaAddress(20)
        expect(() =>
            validateProductionMainnetObservation(
                fixture(),
                nonMemberVoterPolicy,
                ProductionExpectedState.PRE_ACTIVATION_INERT
            )
        ).toThrow('must be an approved member')
    })

    it('fails closed on wrong or weak Safe governance evidence', () => {
        fails((value) => {
            value.robinhood.safeThreshold = 2
        })
        fails((value) => {
            value.robinhood.safeOwners[0] = evmAddress('a')
        })
        const policy = approved()
        policy.robinhoodSafeThreshold = 1
        expect(() =>
            validateProductionMainnetObservation(fixture(), policy, ProductionExpectedState.PRE_ACTIVATION_INERT)
        ).toThrow('must require multiple signers')
    })

    it('rejects zero governance addresses and a non-Safe owner/delegate split', () => {
        const solanaPolicy = approved()
        solanaPolicy.solanaSquadsMultisig = PublicKey.default.toBase58()
        expect(() =>
            validateProductionMainnetObservation(fixture(), solanaPolicy, ProductionExpectedState.PRE_ACTIVATION_INERT)
        ).toThrow('nonzero Solana public key')
        const evmPolicy = approved()
        evmPolicy.robinhoodDelegate = evmAddress('3')
        expect(() =>
            validateProductionMainnetObservation(fixture(), evmPolicy, ProductionExpectedState.PRE_ACTIVATION_INERT)
        ).toThrow('must be the same Safe')
        const zeroSafeOwnerPolicy = approved()
        zeroSafeOwnerPolicy.robinhoodSafeOwners[0] = ethers.constants.AddressZero
        expect(() =>
            validateProductionMainnetObservation(
                fixture(),
                zeroSafeOwnerPolicy,
                ProductionExpectedState.PRE_ACTIVATION_INERT
            )
        ).toThrow('nonzero EVM address')
    })

    it('requires exact two-direction in-flight accounting and snapshot heights', () => {
        fails((value) => {
            value.inFlight.solanaToRobinhoodRaw = 1n
        })
        fails((value) => {
            value.inFlight.solanaSlot = 0n
        })
        fails((value) => {
            value.inFlight.inventorySha256 = `0x${'55'.repeat(32)}`
        })
        fails((value) => {
            value.inFlight.manifest.scanner.scannerSourceCommit = '2'.repeat(40)
        })
        fails((value) => {
            value.inFlight.manifest.ranges.solana.toSlot = '2'
        })
        fails((value) => {
            value.solana.tvlRaw = 1n
            value.solana.escrowBalanceRaw = 1n
        })
    })

    it('rejects wrong authorities, peers, libraries, and a Dead DVN', () => {
        fails((value) => {
            value.robinhood.owner = evmAddress('8')
        })
        fails((value) => {
            value.layerZero.solana.peer = `0x${'00'.repeat(32)}`
        })
        fails((value) => {
            value.layerZero.robinhood.sendLibrary = evmAddress('8')
        })
        fails((value) => {
            value.layerZero.robinhood.send.optionalDvns[0] = '0xdead'
        })
    })

    it('rejects wrong confirmations or enforced options', () => {
        fails((value) => {
            value.layerZero.solana.receive.confirmations = 64n
        })
        fails((value) => {
            value.enforcedOptions.solanaReceive.gasOrCompute = 199_999n
        })
    })

    it('rejects any missing directional limiter', () =>
        fails((value) => {
            Reflect.deleteProperty(value.rateLimits.solana as object, 'outbound')
        }))

    it('rejects missing or impossible live bucket availability', () => {
        fails((value) => {
            Reflect.deleteProperty(value.rateLimits.solana?.outbound as object, 'available')
        })
        fails((value) => {
            const robinhood = value.rateLimits.robinhood
            if (!robinhood) throw new Error('fixture is missing Robinhood limits')
            robinhood.inbound.available = robinhood.inbound.capacity + 1n
        })
    })
})
