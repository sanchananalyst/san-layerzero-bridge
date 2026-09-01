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
