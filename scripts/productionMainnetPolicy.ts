import { PublicKey } from '@solana/web3.js'
import { ethers } from 'ethers'

import { MAINNET_CONFIG } from '../config/mainnet'

import {
    BridgeObservation,
    BridgePolicy,
    SAN_LAYERZERO_POLICY,
    validateLayerZeroObservation,
} from './layerZeroConfigPolicy'
import {
    ProductionRateLimitPlan,
    ProductionRateLimitProfile,
    validateProductionRateLimitPlan,
} from './productionRateLimitPolicy'
import { CANONICAL_SAN_MINT, LEGACY_SPL_TOKEN_PROGRAM } from './sanMintConfig'

export const PRODUCTION_SOLANA_ENDPOINT = '76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6'
export const PRODUCTION_ROBINHOOD_ENDPOINT = '0x6f475642a6e85809b1c36fa62763669b1b48dd5b'
export const PRODUCTION_SOLANA_OFT_PROGRAM = '9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD'

export interface ProductionAuthorityPolicy {
    solanaUpgradeAuthority: string
    solanaStoreAdmin: string
    solanaDelegate: string
    robinhoodOwner: string
    robinhoodDelegate: string
}

export interface ApprovedProductionState extends ProductionAuthorityPolicy {
    solanaOftStore: string
    solanaEscrow: string
    robinhoodOft: string
    robinhoodSourceConfirmations: bigint | null
    rateLimitProfile: ProductionRateLimitProfile
    expectedRobinhoodSupplyRaw: bigint
}

export interface ProductionMainnetObservation {
    solana: {
        eid: number
        mint: string
        tokenProgram: string
        decimals: number
        sharedDecimals: number
        programId: string
        endpoint: string
        oftStore: string
        escrow: string
        tvlRaw: bigint
        escrowBalanceRaw: bigint
        upgradeAuthority: string
        storeAdmin: string
        delegate: string
    }
    robinhood: {
        chainId: number
        eid: number
        endpoint: string
        oft: string
        decimals: number
        sharedDecimals: number
        totalSupplyRaw: bigint
        owner: string
        delegate: string
    }
    layerZero: BridgeObservation
    enforcedOptions: {
        solanaReceive: { gasOrCompute: bigint; value: bigint }
        robinhoodReceive: { gasOrCompute: bigint; value: bigint }
    }
    rateLimits: Partial<ProductionRateLimitPlan>
}

const equalSolanaAddress = (actual: string, expected: string, label: string): void => {
    let matches = false
    try {
        matches = new PublicKey(actual).equals(new PublicKey(expected))
    } catch {
        throw new Error(`${label} is not a valid Solana public key`)
    }
    if (!matches) {
        throw new Error(`${label} differs: expected ${expected}, observed ${actual}`)
    }
}

const equalEvmAddress = (actual: string, expected: string, label: string): void => {
    if (!ethers.utils.isAddress(actual) || ethers.utils.getAddress(actual) !== ethers.utils.getAddress(expected)) {
        throw new Error(`${label} differs: expected ${expected}, observed ${actual}`)
    }
}

const requireSolanaAddress = (value: string, label: string): void => {
    try {
        new PublicKey(value)
    } catch {
        throw new Error(`${label} is not a valid Solana public key`)
    }
}

const requireEvmAddress = (value: string, label: string): void => {
    if (!ethers.utils.isAddress(value) || value === ethers.constants.AddressZero) {
        throw new Error(`${label} is not a nonzero EVM address`)
    }
}

const bytes32FromSolana = (address: string): string =>
    ethers.utils.hexlify(new PublicKey(address).toBytes()).toLowerCase()
const bytes32FromEvm = (address: string): string => ethers.utils.hexZeroPad(address, 32).toLowerCase()

const validateApprovedState = (approved: ApprovedProductionState): void => {
    if (approved.robinhoodSourceConfirmations == null) {
        throw new Error('Approved Robinhood-source confirmations are required; production policy fails closed')
    }
    if (approved.robinhoodSourceConfirmations <= 0n) {
        throw new Error('Approved Robinhood-source confirmations must be positive')
    }
    for (const [label, value] of [
        ['approved Solana OFT Store', approved.solanaOftStore],
        ['approved Solana escrow', approved.solanaEscrow],
        ['approved Solana upgrade authority', approved.solanaUpgradeAuthority],
        ['approved Solana Store admin', approved.solanaStoreAdmin],
        ['approved Solana delegate', approved.solanaDelegate],
    ] as const) {
        requireSolanaAddress(value, label)
    }
    requireEvmAddress(approved.robinhoodOft, 'approved Robinhood OFT')
    requireEvmAddress(approved.robinhoodOwner, 'approved Robinhood owner')
    requireEvmAddress(approved.robinhoodDelegate, 'approved Robinhood delegate')
}

