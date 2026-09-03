import fs from 'fs'

import { PublicKey } from '@solana/web3.js'

import { PRODUCTION_ROBINHOOD_ENDPOINT } from '../../scripts/productionMainnetPolicy'
import { PRODUCTION_RATE_LIMIT_PROFILES } from '../../scripts/productionRateLimitPolicy'
import {
    AuthorityHandoffTargets,
    buildAuthorityHandoffSimulation,
    buildProductionWiringPreview,
    requireFutureMainnetExecution,
    validateSanOftDeploymentPlan,
    verifyAuthorityHandoffReadback,
} from '../../scripts/productionToolingPolicy'

const solanaAddress = (fill: number): string => new PublicKey(Uint8Array.from({ length: 32 }, () => fill)).toBase58()
const evmAddress = (fill: string): string => `0x${fill.repeat(40)}`

const rateLimits = () => {
    const profile = PRODUCTION_RATE_LIMIT_PROFILES.canary
    const solana = { capacity: profile.capacity, refill: profile.refillPerSecond }
    const robinhood = { capacity: profile.capacity, refill: profile.capacity, durationSeconds: 86_400n }
    return {
        solana: { outbound: { ...solana }, inbound: { ...solana } },
        robinhood: { outbound: { ...robinhood }, inbound: { ...robinhood } },
    }
}

describe('production transaction-tooling dry runs', () => {
    it('keeps mainnet execution disabled without a future phase token', () => {
        expect(() => requireFutureMainnetExecution(undefined)).toThrow('disabled')
        expect(() => requireFutureMainnetExecution('PHASE_5A')).toThrow('disabled')
        expect(() => requireFutureMainnetExecution('PHASE_5B_EXPLICITLY_AUTHORIZED')).toThrow(
            'structurally disabled in the Phase 5A revision'
        )
    })

    it('does not register legacy secret-export or direct mutation tasks', () => {
        const registry = fs.readFileSync('tasks/index.ts', 'utf8')
        for (const unsafeImport of [
            './common/sendOFT',
            './solana/createOFT',
            './solana/retryMessage',
            './solana/setAuthority',
            './solana/updateMetadata',
            './solana/setUpdateAuthority',
            './solana/base58',
            './solana/endpoint/skip',
            './solana/endpoint/burn',
            './solana/endpoint/clear',
            './solana/endpoint/nilify',
        ]) {
            expect(registry.split('\n')).not.toContain(`import '${unsafeImport}'`)
        }
        expect(fs.existsSync('tasks/solana/base58.ts')).toBe(false)
    })

    it('validates the EVM deployment identity without deploying', () => {
        expect(() =>
            validateSanOftDeploymentPlan({
                chainId: 4663,
                eid: 30416,
                endpoint: PRODUCTION_ROBINHOOD_ENDPOINT,
                owner: evmAddress('1'),
                delegate: evmAddress('1'),
                name: 'San Chan',
                symbol: 'SAN',
                decimals: 6,
                initialSupplyRaw: 0n,
                upgradeable: false,
            })
        ).not.toThrow()
        expect(() =>
            validateSanOftDeploymentPlan({
                chainId: 46630,
                eid: 40451,
                endpoint: PRODUCTION_ROBINHOOD_ENDPOINT,
                owner: evmAddress('1'),
                delegate: evmAddress('1'),
                name: 'San Chan',
                symbol: 'SAN',
                decimals: 6,
                initialSupplyRaw: 0n,
                upgradeable: false,
            })
        ).toThrow('4663/30416')
    })

    it('builds a zero-transaction wiring preview and fails closed without confirmations', () => {
        const preview = buildProductionWiringPreview({
            solanaOftStore: solanaAddress(1),
            robinhoodOft: evmAddress('1'),
            robinhoodSourceConfirmations: 30n,
            rateLimits: rateLimits(),
            rateLimitProfile: PRODUCTION_RATE_LIMIT_PROFILES.canary,
        })
        expect(preview.transactions).toBe(0)
        expect(preview.requiredDirectionalLimiters).toBe(4)
        expect(preview.robinhoodSourceConfirmations).toBe(30n)
        expect(() =>
            buildProductionWiringPreview({
                solanaOftStore: solanaAddress(1),
                robinhoodOft: evmAddress('1'),
                robinhoodSourceConfirmations: null,
                rateLimits: rateLimits(),
                rateLimitProfile: PRODUCTION_RATE_LIMIT_PROFILES.canary,
            })
        ).toThrow('explicitly approved')
        expect(() =>
            buildProductionWiringPreview({
                solanaOftStore: solanaAddress(1),
                robinhoodOft: evmAddress('1'),
                robinhoodSourceConfirmations: 31n,
                rateLimits: rateLimits(),
                rateLimitProfile: PRODUCTION_RATE_LIMIT_PROFILES.canary,
            })
        ).toThrow('frozen 30-block policy')
    })

    it('simulates ordered authority handoff and rejects residual deployer authority', () => {
        const targets: AuthorityHandoffTargets = {
            bootstrapSolanaAuthority: solanaAddress(9),
            bootstrapRobinhoodAuthority: evmAddress('9'),
            solanaUpgradeAuthority: solanaAddress(2),
            solanaStoreAdmin: solanaAddress(3),
            solanaDelegate: solanaAddress(4),
            robinhoodOwner: evmAddress('2'),
            robinhoodDelegate: evmAddress('2'),
        }
        expect(buildAuthorityHandoffSimulation(targets).map(({ order }) => order)).toEqual([1, 2, 3, 4, 5])
        expect(() =>
            verifyAuthorityHandoffReadback(
                {
                    solanaUpgradeAuthority: targets.solanaUpgradeAuthority,
                    solanaStoreAdmin: targets.solanaStoreAdmin,
                    solanaDelegate: targets.solanaDelegate,
                    robinhoodOwner: targets.robinhoodOwner,
                    robinhoodDelegate: targets.robinhoodDelegate,
                },
                targets
            )
        ).not.toThrow()
        expect(() =>
            verifyAuthorityHandoffReadback(
                {
                    solanaUpgradeAuthority: targets.bootstrapSolanaAuthority,
                    solanaStoreAdmin: targets.solanaStoreAdmin,
                    solanaDelegate: targets.solanaDelegate,
                    robinhoodOwner: targets.robinhoodOwner,
                    robinhoodDelegate: targets.robinhoodDelegate,
                },
                targets
            )
        ).toThrow()
    })
})
