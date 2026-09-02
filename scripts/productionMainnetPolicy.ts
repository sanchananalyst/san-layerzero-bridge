import { PublicKey } from '@solana/web3.js'
import { ethers } from 'ethers'

import { MAINNET_CONFIG } from '../config/mainnet'

import { BRIDGE_CODE_AUDIT_TARGET, IN_FLIGHT_SCANNER_VERSION, InFlightManifest } from './inFlightInventory'
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
import { SOLANA_OBSERVATION_MODEL, SolanaCommonContextEvidence } from './solanaCommonContext'

export const PRODUCTION_SOLANA_ENDPOINT = '76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6'
export const PRODUCTION_ROBINHOOD_ENDPOINT = '0x6f475642a6e85809b1c36fa62763669b1b48dd5b'
export const PRODUCTION_SOLANA_OFT_PROGRAM = '9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD'
export const SOLANA_UPGRADEABLE_LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111'

export enum ProductionExpectedState {
    PRE_ACTIVATION_INERT = 'PRE_ACTIVATION_INERT',
    CANARY_ACTIVE = 'CANARY_ACTIVE',
}

export interface ProductionAuthorityPolicy {
    solanaUpgradeAuthority: string
    solanaStoreAdmin: string
    solanaDelegate: string
    robinhoodOwner: string
    robinhoodDelegate: string
    solanaPauser: string
    solanaUnpauser: string
}

export interface ApprovedProductionState extends ProductionAuthorityPolicy {
    solanaOftStore: string
    solanaEscrow: string
    robinhoodOft: string
    robinhoodSourceConfirmations: bigint | null
    rateLimitProfile: ProductionRateLimitProfile
    expectedRobinhoodSupplyRaw: bigint
    expectedSolanaMintSupplyRaw: bigint
    expectedSolanaMintAuthority: string | null
    expectedSolanaFreezeAuthority: string | null
    forbiddenSolanaBootstrapAuthorities: string[]
    forbiddenRobinhoodBootstrapAuthorities: string[]
    expectedSolanaProgramData: string
    expectedSolanaProgramDataSha256: string
    expectedRobinhoodRuntimeCodeHash: string
    expectedInFlight: {
        inventoryId: string
        inventorySha256: string
        scannerSourceCommit: string
        solanaFromSlot: bigint
        solanaToSlot: bigint
        robinhoodFromBlock: bigint
        robinhoodToBlock: bigint
        solanaToRobinhoodRaw: bigint
        robinhoodToSolanaRaw: bigint
    }
}

export interface ProductionMainnetObservation {
    solana: {
        eid: number
        mint: string
        tokenProgram: string
        decimals: number
        sharedDecimals: number
        oftType: number
        mintSupplyRaw: bigint
        mintAuthority: string | null
        freezeAuthority: string | null
        programId: string
        endpoint: string
        oftStore: string
        escrow: string
        tvlRaw: bigint
        escrowBalanceRaw: bigint
        upgradeAuthority: string
        storeAdmin: string
        delegate: string
        paused: boolean
        pauser: string | null
        unpauser: string | null
        programExecutable: boolean
        programOwner: string
        programData: string
        programDataSha256: string
        programDataOwner: string
        programDataExecutable: boolean
        escrowProgramOwner: string
        escrowMint: string
        escrowAuthority: string
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
        paused: boolean
        runtimeCodeHash: string
        proxyImplementation: string | null
        proxyAdmin: string | null
        blockHash: string
    }
    layerZero: BridgeObservation
    enforcedOptions: {
        solanaReceive: { gasOrCompute: bigint; value: bigint }
        robinhoodReceive: { gasOrCompute: bigint; value: bigint }
    }
    rateLimits: Partial<ProductionRateLimitPlan>
    solanaContext: SolanaCommonContextEvidence
    inFlight: {
        manifest: InFlightManifest
        inventoryId: string
        inventorySha256: string
        messageCount: number
        solanaSlot: bigint
        robinhoodBlock: bigint
        solanaToRobinhoodRaw: bigint
        robinhoodToSolanaRaw: bigint
    }
}

