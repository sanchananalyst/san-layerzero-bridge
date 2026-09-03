import {
    PRODUCTION_RATE_LIMIT_PROFILES,
    ProductionRateLimitPlan,
    productionRateLimitProfile,
    validateProductionRateLimitPlan,
    validateSolanaProductionRateLimitTask,
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
        expect(PRODUCTION_RATE_LIMIT_PROFILES.mature).toEqual({
            capacity: 100_000_000_000_000n,
            refillPerSecond: 1_157_407_407n,
        })
    })

    it('selects only one of the four explicit production profiles', () => {
        expect(productionRateLimitProfile('canary')).toBe(PRODUCTION_RATE_LIMIT_PROFILES.canary)
        expect(productionRateLimitProfile('publicLaunch')).toBe(PRODUCTION_RATE_LIMIT_PROFILES.publicLaunch)
        expect(productionRateLimitProfile('normal')).toBe(PRODUCTION_RATE_LIMIT_PROFILES.normal)
        expect(productionRateLimitProfile('mature')).toBe(PRODUCTION_RATE_LIMIT_PROFILES.mature)
        expect(() => productionRateLimitProfile('')).toThrow('must be one of')
        expect(() => productionRateLimitProfile('experimental')).toThrow('must be one of')
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
    const productionTask = () => ({
        localEid: 30168,
        peerEid: 30416,
        mint: 'GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump',
        programId: '9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD',
        oftStore: '8eGbY1MUKMSRoLTSPxen83hPWfT3zTuCVgj2UbS1kKsL',
        approvedOftStore: '8eGbY1MUKMSRoLTSPxen83hPWfT3zTuCVgj2UbS1kKsL',
        capacity: PRODUCTION_RATE_LIMIT_PROFILES.canary.capacity,
        refillPerSecond: PRODUCTION_RATE_LIMIT_PROFILES.canary.refillPerSecond,
    })

    it('accepts the exact production EID and selected profile', () => {
        expect(validateSolanaProductionRateLimitTask(productionTask())).toBe('canary')
    })

    it('rejects wrong local/peer EIDs, test identities, and unapproved values', () => {
        for (const mutate of [
            (value: ReturnType<typeof productionTask>) => (value.localEid = 40168),
            (value: ReturnType<typeof productionTask>) => (value.peerEid = 40451),
            (value: ReturnType<typeof productionTask>) => (value.mint = 'Hec7jHowvQnD1ZHYUt98mWfqh5VoBXdjciC2DQPHcja'),
            (value: ReturnType<typeof productionTask>) =>
                (value.programId = 'EgA4Cc59PAdJvh6G13H3mM3iYprAvwTcU5J8H8jnjoN8'),
            (value: ReturnType<typeof productionTask>) =>
                (value.oftStore = '49DdSvei9Yo2ymJYDYgNTo8JqGha6HNynKxSXxqzggSv'),
            (value: ReturnType<typeof productionTask>) =>
                (value.approvedOftStore = '49DdSvei9Yo2ymJYDYgNTo8JqGha6HNynKxSXxqzggSv'),
            (value: ReturnType<typeof productionTask>) => (value.refillPerSecond -= 1n),
        ]) {
            const value = productionTask()
            mutate(value)
            expect(() => validateSolanaProductionRateLimitTask(value)).toThrow()
        }
    })

    it('uses the caller-supplied destination EID and rethrows send failures', () => {
        const source = require('fs').readFileSync('tasks/solana/setOutboundRateLimit.ts', 'utf8') as string
        expect(source).toContain('sdk.setOutboundRateLimit(taskArgs.dstEid, solanaRateLimits)')
        expect(source).not.toContain('sdk.setOutboundRateLimit(EndpointId.SEPOLIA_V2_TESTNET')
        expect(source).toContain('throw error')
        expect(source).toContain("'broadcast',")
    })
})