/**
 * Validates a complete read-only production snapshot against explicitly
 * approved addresses and values. Missing policy is always an error.
 */
export function validateProductionMainnetObservation(
    observation: ProductionMainnetObservation,
    approved: ApprovedProductionState
): void {
    validateApprovedState(approved)

    if (observation.solana.eid !== MAINNET_CONFIG.solana.eid) throw new Error('Solana EID is not 30168')
    if (observation.robinhood.chainId !== MAINNET_CONFIG.robinhood.chainId) {
        throw new Error('Robinhood chainId is not 4663')
    }
    if (observation.robinhood.eid !== MAINNET_CONFIG.robinhood.eid) throw new Error('Robinhood EID is not 30416')
    equalSolanaAddress(observation.solana.mint, CANONICAL_SAN_MINT, 'canonical SAN mint')
    equalSolanaAddress(observation.solana.tokenProgram, LEGACY_SPL_TOKEN_PROGRAM, 'SAN token program')
    equalSolanaAddress(observation.solana.programId, PRODUCTION_SOLANA_OFT_PROGRAM, 'production Solana OFT program')
    equalSolanaAddress(observation.solana.endpoint, PRODUCTION_SOLANA_ENDPOINT, 'Solana Endpoint')
    equalEvmAddress(observation.robinhood.endpoint, PRODUCTION_ROBINHOOD_ENDPOINT, 'Robinhood Endpoint')
    equalSolanaAddress(observation.solana.oftStore, approved.solanaOftStore, 'Solana OFT Store')
    equalSolanaAddress(observation.solana.escrow, approved.solanaEscrow, 'Solana escrow')
    equalEvmAddress(observation.robinhood.oft, approved.robinhoodOft, 'Robinhood OFT')

    if (observation.solana.decimals !== 6 || observation.solana.sharedDecimals !== 6) {
        throw new Error('Solana decimals/sharedDecimals must both equal 6')
    }
    if (observation.robinhood.decimals !== 6 || observation.robinhood.sharedDecimals !== 6) {
        throw new Error('Robinhood decimals/sharedDecimals must both equal 6')
    }
    if (observation.solana.escrowBalanceRaw < observation.solana.tvlRaw) {
        throw new Error('Solana escrow balance is below OFT Store TVL')
    }
    if (observation.robinhood.totalSupplyRaw > observation.solana.tvlRaw) {
        throw new Error('Robinhood supply exceeds Solana accounted TVL')
    }
    if (observation.robinhood.totalSupplyRaw !== approved.expectedRobinhoodSupplyRaw) {
        throw new Error('Robinhood supply differs from the explicitly approved expected supply')
    }

    equalSolanaAddress(observation.solana.upgradeAuthority, approved.solanaUpgradeAuthority, 'Solana upgrade authority')
    equalSolanaAddress(observation.solana.storeAdmin, approved.solanaStoreAdmin, 'Solana Store admin')
    equalSolanaAddress(observation.solana.delegate, approved.solanaDelegate, 'Solana delegate')
    equalEvmAddress(observation.robinhood.owner, approved.robinhoodOwner, 'Robinhood owner')
    equalEvmAddress(observation.robinhood.delegate, approved.robinhoodDelegate, 'Robinhood delegate')

    for (const [label, option] of [
        ['Solana receive', observation.enforcedOptions.solanaReceive],
        ['Robinhood receive', observation.enforcedOptions.robinhoodReceive],
    ] as const) {
        if (option.gasOrCompute !== 200_000n || option.value !== 0n) {
            throw new Error(`${label} enforced option must be 200000 with value 0`)
        }
    }

    const policy: BridgePolicy = {
        ...SAN_LAYERZERO_POLICY,
        robinhoodSourceConfirmations: approved.robinhoodSourceConfirmations,
    }
    validateLayerZeroObservation(
        observation.layerZero,
        {
            solana: bytes32FromEvm(approved.robinhoodOft),
            robinhood: bytes32FromSolana(approved.solanaOftStore),
        },
        policy
    )
    validateProductionRateLimitPlan(observation.rateLimits, approved.rateLimitProfile)
}