const validateSolanaContextEvidence = (evidence: SolanaCommonContextEvidence): void => {
    if (evidence.model !== SOLANA_OBSERVATION_MODEL || evidence.commitment !== 'finalized') {
        throw new Error('Production Solana state is not backed by COMMON_CONTEXT_STRONG finalized evidence')
    }
    if (
        evidence.contextSlot <= 0n ||
        evidence.finalizedSlotBefore <= 0n ||
        evidence.finalizedSlotAfter <= 0n ||
        evidence.contextSlot < evidence.finalizedSlotBefore ||
        evidence.contextSlot > evidence.finalizedSlotAfter
    ) {
        throw new Error('Solana common-context slot is stale or outside the finalized observation window')
    }
    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(evidence.blockhash)) {
        throw new Error('Solana common-context block evidence is missing or malformed')
    }
    const required = new Set([
        'OFT Store',
        'OFT peer config',
        'canonical SAN mint',
        'SAN escrow token account',
        'production OFT program',
        'production OFT ProgramData',
        'LayerZero Endpoint program',
        'LayerZero ULN302 program',
        'Endpoint OApp registry',
        'Endpoint default send-library config',
        'Endpoint app send-library config',
        'Endpoint default receive-library config',
        'Endpoint app receive-library config',
        'ULN message-library PDA',
        'ULN custom send config',
        'ULN custom receive config',
    ])
    const addresses = new Set<string>()
    for (const account of evidence.accounts) {
        if (addresses.has(account.address))
            throw new Error('Solana common-context evidence contains a duplicate account')
        addresses.add(account.address)
        required.delete(account.label)
        requireHash(account.accountSha256, `Solana common-context ${account.label} account hash`)
    }
    if (required.size !== 0) {
        throw new Error(`Solana common-context evidence is missing required accounts: ${[...required].join(', ')}`)
    }
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

