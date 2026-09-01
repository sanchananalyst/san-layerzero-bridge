/**
 * Read-only testnet metadata and fixed test-asset policy.
 *
 * This is deliberately not an executable LayerZero graph. Deployment addresses
 * remain unset until a later, explicitly authorized phase.
 */
export const TESTNET_CONFIG = Object.freeze({
    environment: 'testnet' as const,
    asset: Object.freeze({
        name: 'SAN Bridge Test Token',
        symbol: 'tSAN',
        decimals: 6,
        mint: undefined as string | undefined,
    }),
    solana: Object.freeze({
        cluster: 'devnet' as const,
        eid: 40168,
        endpoint: '76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6',
        sendLibrary: '7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH',
        receiveLibrary: '7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH',
        executor: 'AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK',
        requiredDvns: ['4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb'] as readonly string[],
        sendConfirmationsToRobinhood: 10,
        receiveConfirmationsFromRobinhood: 1,
    }),
    robinhood: Object.freeze({
        chainId: 46630,
        eid: 40451,
        endpoint: '0x3aCAAf60502791D199a5a5F0B173D78229eBFe32',
        sendLibrary: '0x45841dD1Ca50265Da7614fC43A361e526C0E6160',
        receiveLibrary: '0xD682ECF100f6F4284138aA925348633B0611Ae21',
        executor: '0x701f3927871eFCEa1235Db722F9e608Ae120D243',
        requiredDvns: ['0xA78A78A13074ED93ad447a26eC57121f29E8FEc2'] as readonly string[],
        sendConfirmationsToSolana: 1,
        receiveConfirmationsFromSolana: 10,
    }),
    // App execution values are not chain metadata. These are review-only
    // candidates and MUST be profiled before any later wiring transaction.
    enforcedOptionsCandidate: Object.freeze({ msgType: 1, gas: 200_000, value: 0 }),
})
