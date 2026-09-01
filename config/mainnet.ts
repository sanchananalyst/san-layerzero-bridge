/** Production identities. Never import this module from testnet tooling. */
export const MAINNET_CONFIG = Object.freeze({
    environment: 'mainnet' as const,
    solana: Object.freeze({
        eid: 30168,
        mint: 'GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump',
        tokenProgram: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        oftProgram: '9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD',
    }),
    robinhood: Object.freeze({ chainId: 4663, eid: 30416 }),
})
