import { PublicKey } from '@solana/web3.js'

export interface UlnObservation {
    confirmations: bigint
    requiredDvns: string[]
    optionalDvns: string[]
    optionalThreshold: number
    explicitNoRequired: boolean
    explicitConfirmations: boolean
    explicitOptionalDvns: boolean
}

export interface ChainObservation {
    sendLibrary: string
    receiveLibrary: string
    executor: string
    sendLibraryExplicit: boolean
    receiveLibraryExplicit: boolean
    executorExplicit: boolean
    peer: string
    send: UlnObservation
    receive: UlnObservation
}

export interface BridgeObservation {
    solana: ChainObservation
    robinhood: ChainObservation
    deprecatedDvns: string[]
}

export interface ChainPolicy {
    sendLibrary: string
    receiveLibrary: string
    executor: string
    optionalDvns: string[]
}

export interface BridgePolicy {
    solanaSourceConfirmations: bigint
    robinhoodSourceConfirmations: bigint | null
    optionalThreshold: number
    solana: ChainPolicy
    robinhood: ChainPolicy
}

export const SAN_LAYERZERO_POLICY: BridgePolicy = {
    solanaSourceConfirmations: 32n,
    // Fail closed until DVN behavior and an L1-posting/finality-aligned value
    // for Robinhood Nitro are documented and approved by humans.
    robinhoodSourceConfirmations: null,
    optionalThreshold: 2,
    solana: {
        sendLibrary: '7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH',
        receiveLibrary: '7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH',
        executor: 'AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK',
        optionalDvns: [
            '4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb',
            'GPjyWr8vCotGuFubDpTxDxy9Vj1ZeEN4F2dwRmFiaGab',
            'HR9NQKK1ynW9NzgdM37dU5CBtqRHTukmbMKS7qkwSkHX',
        ],
    },
    robinhood: {
        sendLibrary: '0xc39161c743d0307eb9bcc9fef03eeb9dc4802de7',
        receiveLibrary: '0xe1844c5d63a9543023008d332bd3d2e6f1fe1043',
        executor: '0x4208d6e27538189bb48e603d6123a94b8abe0a0b',
        optionalDvns: [
            '0xd01ae6905d48315f7be10c7330aecf8360ef5b12',
            '0x0ffe02df012299a370d5dd69298a5826eacafdf8',
            '0x1258a278519c7f4bd997a9c3bfd4aa802a028d89',
        ],
    },
}

const normalizedEvm = (value: string): string => value.toLowerCase()
const normalizedSolana = (value: string): string => new PublicKey(value).toBase58()
const normalizedSet = (values: string[], chain: 'solana' | 'robinhood'): string[] =>
    values.map(chain === 'solana' ? normalizedSolana : normalizedEvm).sort()

const assertChainAddressEqual = (
    actual: string,
    expected: string,
    label: string,
    chain: 'solana' | 'robinhood'
): void => {
    const normalize = chain === 'solana' ? normalizedSolana : normalizedEvm
    if (normalize(actual) !== normalize(expected)) {
        throw new Error(`${label} differs: expected ${expected}, observed ${actual}`)
    }
}

const assertBytes32Equal = (actual: string, expected: string, label: string): void => {
    if (normalizedEvm(actual) !== normalizedEvm(expected)) {
        throw new Error(`${label} differs: expected ${expected}, observed ${actual}`)
    }
}

const validateUln = (
    label: string,
    observation: UlnObservation,
    policy: ChainPolicy,
    deprecated: Set<string>,
    bridgePolicy: BridgePolicy,
    expectedConfirmations: bigint,
    chain: 'solana' | 'robinhood'
): void => {
    if (!observation.explicitNoRequired) throw new Error(`${label} does not explicitly override required DVNs to NONE`)
    if (!observation.explicitConfirmations)
        throw new Error(`${label} confirmations are inherited from Endpoint defaults`)
    if (!observation.explicitOptionalDvns)
        throw new Error(`${label} optional DVNs are inherited from Endpoint defaults`)
    if (observation.requiredDvns.length !== 0) throw new Error(`${label} required DVN count is not zero`)
    if (observation.optionalThreshold !== bridgePolicy.optionalThreshold) {
        throw new Error(`${label} optional threshold differs`)
    }
    if (observation.confirmations !== expectedConfirmations) throw new Error(`${label} confirmations differ`)

    const actual = normalizedSet(observation.optionalDvns, chain)
    const expected = normalizedSet(policy.optionalDvns, chain)
    if (actual.length !== expected.length) throw new Error(`${label} optional DVN count differs`)
    for (const dvn of actual) {
        if (deprecated.has(dvn)) throw new Error(`${label} contains deprecated/Dead DVN ${dvn}`)
        if (!expected.includes(dvn)) throw new Error(`${label} contains unexpected DVN ${dvn}`)
    }
    for (const dvn of expected) {
        if (!actual.includes(dvn)) throw new Error(`${label} is missing expected DVN ${dvn}`)
    }
}

export const validateLayerZeroObservation = (
    observation: BridgeObservation,
    expectedPeers: { solana: string; robinhood: string },
    policy: BridgePolicy = SAN_LAYERZERO_POLICY
): void => {
    if (policy.robinhoodSourceConfirmations == null) {
        throw new Error('Robinhood-source confirmations policy is unresolved; configuration validation fails closed')
    }
    for (const chain of ['solana', 'robinhood'] as const) {
        const observed = observation[chain]
        const intended = policy[chain]
        const deprecated = new Set(
            observation.deprecatedDvns
                .map((value) => {
                    try {
                        return chain === 'solana' ? normalizedSolana(value) : normalizedEvm(value)
                    } catch {
                        return null
                    }
                })
                .filter((value): value is string => value != null)
        )
        assertChainAddressEqual(observed.sendLibrary, intended.sendLibrary, `${chain} send library`, chain)
        assertChainAddressEqual(observed.receiveLibrary, intended.receiveLibrary, `${chain} receive library`, chain)
        assertChainAddressEqual(observed.executor, intended.executor, `${chain} Executor`, chain)
        if (!observed.sendLibraryExplicit) throw new Error(`${chain} send library is inherited from Endpoint defaults`)
        if (!observed.receiveLibraryExplicit)
            throw new Error(`${chain} receive library is inherited from Endpoint defaults`)
        if (!observed.executorExplicit) throw new Error(`${chain} Executor is inherited from message-library defaults`)
        assertBytes32Equal(observed.peer, expectedPeers[chain], `${chain} peer`)
        const sendConfirmations =
            chain === 'solana' ? policy.solanaSourceConfirmations : policy.robinhoodSourceConfirmations
        const receiveConfirmations =
            chain === 'solana' ? policy.robinhoodSourceConfirmations : policy.solanaSourceConfirmations
        validateUln(`${chain} send`, observed.send, intended, deprecated, policy, sendConfirmations, chain)
        validateUln(`${chain} receive`, observed.receive, intended, deprecated, policy, receiveConfirmations, chain)
    }
}
