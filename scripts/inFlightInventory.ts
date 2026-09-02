import { createHash } from 'crypto'

export interface InFlightInventory {
    inventoryId: string
    inventorySha256: string
    messageCount: number
    solanaToRobinhoodRaw: bigint
    robinhoodToSolanaRaw: bigint
}

export const parseInFlightInventory = (contents: string): InFlightInventory => {
    const sha256 = `0x${createHash('sha256').update(contents, 'utf8').digest('hex')}`
    const value = JSON.parse(contents) as {
        schemaVersion?: unknown
        inventoryId?: unknown
        messages?: Array<{ guid?: unknown; direction?: unknown; amountRaw?: unknown; status?: unknown }>
    }
    if (value.schemaVersion !== 1 || typeof value.inventoryId !== 'string' || !value.inventoryId.trim()) {
        throw new Error('In-flight inventory has an invalid schema or ID')
    }
    if (!Array.isArray(value.messages)) throw new Error('In-flight inventory messages must be an array')
    const seen = new Set<string>()
    let solanaToRobinhoodRaw = 0n
    let robinhoodToSolanaRaw = 0n
    for (const message of value.messages) {
        if (typeof message.guid !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(message.guid)) {
            throw new Error('In-flight inventory contains an invalid LayerZero GUID')
        }
        const guid = message.guid.toLowerCase()
        if (seen.has(guid)) throw new Error(`In-flight inventory contains duplicate GUID ${guid}`)
        seen.add(guid)
        if (message.status !== 'in_flight') throw new Error(`In-flight inventory GUID ${guid} is not in_flight`)
        if (typeof message.amountRaw !== 'string' || !/^\d+$/.test(message.amountRaw)) {
            throw new Error(`In-flight inventory GUID ${guid} has an invalid raw amount`)
        }
        const amount = BigInt(message.amountRaw)
        if (amount <= 0n) throw new Error(`In-flight inventory GUID ${guid} must have a positive raw amount`)
        if (message.direction === 'solana-to-robinhood') solanaToRobinhoodRaw += amount
        else if (message.direction === 'robinhood-to-solana') robinhoodToSolanaRaw += amount
        else throw new Error(`In-flight inventory GUID ${guid} has an invalid direction`)
    }
    return {
        inventoryId: value.inventoryId,
        inventorySha256: sha256,
        messageCount: seen.size,
        solanaToRobinhoodRaw,
        robinhoodToSolanaRaw,
    }
}
