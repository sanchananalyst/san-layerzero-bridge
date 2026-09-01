export const PRODUCTION_RATE_LIMIT_PROFILES = Object.freeze({
    canary: Object.freeze({ capacity: 500_000_000_000n, refillPerSecond: 5_787_037n }),
    publicLaunch: Object.freeze({ capacity: 30_000_000_000_000n, refillPerSecond: 347_222_222n }),
    normal: Object.freeze({ capacity: 50_000_000_000_000n, refillPerSecond: 578_703_703n }),
})

export interface DirectionalRateLimit {
    capacity: bigint
    refill: bigint
    durationSeconds?: bigint
}

export interface ProductionRateLimitPlan {
    solana: {
        outbound: DirectionalRateLimit
        inbound: DirectionalRateLimit
    }
    robinhood: {
        outbound: DirectionalRateLimit
        inbound: DirectionalRateLimit
    }
}

export interface ProductionRateLimitProfile {
    capacity: bigint
    refillPerSecond: bigint
}

export interface SolanaProductionRateLimitTask {
    localEid: number
    peerEid: number
    mint: string
    programId: string
    oftStore: string
    approvedOftStore: string
    capacity: bigint
    refillPerSecond: bigint
}

const FORBIDDEN_TEST_OFT_STORE = '49DdSvei9Yo2ymJYDYgNTo8JqGha6HNynKxSXxqzggSv'

const isSolanaPublicKey = (value: string): boolean => {
    try {
        return bs58.decode(value).length === 32
    } catch {
        return false
    }
}

export const validateSolanaProductionRateLimitTask = (task: SolanaProductionRateLimitTask): string => {
    if (task.localEid !== 30168) throw new Error('Production Solana rate limit requires local EID 30168')
    if (task.peerEid !== 30416) throw new Error('Production Solana rate limit requires Robinhood peer EID 30416')
    if (task.mint !== CANONICAL_SAN_MINT) throw new Error('Production Solana rate limit requires canonical SAN mint')
    if (task.programId !== PRODUCTION_SOLANA_OFT_PROGRAM_ID) {
        throw new Error('Production Solana rate limit requires the approved production OFT program')
    }
    if (!isSolanaPublicKey(task.oftStore) || task.oftStore === FORBIDDEN_TEST_OFT_STORE) {
        throw new Error('Production Solana rate limit requires a non-testnet OFT Store public key')
    }
    if (
        !isSolanaPublicKey(task.approvedOftStore) ||
        !new PublicKey(task.oftStore).equals(new PublicKey(task.approvedOftStore))
    ) {
        throw new Error('Production Solana rate limit requires the exact explicitly approved OFT Store')
    }
    const match = Object.entries(PRODUCTION_RATE_LIMIT_PROFILES).find(
        ([, profile]) => profile.capacity === task.capacity && profile.refillPerSecond === task.refillPerSecond
    )
    if (!match) throw new Error('Production Solana rate limit does not match an approved profile')
    return match[0]
}

const requireDirection = (name: string, value: DirectionalRateLimit | undefined, evm: boolean): void => {
    if (value == null) throw new Error(`Missing required production rate limiter: ${name}`)
    if (value.capacity <= 0n || value.refill <= 0n) throw new Error(`Invalid production rate limiter: ${name}`)
    if (evm && value.durationSeconds !== 86_400n) {
        throw new Error(`Robinhood rate limiter must use an explicit 86400-second duration: ${name}`)
    }
}

/**
 * Validates the complete four-direction production matrix. This deliberately
 * fails closed: an omitted direction is an error, never an uncapped default.
 */
export const validateProductionRateLimitPlan = (
    plan: Partial<ProductionRateLimitPlan>,
    expected: ProductionRateLimitProfile
): void => {
    requireDirection('Solana outbound', plan.solana?.outbound, false)
    requireDirection('Solana inbound', plan.solana?.inbound, false)
    requireDirection('Robinhood outbound', plan.robinhood?.outbound, true)
    requireDirection('Robinhood inbound', plan.robinhood?.inbound, true)

    const directions = [
        plan.solana?.outbound,
        plan.solana?.inbound,
        plan.robinhood?.outbound,
        plan.robinhood?.inbound,
    ] as DirectionalRateLimit[]
    if (directions.some(({ capacity }) => capacity !== expected.capacity)) {
        throw new Error('Production rate-limit capacity differs from the explicitly selected profile')
    }
    if (
        plan.solana?.outbound.refill !== expected.refillPerSecond ||
        plan.solana?.inbound.refill !== expected.refillPerSecond
    ) {
        throw new Error('Solana refill differs from the explicitly selected profile')
    }
    if (plan.robinhood?.outbound.refill !== expected.capacity || plan.robinhood?.inbound.refill !== expected.capacity) {
        throw new Error('Robinhood refill amount must equal the explicitly selected capacity')
    }
}
import { PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'

import { CANONICAL_SAN_MINT, PRODUCTION_SOLANA_OFT_PROGRAM_ID } from './sanMintConfig'
