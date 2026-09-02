import { createHash } from 'crypto'

import { parseInFlightInventory } from '../../scripts/inFlightInventory'

const inventoryBytes = (messages: unknown[]): string =>
    JSON.stringify({ schemaVersion: 1, inventoryId: 'review-1', messages })

describe('production in-flight inventory', () => {
    it('derives directional totals and a content hash from unique GUID entries', () => {
        const bytes = inventoryBytes([
            {
                guid: `0x${'11'.repeat(32)}`,
                direction: 'solana-to-robinhood',
                amountRaw: '7',
                status: 'in_flight',
            },
            {
                guid: `0x${'22'.repeat(32)}`,
                direction: 'robinhood-to-solana',
                amountRaw: '9',
                status: 'in_flight',
            },
        ])
        expect(parseInFlightInventory(bytes)).toEqual({
            inventoryId: 'review-1',
            inventorySha256: `0x${createHash('sha256').update(bytes, 'utf8').digest('hex')}`,
            messageCount: 2,
            solanaToRobinhoodRaw: 7n,
            robinhoodToSolanaRaw: 9n,
        })
    })

    it('rejects duplicate GUIDs, zero amounts, unknown directions, and non-in-flight entries', () => {
        const valid = {
            guid: `0x${'11'.repeat(32)}`,
            direction: 'solana-to-robinhood',
            amountRaw: '1',
            status: 'in_flight',
        }
        expect(() => parseInFlightInventory(inventoryBytes([valid, valid]))).toThrow('duplicate GUID')
        expect(() => parseInFlightInventory(inventoryBytes([{ ...valid, amountRaw: '0' }]))).toThrow(
            'positive raw amount'
        )
        expect(() => parseInFlightInventory(inventoryBytes([{ ...valid, direction: 'unknown' }]))).toThrow(
            'invalid direction'
        )
        expect(() => parseInFlightInventory(inventoryBytes([{ ...valid, status: 'delivered' }]))).toThrow(
            'not in_flight'
        )
    })
})
