import {
    PRODUCTION_RATE_LIMIT_PROFILES,
    ProductionRateLimitPlan,
    validateProductionRateLimitPlan,
} from '../../scripts/productionRateLimitPolicy'

const plan = (): ProductionRateLimitPlan => {
    const profile = PRODUCTION_RATE_LIMIT_PROFILES.publicLaunch
    const solana = { capacity: profile.capacity, refill: profile.refillPerSecond }
    const robinhood = { capacity: profile.capacity, refill: profile.capacity, durationSeconds: 86_400n }
    return {
        solana: { outbound: { ...solana }, inbound: { ...solana } },
        robinhood: { outbound: { ...robinhood }, inbound: { ...robinhood } },
    }
}

describe('production rate-limit policy', () => {
    it('records the amended exact raw-unit recommendations', () => {
        expect(PRODUCTION_RATE_LIMIT_PROFILES.canary).toEqual({
            capacity: 500_000_000_000n,
            refillPerSecond: 5_787_037n,
        })
        expect(PRODUCTION_RATE_LIMIT_PROFILES.publicLaunch).toEqual({
            capacity: 30_000_000_000_000n,
            refillPerSecond: 347_222_222n,
        })
        expect(PRODUCTION_RATE_LIMIT_PROFILES.normal).toEqual({
            capacity: 50_000_000_000_000n,
            refillPerSecond: 578_703_703n,
        })
    })

    it('accepts an explicit matching four-direction plan', () => {
        expect(() => validateProductionRateLimitPlan(plan(), PRODUCTION_RATE_LIMIT_PROFILES.publicLaunch)).not.toThrow()
    })

    it.each([
        [
            'Solana outbound',
            (value: Partial<ProductionRateLimitPlan>) => Reflect.deleteProperty(value.solana as object, 'outbound'),
        ],
        [
            'Solana inbound',
            (value: Partial<ProductionRateLimitPlan>) => Reflect.deleteProperty(value.solana as object, 'inbound'),
        ],
        [
            'Robinhood outbound',
            (value: Partial<ProductionRateLimitPlan>) => Reflect.deleteProperty(value.robinhood as object, 'outbound'),
        ],
        [
            'Robinhood inbound',
            (value: Partial<ProductionRateLimitPlan>) => Reflect.deleteProperty(value.robinhood as object, 'inbound'),
        ],
    ])('fails closed when %s is omitted', (_, omit) => {
        const value: Partial<ProductionRateLimitPlan> = plan()
        omit(value)
        expect(() => validateProductionRateLimitPlan(value, PRODUCTION_RATE_LIMIT_PROFILES.publicLaunch)).toThrow(
            'Missing required production rate limiter'
        )
    })

    it('rejects a zero limiter and a missing EVM duration', () => {
        const zero = plan()
        zero.solana.inbound.capacity = 0n
        expect(() => validateProductionRateLimitPlan(zero, PRODUCTION_RATE_LIMIT_PROFILES.publicLaunch)).toThrow(
            'Invalid production rate limiter'
        )

        const missingDuration = plan()
        delete missingDuration.robinhood.outbound.durationSeconds
        expect(() =>
            validateProductionRateLimitPlan(missingDuration, PRODUCTION_RATE_LIMIT_PROFILES.publicLaunch)
        ).toThrow('explicit 86400-second duration')
    })

    it('rejects a mismatched directional capacity or refill', () => {
        const wrongCapacity = plan()
        wrongCapacity.robinhood.inbound.capacity -= 1n
        expect(() =>
            validateProductionRateLimitPlan(wrongCapacity, PRODUCTION_RATE_LIMIT_PROFILES.publicLaunch)
        ).toThrow('capacity differs')

        const wrongRefill = plan()
        wrongRefill.solana.outbound.refill -= 1n
        expect(() => validateProductionRateLimitPlan(wrongRefill, PRODUCTION_RATE_LIMIT_PROFILES.publicLaunch)).toThrow(
            'Solana refill differs'
        )
    })
})

describe('Solana rate-limit task regression guards', () => {
    it('uses the caller-supplied destination EID and rethrows send failures', () => {
        const source = require('fs').readFileSync('tasks/solana/setOutboundRateLimit.ts', 'utf8') as string
        expect(source).toContain('sdk.setOutboundRateLimit(taskArgs.dstEid, solanaRateLimits)')
        expect(source).not.toContain('sdk.setOutboundRateLimit(EndpointId.SEPOLIA_V2_TESTNET')
        expect(source).toContain('throw error')
    })
})
