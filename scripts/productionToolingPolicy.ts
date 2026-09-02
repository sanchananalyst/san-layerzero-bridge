import { PublicKey } from '@solana/web3.js'
import { ethers } from 'ethers'

import { PRODUCTION_ROBINHOOD_ENDPOINT, PRODUCTION_SOLANA_OFT_PROGRAM } from './productionMainnetPolicy'
import {
    ProductionRateLimitPlan,
    ProductionRateLimitProfile,
    validateProductionRateLimitPlan,
} from './productionRateLimitPolicy'

export const FUTURE_MAINNET_EXECUTION_PHASE = 'PHASE_5B_EXPLICITLY_AUTHORIZED'

export function requireFutureMainnetExecution(_value: string | undefined): void {
    throw new Error(
        'Mainnet transaction execution is structurally disabled in the Phase 5A revision; a separately reviewed Phase 5B change is required'
    )
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

export interface SanOftDeploymentPlan {
    chainId: number
    eid: number
    endpoint: string
    owner: string
    delegate: string
    name: string
    symbol: string
    decimals: number
    initialSupplyRaw: bigint
    upgradeable: boolean
}

export function validateSanOftDeploymentPlan(plan: SanOftDeploymentPlan): void {
    if (plan.chainId !== 4663 || plan.eid !== 30416) throw new Error('SanOFT deployment requires Robinhood 4663/30416')
    if (plan.endpoint.toLowerCase() !== PRODUCTION_ROBINHOOD_ENDPOINT) {
        throw new Error('SanOFT deployment Endpoint differs from the approved production Endpoint')
    }
    requireEvmAddress(plan.owner, 'SanOFT owner')
    requireEvmAddress(plan.delegate, 'SanOFT delegate')
    if (plan.owner.toLowerCase() !== plan.delegate.toLowerCase()) {
        throw new Error('SanOFT deployment owner and delegate must be the same approved Safe')
    }
    if (plan.name !== 'San Chan' || plan.symbol !== 'SAN' || plan.decimals !== 6) {
        throw new Error('SanOFT production identity must be San Chan/SAN/6')
    }
    if (plan.initialSupplyRaw !== 0n) throw new Error('SanOFT initial supply must be zero')
    if (plan.upgradeable) throw new Error('SanOFT production deployment must be non-upgradeable')
}

export interface ProductionWiringPreviewInput {
    solanaOftStore: string
    robinhoodOft: string
    robinhoodSourceConfirmations: bigint | null
    rateLimits: Partial<ProductionRateLimitPlan>
    rateLimitProfile: ProductionRateLimitProfile
}

export interface ProductionWiringPreview {
    mode: 'READ_ONLY_PREVIEW'
    transactions: 0
    solanaLocalEid: 30168
    robinhoodLocalEid: 30416
    solanaOftProgram: string
    solanaOftStore: string
    robinhoodOft: string
    solanaSourceConfirmations: 32n
    robinhoodSourceConfirmations: bigint
    standardReceiveGasOrCompute: 200_000n
    standardReceiveValue: 0n
    requiredDirectionalLimiters: 4
}

export function buildProductionWiringPreview(input: ProductionWiringPreviewInput): ProductionWiringPreview {
    requireSolanaAddress(input.solanaOftStore, 'Solana OFT Store')
    requireEvmAddress(input.robinhoodOft, 'Robinhood OFT')
    if (input.robinhoodSourceConfirmations == null || input.robinhoodSourceConfirmations <= 0n) {
        throw new Error('Robinhood-source confirmations must be explicitly approved before a wiring preview')
    }
    validateProductionRateLimitPlan(input.rateLimits, input.rateLimitProfile)
    return {
        mode: 'READ_ONLY_PREVIEW',
        transactions: 0,
        solanaLocalEid: 30168,
        robinhoodLocalEid: 30416,
        solanaOftProgram: PRODUCTION_SOLANA_OFT_PROGRAM,
        solanaOftStore: input.solanaOftStore,
        robinhoodOft: ethers.utils.getAddress(input.robinhoodOft),
        solanaSourceConfirmations: 32n,
        robinhoodSourceConfirmations: input.robinhoodSourceConfirmations,
        standardReceiveGasOrCompute: 200_000n,
        standardReceiveValue: 0n,
        requiredDirectionalLimiters: 4,
    }
}

export interface AuthorityHandoffTargets {
    bootstrapSolanaAuthority: string
    bootstrapRobinhoodAuthority: string
    solanaUpgradeAuthority: string
    solanaStoreAdmin: string
    solanaDelegate: string
    robinhoodOwner: string
    robinhoodDelegate: string
}

export const buildAuthorityHandoffSimulation = (targets: AuthorityHandoffTargets) => {
    for (const [label, value] of Object.entries(targets).filter(([label]) => label.startsWith('solana'))) {
        requireSolanaAddress(value, label)
    }
    requireSolanaAddress(targets.bootstrapSolanaAuthority, 'bootstrapSolanaAuthority')
    for (const [label, value] of Object.entries(targets).filter(
        ([label]) => label.startsWith('robinhood') || label === 'bootstrapRobinhoodAuthority'
    )) {
        requireEvmAddress(value, label)
    }
    return [
        { order: 1, action: 'set Solana Endpoint delegate', verify: 'read Endpoint OApp delegate' },
        { order: 2, action: 'set Solana OFT Store admin', verify: 'read OFTStore.admin and reject bootstrap signer' },
        { order: 3, action: 'set Solana program upgrade authority', verify: 'read upgradeable-loader program data' },
        { order: 4, action: 'set Robinhood Endpoint delegate', verify: 'read EndpointV2.delegates(SanOFT)' },
        { order: 5, action: 'transfer Robinhood ownership', verify: 'read SanOFT.owner and reject bootstrap signer' },
    ] as const
}

export function verifyAuthorityHandoffReadback(
    actual: Omit<AuthorityHandoffTargets, 'bootstrapSolanaAuthority' | 'bootstrapRobinhoodAuthority'>,
    expected: AuthorityHandoffTargets
): void {
    for (const role of ['solanaUpgradeAuthority', 'solanaStoreAdmin', 'solanaDelegate'] as const) {
        if (!new PublicKey(actual[role]).equals(new PublicKey(expected[role]))) {
            throw new Error(`${role} read-back differs`)
        }
    }
    for (const role of ['robinhoodOwner', 'robinhoodDelegate'] as const) {
        if (ethers.utils.getAddress(actual[role]) !== ethers.utils.getAddress(expected[role])) {
            throw new Error(`${role} read-back differs`)
        }
    }
    for (const role of ['solanaUpgradeAuthority', 'solanaStoreAdmin', 'solanaDelegate'] as const) {
        if (actual[role] === expected.bootstrapSolanaAuthority) throw new Error(`${role} unexpectedly remains deployer`)
    }
    for (const role of ['robinhoodOwner', 'robinhoodDelegate'] as const) {
        if (actual[role].toLowerCase() === expected.bootstrapRobinhoodAuthority.toLowerCase()) {
            throw new Error(`${role} unexpectedly remains deployer`)
        }
    }
}
