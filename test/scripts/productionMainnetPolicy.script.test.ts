import { PublicKey } from '@solana/web3.js'
import { ethers } from 'ethers'

import { SAN_LAYERZERO_POLICY } from '../../scripts/layerZeroConfigPolicy'
import {
    ApprovedProductionState,
    PRODUCTION_ROBINHOOD_ENDPOINT,
    PRODUCTION_SOLANA_ENDPOINT,
    PRODUCTION_SOLANA_OFT_PROGRAM,
    ProductionMainnetObservation,
    validateProductionMainnetObservation,
} from '../../scripts/productionMainnetPolicy'
import { PRODUCTION_RATE_LIMIT_PROFILES } from '../../scripts/productionRateLimitPolicy'
import { CANONICAL_SAN_MINT, LEGACY_SPL_TOKEN_PROGRAM } from '../../scripts/sanMintConfig'

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
    solanaDelegate: solanaAddress(5),
    robinhoodOft: evmAddress('1'),
    robinhoodOwner: evmAddress('2'),
    robinhoodDelegate: evmAddress('3'),
    robinhoodSourceConfirmations: 128n,
    rateLimitProfile: PRODUCTION_RATE_LIMIT_PROFILES.canary,
    expectedRobinhoodSupplyRaw: 0n,
})

const fixture = (): ProductionMainnetObservation => {
    const policy = approved()
    const profile = policy.rateLimitProfile
    const solanaLimit = { capacity: profile.capacity, refill: profile.refillPerSecond }
    const evmLimit = { capacity: profile.capacity, refill: profile.capacity, durationSeconds: 86_400n }
    const uln = (chain: 'solana' | 'robinhood', confirmations: bigint) => ({
        confirmations,
        requiredDvns: [],
        optionalDvns: [...SAN_LAYERZERO_POLICY[chain].optionalDvns],
        optionalThreshold: 2,
        explicitNoRequired: true,
    })
    return {
        solana: {
            eid: 30168,
            mint: CANONICAL_SAN_MINT,
            tokenProgram: LEGACY_SPL_TOKEN_PROGRAM,
            decimals: 6,
            sharedDecimals: 6,
            programId: PRODUCTION_SOLANA_OFT_PROGRAM,
            endpoint: PRODUCTION_SOLANA_ENDPOINT,
            oftStore: policy.solanaOftStore,
            escrow: policy.solanaEscrow,
            tvlRaw: 0n,
            escrowBalanceRaw: 0n,
            upgradeAuthority: policy.solanaUpgradeAuthority,
            storeAdmin: policy.solanaStoreAdmin,
            delegate: policy.solanaDelegate,
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
        },
        layerZero: {
            deprecatedDvns: ['0xdead'],
            solana: {
                sendLibrary: SAN_LAYERZERO_POLICY.solana.sendLibrary,
                receiveLibrary: SAN_LAYERZERO_POLICY.solana.receiveLibrary,
                executor: SAN_LAYERZERO_POLICY.solana.executor,
                peer: ethers.utils.hexZeroPad(policy.robinhoodOft, 32),
                send: uln('solana', 32n),
                receive: uln('solana', 128n),
            },
            robinhood: {
                sendLibrary: SAN_LAYERZERO_POLICY.robinhood.sendLibrary,
                receiveLibrary: SAN_LAYERZERO_POLICY.robinhood.receiveLibrary,
                executor: SAN_LAYERZERO_POLICY.robinhood.executor,
                peer: ethers.utils.hexlify(new PublicKey(policy.solanaOftStore).toBytes()),
                send: uln('robinhood', 128n),
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
    }
}

const fails = (mutate: (value: ProductionMainnetObservation, policy: ApprovedProductionState) => void): void => {
    const value = fixture()
    const policy = approved()
    mutate(value, policy)
    expect(() => validateProductionMainnetObservation(value, policy)).toThrow()
}

describe('complete production mainnet policy', () => {
    it('accepts a complete explicit zero-state production fixture', () => {
        expect(() => validateProductionMainnetObservation(fixture(), approved())).not.toThrow()
    })

    it('fails closed without an approved Robinhood confirmation value', () => {
        const policy = approved()
        policy.robinhoodSourceConfirmations = null
        expect(() => validateProductionMainnetObservation(fixture(), policy)).toThrow(
            'Approved Robinhood-source confirmations are required'
        )
    })

    it.each([
        ['Solana testnet EID', (v: ProductionMainnetObservation) => (v.solana.eid = 40168)],
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
})