const requireHash = (value: string, label: string): void => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label} must be an explicit 32-byte hash`)
}

const isSameSolanaAddress = (left: string, right: string): boolean => new PublicKey(left).equals(new PublicKey(right))

const isSameEvmAddress = (left: string, right: string): boolean =>
    ethers.utils.getAddress(left) === ethers.utils.getAddress(right)

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
        ['approved Solana pauser', approved.solanaPauser],
        ['approved Solana unpauser', approved.solanaUnpauser],
        ['approved Solana ProgramData', approved.expectedSolanaProgramData],
    ] as const) {
        requireSolanaAddress(value, label)
    }
    requireEvmAddress(approved.robinhoodOft, 'approved Robinhood OFT')
    requireEvmAddress(approved.robinhoodOwner, 'approved Robinhood owner')
    requireEvmAddress(approved.robinhoodDelegate, 'approved Robinhood delegate')
    requireHash(approved.expectedSolanaProgramDataSha256, 'approved Solana ProgramData SHA-256')
    requireHash(approved.expectedRobinhoodRuntimeCodeHash, 'approved Robinhood runtime code hash')
    requireHash(approved.expectedInFlight.inventorySha256, 'approved in-flight inventory SHA-256')
    if (!/^[0-9a-f]{40}$/.test(approved.expectedInFlight.scannerSourceCommit)) {
        throw new Error('Approved in-flight scanner source commit must be an exact Git commit')
    }
    for (const [label, value] of [
        ['approved Solana mint authority', approved.expectedSolanaMintAuthority],
        ['approved Solana freeze authority', approved.expectedSolanaFreezeAuthority],
    ] as const) {
        if (value != null) requireSolanaAddress(value, label)
    }
    if (approved.expectedSolanaMintSupplyRaw < 0n) throw new Error('Approved Solana mint supply cannot be negative')
    if (approved.forbiddenSolanaBootstrapAuthorities.length === 0) {
        throw new Error('At least one forbidden Solana bootstrap authority is required')
    }
    if (approved.forbiddenRobinhoodBootstrapAuthorities.length === 0) {
        throw new Error('At least one forbidden Robinhood bootstrap authority is required')
    }
    approved.forbiddenSolanaBootstrapAuthorities.forEach((value, index) =>
        requireSolanaAddress(value, `forbidden Solana bootstrap authority ${index}`)
    )
    approved.forbiddenRobinhoodBootstrapAuthorities.forEach((value, index) =>
        requireEvmAddress(value, `forbidden Robinhood bootstrap authority ${index}`)
    )
    if (approved.expectedInFlight.solanaToRobinhoodRaw < 0n || approved.expectedInFlight.robinhoodToSolanaRaw < 0n) {
        throw new Error('Approved in-flight amounts cannot be negative')
    }
    if (
        approved.expectedInFlight.solanaFromSlot < 0n ||
        approved.expectedInFlight.solanaToSlot <= 0n ||
        approved.expectedInFlight.solanaFromSlot > approved.expectedInFlight.solanaToSlot ||
        approved.expectedInFlight.robinhoodFromBlock < 0n ||
        approved.expectedInFlight.robinhoodToBlock <= 0n ||
        approved.expectedInFlight.robinhoodFromBlock > approved.expectedInFlight.robinhoodToBlock
    ) {
        throw new Error('Approved in-flight finalized scan ranges are invalid')
    }
    if (!approved.expectedInFlight.inventoryId.trim()) throw new Error('Approved in-flight inventory ID is required')
}

/**
 * Validates a complete read-only production snapshot against explicitly
 * approved addresses and values. Missing policy is always an error.
 */
export function validateProductionMainnetObservation(
    observation: ProductionMainnetObservation,
    approved: ApprovedProductionState,
    expectedState: ProductionExpectedState
): void {
    validateApprovedState(approved)
    validateSolanaContextEvidence(observation.solanaContext)

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
    if (observation.solana.oftType !== 1) throw new Error('Solana OFT Store is not in Adapter mode')
    if (observation.solana.mintSupplyRaw !== approved.expectedSolanaMintSupplyRaw) {
        throw new Error('Canonical SAN mint supply differs from the approved snapshot')
    }
    if (observation.solana.mintAuthority !== approved.expectedSolanaMintAuthority) {
        throw new Error('Canonical SAN mint authority differs from the approved value')
    }
    if (observation.solana.freezeAuthority !== approved.expectedSolanaFreezeAuthority) {
        throw new Error('Canonical SAN freeze authority differs from the approved value')
    }
    if (!observation.solana.programExecutable) throw new Error('Solana OFT program account is not executable')
    equalSolanaAddress(observation.solana.programOwner, SOLANA_UPGRADEABLE_LOADER, 'Solana program owner')
    equalSolanaAddress(observation.solana.programData, approved.expectedSolanaProgramData, 'Solana ProgramData account')
    equalSolanaAddress(observation.solana.programDataOwner, SOLANA_UPGRADEABLE_LOADER, 'Solana ProgramData owner')
    if (observation.solana.programDataExecutable) throw new Error('Solana ProgramData account must not be executable')
    requireHash(observation.solana.programDataSha256, 'observed Solana ProgramData SHA-256')
    if (observation.solana.programDataSha256.toLowerCase() !== approved.expectedSolanaProgramDataSha256.toLowerCase()) {
        throw new Error('Solana ProgramData hash differs from the approved reproducible artifact')
    }
    equalSolanaAddress(observation.solana.escrowProgramOwner, LEGACY_SPL_TOKEN_PROGRAM, 'escrow token program owner')
    equalSolanaAddress(observation.solana.escrowMint, CANONICAL_SAN_MINT, 'escrow mint')
    equalSolanaAddress(observation.solana.escrowAuthority, approved.solanaOftStore, 'escrow authority')
    requireHash(observation.robinhood.runtimeCodeHash, 'observed Robinhood runtime code hash')
    if (
        observation.robinhood.runtimeCodeHash.toLowerCase() !== approved.expectedRobinhoodRuntimeCodeHash.toLowerCase()
    ) {
        throw new Error('Robinhood runtime bytecode hash differs from the approved artifact')
    }
    if (observation.robinhood.proxyImplementation != null || observation.robinhood.proxyAdmin != null) {
        throw new Error('Robinhood SanOFT must be a non-proxy deployment')
    }
    if (observation.robinhood.decimals !== 6 || observation.robinhood.sharedDecimals !== 6) {
        throw new Error('Robinhood decimals/sharedDecimals must both equal 6')
    }
    if (observation.solana.escrowBalanceRaw < observation.solana.tvlRaw) {
        throw new Error('Solana escrow balance is below OFT Store TVL')
    }
    if (observation.robinhood.totalSupplyRaw !== approved.expectedRobinhoodSupplyRaw) {
        throw new Error('Robinhood supply differs from the explicitly approved expected supply')
    }
    if (observation.inFlight.solanaSlot <= 0n || observation.inFlight.robinhoodBlock <= 0n) {
        throw new Error('In-flight accounting requires explicit positive RPC snapshot heights')
    }
    if (observation.inFlight.solanaSlot !== observation.solanaContext.contextSlot) {
        throw new Error('In-flight Solana anchor is not bound to the common-context account snapshot')
    }
    const manifest = observation.inFlight.manifest
    if (
        manifest.scanner.version !== IN_FLIGHT_SCANNER_VERSION ||
        manifest.scanner.bridgeCodeAuditTarget !== BRIDGE_CODE_AUDIT_TARGET ||
        manifest.scanner.scannerSourceCommit !== approved.expectedInFlight.scannerSourceCommit
    ) {
        throw new Error('In-flight manifest scanner/audit identity differs from the approved tooling target')
    }
    equalSolanaAddress(manifest.identities.solana.oftStore, approved.solanaOftStore, 'manifest Solana OFT Store')
    equalSolanaAddress(
        manifest.identities.solana.oftProgram,
        PRODUCTION_SOLANA_OFT_PROGRAM,
        'manifest Solana OFT program'
    )
    equalSolanaAddress(manifest.identities.solana.endpoint, PRODUCTION_SOLANA_ENDPOINT, 'manifest Solana Endpoint')
    equalEvmAddress(manifest.identities.robinhood.oft, approved.robinhoodOft, 'manifest Robinhood OFT')
    equalEvmAddress(
        manifest.identities.robinhood.endpoint,
        PRODUCTION_ROBINHOOD_ENDPOINT,
        'manifest Robinhood Endpoint'
    )
    if (
        BigInt(manifest.ranges.solana.fromSlot) !== approved.expectedInFlight.solanaFromSlot ||
        BigInt(manifest.ranges.solana.toSlot) !== approved.expectedInFlight.solanaToSlot ||
        BigInt(manifest.ranges.robinhood.fromBlock) !== approved.expectedInFlight.robinhoodFromBlock ||
        BigInt(manifest.ranges.robinhood.toBlock) !== approved.expectedInFlight.robinhoodToBlock
    ) {
        throw new Error('In-flight manifest ranges differ from the explicitly approved finalized ranges')
    }
    const manifestSolanaEnd = BigInt(manifest.ranges.solana.toSlot)
    const manifestRobinhoodEnd = BigInt(manifest.ranges.robinhood.toBlock)
    if (
        manifestSolanaEnd > observation.solanaContext.contextSlot ||
        manifestRobinhoodEnd > observation.inFlight.robinhoodBlock ||
        (manifestSolanaEnd === observation.solanaContext.contextSlot &&
            manifest.ranges.solana.endBlockhash !== observation.solanaContext.blockhash) ||
        (manifestRobinhoodEnd === observation.inFlight.robinhoodBlock &&
            manifest.ranges.robinhood.endBlockHash.toLowerCase() !== observation.robinhood.blockHash.toLowerCase())
    ) {
        throw new Error('In-flight manifest end anchors are newer than or conflict with the production state snapshot')
    }
    if (
        observation.inFlight.inventoryId !== approved.expectedInFlight.inventoryId ||
        observation.inFlight.inventorySha256.toLowerCase() !==
            approved.expectedInFlight.inventorySha256.toLowerCase() ||
        observation.inFlight.solanaToRobinhoodRaw !== approved.expectedInFlight.solanaToRobinhoodRaw ||
        observation.inFlight.robinhoodToSolanaRaw !== approved.expectedInFlight.robinhoodToSolanaRaw
    ) {
        throw new Error('Observed in-flight amounts differ from the independently approved message inventory')
    }
    requireHash(observation.inFlight.inventorySha256, 'observed in-flight inventory SHA-256')
    if (!Number.isSafeInteger(observation.inFlight.messageCount) || observation.inFlight.messageCount < 0) {
        throw new Error('Observed in-flight message count is invalid')
    }
    const accountedRaw =
        observation.robinhood.totalSupplyRaw +
        observation.inFlight.solanaToRobinhoodRaw +
        observation.inFlight.robinhoodToSolanaRaw
    if (observation.solana.tvlRaw !== accountedRaw) {
        throw new Error('Solana TVL does not exactly equal Robinhood supply plus both in-flight directions')
    }

    equalSolanaAddress(observation.solana.upgradeAuthority, approved.solanaUpgradeAuthority, 'Solana upgrade authority')
    equalSolanaAddress(observation.solana.storeAdmin, approved.solanaStoreAdmin, 'Solana Store admin')
    equalSolanaAddress(observation.solana.delegate, approved.solanaDelegate, 'Solana delegate')
    if (observation.solana.pauser == null) throw new Error('Solana pauser is not configured')
    if (observation.solana.unpauser == null) throw new Error('Solana unpauser is not configured')
    equalSolanaAddress(observation.solana.pauser, approved.solanaPauser, 'Solana pauser')
    equalSolanaAddress(observation.solana.unpauser, approved.solanaUnpauser, 'Solana unpauser')
    equalEvmAddress(observation.robinhood.owner, approved.robinhoodOwner, 'Robinhood owner')
    equalEvmAddress(observation.robinhood.delegate, approved.robinhoodDelegate, 'Robinhood delegate')

    const solanaPrivileged = [
        observation.solana.upgradeAuthority,
        observation.solana.storeAdmin,
        observation.solana.delegate,
        observation.solana.pauser,
        observation.solana.unpauser,
    ] as string[]
    for (const bootstrap of approved.forbiddenSolanaBootstrapAuthorities) {
        if (solanaPrivileged.some((authority) => isSameSolanaAddress(authority, bootstrap))) {
            throw new Error('A Solana privileged role is still controlled by a forbidden bootstrap authority')
        }
    }
    const robinhoodPrivileged = [observation.robinhood.owner, observation.robinhood.delegate]
    for (const bootstrap of approved.forbiddenRobinhoodBootstrapAuthorities) {
        if (robinhoodPrivileged.some((authority) => isSameEvmAddress(authority, bootstrap))) {
            throw new Error('A Robinhood privileged role is still controlled by a forbidden bootstrap authority')
        }
    }

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
    for (const [label, limit] of [
        ['Solana outbound', observation.rateLimits.solana?.outbound],
        ['Solana inbound', observation.rateLimits.solana?.inbound],
        ['Robinhood outbound', observation.rateLimits.robinhood?.outbound],
        ['Robinhood inbound', observation.rateLimits.robinhood?.inbound],
    ] as const) {
        if (limit?.available == null || limit.available < 0n || limit.available > limit.capacity) {
            throw new Error(`${label} available capacity is missing or outside its configured bucket`)
        }
    }

    if (expectedState === ProductionExpectedState.PRE_ACTIVATION_INERT) {
        if (!observation.solana.paused || !observation.robinhood.paused) {
            throw new Error('PRE_ACTIVATION_INERT requires both bridge applications paused')
        }
    } else if (expectedState === ProductionExpectedState.CANARY_ACTIVE) {
        if (observation.solana.paused || observation.robinhood.paused) {
            throw new Error('CANARY_ACTIVE requires both bridge applications unpaused')
        }
        if (
            observation.solana.tvlRaw !== 0n ||
            observation.solana.escrowBalanceRaw !== 0n ||
            observation.robinhood.totalSupplyRaw !== 0n ||
            observation.inFlight.solanaToRobinhoodRaw !== 0n ||
            observation.inFlight.robinhoodToSolanaRaw !== 0n ||
            observation.inFlight.messageCount !== 0
        ) {
            throw new Error('CANARY_ACTIVE is only valid for the initial zero-state public activation boundary')
        }
    } else {
        throw new Error('An explicit supported production activation state is required')
    }
}

export function validateRepeatedProductionObservations(
    first: ProductionMainnetObservation,
    second: ProductionMainnetObservation
): void {
    const stable = (value: ProductionMainnetObservation): string => {
        const normalized = {
            ...value,
            robinhood: { ...value.robinhood, blockHash: undefined },
            solanaContext: {
                ...value.solanaContext,
                contextSlot: undefined,
                finalizedSlotBefore: undefined,
                finalizedSlotAfter: undefined,
                blockhash: undefined,
                parentSlot: undefined,
            },
            inFlight: { ...value.inFlight, solanaSlot: undefined, robinhoodBlock: undefined },
        }
        return JSON.stringify(normalized, (_, item) => (typeof item === 'bigint' ? item.toString() : item))
    }
    if (stable(first) !== stable(second)) {
        throw new Error('Two consecutive production observations differ; refusing a composite or changing RPC snapshot')
    }
}

export async function collectRepeatedProductionObservations(
    collector: () => Promise<ProductionMainnetObservation>
): Promise<[ProductionMainnetObservation, ProductionMainnetObservation]> {
    const first = await collector()
    const second = await collector()
    return [first, second]
}
