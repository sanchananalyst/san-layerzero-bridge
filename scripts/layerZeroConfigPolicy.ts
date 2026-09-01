export interface UlnObservation {
    confirmations: bigint
    requiredDvns: string[]
    optionalDvns: string[]
    optionalThreshold: number
    explicitNoRequired: boolean
}

export interface ChainObservation {
    sendLibrary: string
    receiveLibrary: string
    executor: string
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
    confirmations: bigint
    optionalThreshold: number
    solana: ChainPolicy
    robinhood: ChainPolicy
}

export const SAN_LAYERZERO_POLICY: BridgePolicy = {
    confirmations: 32n,
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

const normalized = (value: string): string => value.toLowerCase()
const normalizedSet = (values: string[]): string[] => values.map(normalized).sort()

const assertEqual = (actual: string, expected: string, label: string): void => {
    if (normalized(actual) !== normalized(expected)) {
        throw new Error(`${label} differs: expected ${expected}, observed ${actual}`)
    }
}

const validateUln = (
    label: string,
    observation: UlnObservation,
    policy: ChainPolicy,
    deprecated: Set<string>,
    bridgePolicy: BridgePolicy
): void => {
    if (!observation.explicitNoRequired) throw new Error(`${label} does not explicitly override required DVNs to NONE`)
    if (observation.requiredDvns.length !== 0) throw new Error(`${label} required DVN count is not zero`)
    if (observation.optionalThreshold !== bridgePolicy.optionalThreshold) {
        throw new Error(`${label} optional threshold differs`)
    }
    if (observation.confirmations !== bridgePolicy.confirmations) throw new Error(`${label} confirmations differ`)

    const actual = normalizedSet(observation.optionalDvns)
    const expected = normalizedSet(policy.optionalDvns)
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
    const deprecated = new Set(observation.deprecatedDvns.map(normalized))
    for (const chain of ['solana', 'robinhood'] as const) {
        const observed = observation[chain]
        const intended = policy[chain]
        assertEqual(observed.sendLibrary, intended.sendLibrary, `${chain} send library`)
        assertEqual(observed.receiveLibrary, intended.receiveLibrary, `${chain} receive library`)
        assertEqual(observed.executor, intended.executor, `${chain} Executor`)
        assertEqual(observed.peer, expectedPeers[chain], `${chain} peer`)
        validateUln(`${chain} send`, observed.send, intended, deprecated, policy)
        validateUln(`${chain} receive`, observed.receive, intended, deprecated, policy)
    }
}
