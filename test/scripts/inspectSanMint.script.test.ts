import {
    CANONICAL_SAN_MINT,
    LEGACY_SPL_TOKEN_PROGRAM,
    SOLANA_MAINNET_GENESIS_HASH,
    TOKEN_2022_PROGRAM,
    formatRawTokenAmount,
    requireCanonicalSanMint,
    requireSolanaMainnet,
    requireSupportedTokenProgram,
    validateSanAdapterConfig,
} from '../../scripts/sanMintConfig'

describe('SAN mint inspection safety', () => {
    it('accepts only the canonical SAN mint', () => {
        expect(requireCanonicalSanMint(CANONICAL_SAN_MINT)).toBe(CANONICAL_SAN_MINT)
    })

    it('refuses a different valid mint', () => {
        expect(() => requireCanonicalSanMint('So11111111111111111111111111111111111111112')).toThrow(
            'Refusing non-canonical SAN mint'
        )
    })

    it('refuses a missing SAN_SOLANA_MINT', () => {
        expect(() => requireCanonicalSanMint(undefined)).toThrow('SAN_SOLANA_MINT is required')
        expect(() => requireCanonicalSanMint('')).toThrow('SAN_SOLANA_MINT is required')
    })

    it('refuses a malformed mint address', () => {
        expect(() => requireCanonicalSanMint('not-a-solana-address')).toThrow(
            'SAN_SOLANA_MINT is not a valid Solana public key'
        )
    })

    it('refuses an unsupported mint owner program', () => {
        expect(() => requireSupportedTokenProgram('11111111111111111111111111111111')).toThrow(
            'Unsupported SAN mint owner'
        )
    })

    it('accepts only the two supported token programs', () => {
        expect(requireSupportedTokenProgram(LEGACY_SPL_TOKEN_PROGRAM)).toBe('SPL Token')
        expect(requireSupportedTokenProgram(TOKEN_2022_PROGRAM)).toBe('Token-2022')
    })

    it('accepts the verified SAN adapter identity', () => {
        expect(
            validateSanAdapterConfig({
                eid: 30168,
                mint: CANONICAL_SAN_MINT,
                configuredMint: CANONICAL_SAN_MINT,
                tokenProgram: LEGACY_SPL_TOKEN_PROGRAM,
            })
        ).toBe('SPL Token')
    })

    it('refuses adapter creation for another EID', () => {
        expect(() =>
            validateSanAdapterConfig({
                eid: 40168,
                mint: CANONICAL_SAN_MINT,
                configuredMint: CANONICAL_SAN_MINT,
                tokenProgram: LEGACY_SPL_TOKEN_PROGRAM,
            })
        ).toThrow('restricted to Solana mainnet EID 30168')
    })

    it('accepts only the Solana mainnet genesis hash', () => {
        expect(() => requireSolanaMainnet(SOLANA_MAINNET_GENESIS_HASH)).not.toThrow()
        expect(() => requireSolanaMainnet('EtWTRABZaYq6iMfeYKouRu166VU2xqa1')).toThrow('RPC is not Solana mainnet')
    })

    it('formats raw supply without floating-point precision loss', () => {
        expect(formatRawTokenAmount(1234567890123456789n, 9)).toBe('1234567890.123456789')
        expect(formatRawTokenAmount(1000000n, 6)).toBe('1')
        expect(formatRawTokenAmount(42n, 0)).toBe('42')
    })
})
