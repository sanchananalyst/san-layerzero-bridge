import { MAINNET_CONFIG } from '../../config/mainnet'
import { TESTNET_CONFIG } from '../../config/testnet'
import { requireTestnetMint, validateTestnetAsset } from '../../scripts/testnetPolicy'

const TEST_MINT = 'So11111111111111111111111111111111111111112'

const valid = () => ({
    mint: TEST_MINT,
    solanaEid: TESTNET_CONFIG.solana.eid,
    robinhoodEid: TESTNET_CONFIG.robinhood.eid,
    robinhoodChainId: TESTNET_CONFIG.robinhood.chainId,
})

describe('testnet asset and network isolation', () => {
    it('accepts an explicit non-canonical valid test mint', () => {
        expect(validateTestnetAsset(valid())).toBe(TEST_MINT)
    })

    it('has a visibly test-only fixed identity', () => {
        expect(TESTNET_CONFIG.asset).toMatchObject({
            name: 'SAN Bridge Test Token',
            symbol: 'tSAN',
            decimals: 6,
            mint: undefined,
        })
    })

    it('has no default mint and rejects missing or malformed input', () => {
        expect(() => requireTestnetMint(undefined)).toThrow('no mint is defaulted')
        expect(() => requireTestnetMint('not-a-key')).toThrow('not a valid Solana public key')
    })

    it('rejects the real canonical SAN mint', () => {
        expect(() => requireTestnetMint(MAINNET_CONFIG.solana.mint)).toThrow('Canonical SAN mainnet mint is forbidden')
    })

    it('rejects every mainnet network identity', () => {
        expect(() => validateTestnetAsset({ ...valid(), solanaEid: MAINNET_CONFIG.solana.eid })).toThrow()
        expect(() => validateTestnetAsset({ ...valid(), robinhoodEid: MAINNET_CONFIG.robinhood.eid })).toThrow()
        expect(() => validateTestnetAsset({ ...valid(), robinhoodChainId: MAINNET_CONFIG.robinhood.chainId })).toThrow()
    })
})
