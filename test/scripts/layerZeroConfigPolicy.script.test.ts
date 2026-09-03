import { PublicKey } from '@solana/web3.js'

import {
    BridgeObservation,
    BridgePolicy,
    SAN_LAYERZERO_POLICY,
    validateLayerZeroObservation,
} from '../../scripts/layerZeroConfigPolicy'

const PEERS = { solana: '0x' + '11'.repeat(32), robinhood: '0x' + '22'.repeat(32) }
const APPROVED_TEST_POLICY: BridgePolicy = {
    ...SAN_LAYERZERO_POLICY,
    robinhoodSourceConfirmations: 30n,
}

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
            // Try the next character.
        }
    }
    throw new Error('No valid case variant')
}

const fixture = (): BridgeObservation => ({
    deprecatedDvns: ['0xdead'],
    solana: {
        sendLibrary: SAN_LAYERZERO_POLICY.solana.sendLibrary,
        receiveLibrary: SAN_LAYERZERO_POLICY.solana.receiveLibrary,
        executor: SAN_LAYERZERO_POLICY.solana.executor,
        sendLibraryExplicit: true,
        receiveLibraryExplicit: true,
        executorExplicit: true,
        peer: PEERS.solana,
        send: {
            confirmations: 32n,
            requiredDvns: [],
            optionalDvns: [...SAN_LAYERZERO_POLICY.solana.optionalDvns],
            optionalThreshold: 2,
            explicitNoRequired: true,
            explicitConfirmations: true,
            explicitOptionalDvns: true,
        },
        receive: {
            confirmations: 30n,
            requiredDvns: [],
            optionalDvns: [...SAN_LAYERZERO_POLICY.solana.optionalDvns],
            optionalThreshold: 2,
            explicitNoRequired: true,
            explicitConfirmations: true,
            explicitOptionalDvns: true,
        },
    },
    robinhood: {
        sendLibrary: SAN_LAYERZERO_POLICY.robinhood.sendLibrary,
        receiveLibrary: SAN_LAYERZERO_POLICY.robinhood.receiveLibrary,
        executor: SAN_LAYERZERO_POLICY.robinhood.executor,
        sendLibraryExplicit: true,
        receiveLibraryExplicit: true,
        executorExplicit: true,
        peer: PEERS.robinhood,
        send: {
            confirmations: 30n,
            requiredDvns: [],
            optionalDvns: [...SAN_LAYERZERO_POLICY.robinhood.optionalDvns],
            optionalThreshold: 2,
            explicitNoRequired: true,
            explicitConfirmations: true,
            explicitOptionalDvns: true,
        },
        receive: {
            confirmations: 32n,
            requiredDvns: [],
            optionalDvns: [...SAN_LAYERZERO_POLICY.robinhood.optionalDvns],
            optionalThreshold: 2,
            explicitNoRequired: true,
            explicitConfirmations: true,
            explicitOptionalDvns: true,
        },
    },
})

const fails = (mutate: (value: BridgeObservation) => void): void => {
    const value = fixture()
    mutate(value)
    expect(() => validateLayerZeroObservation(value, PEERS, APPROVED_TEST_POLICY)).toThrow()
}

describe('future deployed LayerZero configuration policy', () => {
    it('records and accepts the frozen 32/30 source-confirmation policy', () => {
        expect(SAN_LAYERZERO_POLICY.solanaSourceConfirmations).toBe(32n)
        expect(SAN_LAYERZERO_POLICY.robinhoodSourceConfirmations).toBe(30n)
        expect(() => validateLayerZeroObservation(fixture(), PEERS)).not.toThrow()
    })
    it('fails closed if the Robinhood confirmation policy is missing', () => {
        expect(() =>
            validateLayerZeroObservation(fixture(), PEERS, {
                ...APPROVED_TEST_POLICY,
                robinhoodSourceConfirmations: null,
            })
        ).toThrow('Robinhood-source confirmations policy is unresolved')
    })
    it('rejects a Dead DVN', () =>
        fails((value) => {
            value.robinhood.send.optionalDvns[0] = '0xdead'
        }))
    it('rejects inherited or non-empty required DVNs', () =>
        fails((value) => {
            value.solana.send.explicitNoRequired = false
        }))
    it('rejects inherited libraries, Executor, confirmations, or optional DVNs', () => {
        fails((value) => {
            value.robinhood.sendLibraryExplicit = false
        })
        fails((value) => {
            value.solana.executorExplicit = false
        })
        fails((value) => {
            value.robinhood.receive.explicitConfirmations = false
        })
        fails((value) => {
            value.solana.send.explicitOptionalDvns = false
        })
    })
    it('rejects an explicit required DVN', () =>
        fails((value) => {
            value.robinhood.receive.requiredDvns = ['0xrequired']
        }))
    it('rejects a different optional threshold', () =>
        fails((value) => {
            value.solana.receive.optionalThreshold = 1
        }))
    it('rejects a missing expected DVN', () =>
        fails((value) => {
            value.robinhood.receive.optionalDvns.pop()
        }))
    it('rejects an unexpected DVN', () =>
        fails((value) => {
            value.solana.receive.optionalDvns[0] = 'unexpected'
        }))
    it('rejects the wrong Executor', () =>
        fails((value) => {
            value.robinhood.executor = 'wrong'
        }))
    it('rejects wrong libraries', () =>
        fails((value) => {
            value.solana.sendLibrary = 'wrong'
        }))
    it('rejects a case-only mutation of a Solana security identity', () =>
        fails((value) => {
            value.solana.sendLibrary = caseVariant(SAN_LAYERZERO_POLICY.solana.sendLibrary)
        }))
    it('rejects different confirmations', () =>
        fails((value) => {
            value.robinhood.send.confirmations = 31n
        }))
    it('rejects a wrong peer', () =>
        fails((value) => {
            value.solana.peer = 'wrong'
        }))
})
