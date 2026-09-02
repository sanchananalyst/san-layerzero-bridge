import { validateCommonContextEnvelope } from '../../scripts/solanaCommonContext'

const fixture = () => ({
    requestedAccounts: 14,
    returnedAccounts: 14,
    finalizedSlotBefore: 100,
    contextSlot: 101,
    finalizedSlotAfter: 102,
    blockSlot: 101,
    blockhash: '7YWHMfk9JZe2LM2g1ZauHuiSxhJ3G5Xj4jn3hE3wq9K',
})

describe('Solana common-context evidence', () => {
    it('accepts one complete finalized batch bound to its context-slot blockhash', () => {
        expect(() => validateCommonContextEnvelope(fixture())).not.toThrow()
    })

    it('rejects stale and future context slots', () => {
        expect(() => validateCommonContextEnvelope({ ...fixture(), contextSlot: 99, blockSlot: 99 })).toThrow(
            'older than the required finalized slot'
        )
        expect(() => validateCommonContextEnvelope({ ...fixture(), contextSlot: 103, blockSlot: 103 })).toThrow(
            'newer than the observed finalized head'
        )
    })

    it('rejects truncation, slot mismatches, and absent block identifiers', () => {
        expect(() => validateCommonContextEnvelope({ ...fixture(), returnedAccounts: 13 })).toThrow('truncated')
        expect(() => validateCommonContextEnvelope({ ...fixture(), blockSlot: 100 })).toThrow(
            'block identifier does not match'
        )
        expect(() => validateCommonContextEnvelope({ ...fixture(), blockhash: null })).toThrow(
            'block identifier does not match'
        )
    })
})
