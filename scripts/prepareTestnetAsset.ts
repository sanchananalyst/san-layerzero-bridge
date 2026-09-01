/**
 * Non-executing Phase 3.6 test-asset preparer.
 *
 * It validates identities and prints the future operator plan. It intentionally
 * has no wallet loading, signer, transaction construction, send, or confirmation.
 */
import 'dotenv/config'

import { TESTNET_CONFIG } from '../config/testnet'

import { validateTestnetAsset } from './testnetPolicy'

const mint = validateTestnetAsset({
    mint: process.env.TESTNET_SOLANA_MINT,
    solanaEid: Number(process.env.TESTNET_SOLANA_EID ?? TESTNET_CONFIG.solana.eid),
    robinhoodEid: Number(process.env.TESTNET_ROBINHOOD_EID ?? TESTNET_CONFIG.robinhood.eid),
    robinhoodChainId: Number(process.env.TESTNET_ROBINHOOD_CHAIN_ID ?? TESTNET_CONFIG.robinhood.chainId),
})

console.log('PREPARATION ONLY — no transaction was built, signed, or submitted.')
console.log({
    cluster: TESTNET_CONFIG.solana.cluster,
    mint,
    name: TESTNET_CONFIG.asset.name,
    symbol: TESTNET_CONFIG.asset.symbol,
    decimals: TESTNET_CONFIG.asset.decimals,
    nextAuthorizedPhase: [
        'create a new legacy SPL mint on Solana Devnet',
        'create Metaplex metadata with the exact test name and symbol',
        'inspect and record the new mint before using it as an OFT Adapter input',
    ],
})
