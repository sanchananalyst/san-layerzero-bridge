import { PublicKey } from '@solana/web3.js'

import { MAINNET_CONFIG } from '../config/mainnet'
import { TESTNET_CONFIG } from '../config/testnet'

export type TestnetAssetInput = {
    mint: string | undefined
    solanaEid: number
    robinhoodEid: number
    robinhoodChainId: number
}

export function requireTestnetMint(value: string | undefined): string {
    if (!value) throw new Error('TESTNET_SOLANA_MINT is required; no mint is defaulted')
    let mint: string
    try {
        mint = new PublicKey(value).toBase58()
    } catch {
        throw new Error('TESTNET_SOLANA_MINT is not a valid Solana public key')
    }
    if (mint === MAINNET_CONFIG.solana.mint) {
        throw new Error('Canonical SAN mainnet mint is forbidden in testnet tooling')
    }
    return mint
}

export function validateTestnetAsset(input: TestnetAssetInput): string {
    const mint = requireTestnetMint(input.mint)
    const mainnetSolanaEid: number = MAINNET_CONFIG.solana.eid
    const mainnetRobinhoodEid: number = MAINNET_CONFIG.robinhood.eid
    const mainnetRobinhoodChainId: number = MAINNET_CONFIG.robinhood.chainId
    if (input.solanaEid !== TESTNET_CONFIG.solana.eid || input.solanaEid === mainnetSolanaEid) {
        throw new Error('Testnet tooling requires Solana Devnet EID 40168')
    }
    if (input.robinhoodEid !== TESTNET_CONFIG.robinhood.eid || input.robinhoodEid === mainnetRobinhoodEid) {
        throw new Error('Testnet tooling requires Robinhood Testnet EID 40451')
    }
    if (
        input.robinhoodChainId !== TESTNET_CONFIG.robinhood.chainId ||
        input.robinhoodChainId === mainnetRobinhoodChainId
    ) {
        throw new Error('Testnet tooling requires Robinhood Testnet chain ID 46630')
    }
    return mint
}
