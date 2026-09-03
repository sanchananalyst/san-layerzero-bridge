import { createHash } from 'crypto'

import { SOLANA_MAINNET_GENESIS_HASH } from './sanMintConfig'

export const IN_FLIGHT_SCHEMA_VERSION = 2 as const
export const IN_FLIGHT_SCANNER_NAME = 'scanProductionInFlight' as const
export const IN_FLIGHT_SCANNER_VERSION = '1.0.0' as const
export const BRIDGE_CODE_AUDIT_TARGET = 'd28762288bb5180ff292f57eef7132191f2037ec' as const

export type InFlightDirection = 'solana-to-robinhood' | 'robinhood-to-solana'
export type PacketStatus = 'in_flight' | 'delivered' | 'failed' | 'blocked' | 'unresolved'

export interface InFlightMessageEvidence {
    guid: string
    direction: InFlightDirection
    sourceNonce: string
    sourceTransaction: string
    sourceHeight: string
    sourceBlockHash: string
    sourceEventIndex: number
    sourceOft: string
    destinationOft: string
    amountRaw: string
    receiver: string
    status: PacketStatus
    destinationTransaction: string | null
    destinationHeight: string | null
    destinationBlockHash: string | null
    layerZeroApiStatus: string | null
}

export interface InFlightManifest {
    schemaVersion: typeof IN_FLIGHT_SCHEMA_VERSION
    inventoryId: string
    scanner: {
        name: typeof IN_FLIGHT_SCANNER_NAME
        version: typeof IN_FLIGHT_SCANNER_VERSION
        bridgeCodeAuditTarget: typeof BRIDGE_CODE_AUDIT_TARGET
        scannerSourceCommit: string
    }
    generatedAt: string
    identities: {
        solana: { chain: 'solana-mainnet'; eid: 30168; endpoint: string; oftProgram: string; oftStore: string }
        robinhood: { chainId: 4663; eid: 30416; endpoint: string; oft: string }
    }
    ranges: {
        solana: {
            fromSlot: string
            toSlot: string
            finalizedSlot: string
            genesisHash: string
            startBlockhash: string
            endBlockhash: string
            complete: boolean
            paginationComplete: boolean
        }
        robinhood: {
            fromBlock: string
            toBlock: string
            finalizedBlock: string
            startBlockHash: string
            endBlockHash: string
            complete: boolean
            paginationComplete: boolean
        }
    }
    provenance: {
        model: 'DUAL_RPC_RECONCILED'
        solanaProviders: string[]
        robinhoodProviders: string[]
        sourceEvidenceAgreement: boolean
        destinationEvidenceAgreement: boolean
        layerZeroApiCorroborated: boolean
        layerZeroApiDisagreements: string[]
    }
    messages: InFlightMessageEvidence[]
    summary: {
        resultCount: number
        unresolvedPacketCount: number
        solanaToRobinhoodRaw: string
        robinhoodToSolanaRaw: string
    }
    manifestChecksum: string
}

export interface InFlightInventory {
    manifest: InFlightManifest
    inventoryId: string
    inventorySha256: string
    messageCount: number
    unresolvedPacketCount: number
    solanaToRobinhoodRaw: bigint
    robinhoodToSolanaRaw: bigint
}

const exactKeys = (value: object, expected: string[], label: string): void => {
    const actual = Object.keys(value).sort()
    const wanted = [...expected].sort()
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) throw new Error(`${label} has missing or unknown fields`)
}

export const canonicalJson = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value)
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
        .join(',')}}`
}

export const manifestChecksum = (manifest: Omit<InFlightManifest, 'manifestChecksum'>): string =>
    `0x${createHash('sha256')
        .update(`SAN_IN_FLIGHT_MANIFEST_V2\n${canonicalJson(manifest)}`, 'utf8')
        .digest('hex')}`

const unsignedInteger = (value: unknown, label: string, positive = false): bigint => {
    if (typeof value !== 'string' || !/^\d+$/.test(value))
        throw new Error(`${label} must be an unsigned integer string`)
    const parsed = BigInt(value)
    if (positive && parsed <= 0n) throw new Error(`${label} must be positive`)
    return parsed
}

const hash32 = (value: unknown, label: string): string => {
    if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
        throw new Error(`${label} must be a 32-byte hex hash`)
    }
    return value.toLowerCase()
}

const nonempty = (value: unknown, label: string): string => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`)
    return value
}

const equalIdentity = (actual: string, expected: string): boolean =>
    actual.startsWith('0x') || expected.startsWith('0x')
        ? actual.toLowerCase() === expected.toLowerCase()
        : actual === expected

const validateRange = (manifest: InFlightManifest): void => {
    const { solana, robinhood } = manifest.ranges
    exactKeys(
        solana,
        [
            'fromSlot',
            'toSlot',
            'finalizedSlot',
            'genesisHash',
            'startBlockhash',
            'endBlockhash',
            'complete',
            'paginationComplete',
        ],
        'Solana scan range'
    )
    exactKeys(
        robinhood,
        ['fromBlock', 'toBlock', 'finalizedBlock', 'startBlockHash', 'endBlockHash', 'complete', 'paginationComplete'],
        'Robinhood scan range'
    )
    const solanaFrom = unsignedInteger(solana.fromSlot, 'Solana fromSlot')
    const solanaTo = unsignedInteger(solana.toSlot, 'Solana toSlot', true)
    const solanaFinalized = unsignedInteger(solana.finalizedSlot, 'Solana finalizedSlot', true)
    if (solanaFrom > solanaTo || solanaTo !== solanaFinalized)
        throw new Error('Solana scan range is incomplete or not finalized through its end')
    const robinhoodFrom = unsignedInteger(robinhood.fromBlock, 'Robinhood fromBlock')
    const robinhoodTo = unsignedInteger(robinhood.toBlock, 'Robinhood toBlock', true)
    const robinhoodFinalized = unsignedInteger(robinhood.finalizedBlock, 'Robinhood finalizedBlock', true)
    if (robinhoodFrom > robinhoodTo || robinhoodTo !== robinhoodFinalized) {
        throw new Error('Robinhood scan range is incomplete or not finalized through its end')
    }
    if (!solana.complete || !solana.paginationComplete || !robinhood.complete || !robinhood.paginationComplete) {
        throw new Error('In-flight scanner range or pagination is incomplete')
    }
    if (nonempty(solana.genesisHash, 'Solana genesis hash') !== SOLANA_MAINNET_GENESIS_HASH) {
        throw new Error('In-flight manifest is not bound to the Solana mainnet genesis hash')
    }
    nonempty(solana.startBlockhash, 'Solana start blockhash')
    nonempty(solana.endBlockhash, 'Solana end blockhash')
    hash32(robinhood.startBlockHash, 'Robinhood start block hash')
    hash32(robinhood.endBlockHash, 'Robinhood end block hash')
}

export const parseInFlightInventory = (contents: string): InFlightInventory => {
    const value = JSON.parse(contents) as InFlightManifest
    if (!value || typeof value !== 'object') throw new Error('In-flight manifest must be an object')
    exactKeys(
        value,
        [
            'schemaVersion',
            'inventoryId',
            'scanner',
            'generatedAt',
            'identities',
            'ranges',
            'provenance',
            'messages',
            'summary',
            'manifestChecksum',
        ],
        'In-flight manifest'
    )
    if (value.schemaVersion !== IN_FLIGHT_SCHEMA_VERSION) throw new Error('In-flight manifest schema version must be 2')
    nonempty(value.inventoryId, 'In-flight inventory ID')
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.generatedAt)) {
        throw new Error('In-flight manifest timestamp must be UTC ISO-8601')
    }
    exactKeys(value.scanner, ['name', 'version', 'bridgeCodeAuditTarget', 'scannerSourceCommit'], 'Scanner identity')
    if (
        value.scanner.name !== IN_FLIGHT_SCANNER_NAME ||
        value.scanner.version !== IN_FLIGHT_SCANNER_VERSION ||
        value.scanner.bridgeCodeAuditTarget !== BRIDGE_CODE_AUDIT_TARGET ||
        !/^[0-9a-f]{40}$/.test(value.scanner.scannerSourceCommit)
    ) {
        throw new Error('In-flight scanner identity/version/audit target is not approved')
    }
    exactKeys(value.identities, ['solana', 'robinhood'], 'Manifest identities')
    exactKeys(
        value.identities.solana,
        ['chain', 'eid', 'endpoint', 'oftProgram', 'oftStore'],
        'Solana manifest identity'
    )
    exactKeys(value.identities.robinhood, ['chainId', 'eid', 'endpoint', 'oft'], 'Robinhood manifest identity')
    if (
        value.identities.solana.chain !== 'solana-mainnet' ||
        value.identities.solana.eid !== 30168 ||
        value.identities.robinhood.chainId !== 4663 ||
        value.identities.robinhood.eid !== 30416
    ) {
        throw new Error('In-flight manifest has the wrong production chain identity')
    }
    validateRange(value)
    exactKeys(
        value.provenance,
        [
            'model',
            'solanaProviders',
            'robinhoodProviders',
            'sourceEvidenceAgreement',
            'destinationEvidenceAgreement',
            'layerZeroApiCorroborated',
            'layerZeroApiDisagreements',
        ],
        'Manifest provenance'
    )
    if (
        value.provenance.model !== 'DUAL_RPC_RECONCILED' ||
        value.provenance.solanaProviders.length < 2 ||
        new Set(value.provenance.solanaProviders).size < 2 ||
        value.provenance.robinhoodProviders.length < 2 ||
        new Set(value.provenance.robinhoodProviders).size < 2 ||
        !value.provenance.sourceEvidenceAgreement ||
        !value.provenance.destinationEvidenceAgreement ||
        !value.provenance.layerZeroApiCorroborated
    ) {
        throw new Error('In-flight manifest provenance is missing or unreconciled')
    }
    if (value.provenance.layerZeroApiDisagreements.length !== 0) {
        throw new Error('LayerZero API corroboration disagrees with source-chain evidence')
    }
    if (!Array.isArray(value.messages)) throw new Error('In-flight manifest messages must be an array')
    exactKeys(
        value.summary,
        ['resultCount', 'unresolvedPacketCount', 'solanaToRobinhoodRaw', 'robinhoodToSolanaRaw'],
        'Manifest summary'
    )

    const seen = new Set<string>()
    let solanaToRobinhoodRaw = 0n
    let robinhoodToSolanaRaw = 0n
    let unresolvedPacketCount = 0
    const canonicalOrder = [...value.messages].sort((left, right) =>
        `${left.direction}:${left.sourceHeight.padStart(24, '0')}:${left.sourceTransaction}:${left.sourceEventIndex}:${left.guid}`.localeCompare(
            `${right.direction}:${right.sourceHeight.padStart(24, '0')}:${right.sourceTransaction}:${right.sourceEventIndex}:${right.guid}`
        )
    )
    if (canonicalJson(canonicalOrder) !== canonicalJson(value.messages)) {
        throw new Error('In-flight manifest messages are not in canonical order')
    }
    for (const message of value.messages) {
        exactKeys(
            message,
            [
                'guid',
                'direction',
                'sourceNonce',
                'sourceTransaction',
                'sourceHeight',
                'sourceBlockHash',
                'sourceEventIndex',
                'sourceOft',
                'destinationOft',
                'amountRaw',
                'receiver',
                'status',
                'destinationTransaction',
                'destinationHeight',
                'destinationBlockHash',
                'layerZeroApiStatus',
            ],
            'In-flight message'
        )
        const guid = hash32(message.guid, 'LayerZero GUID')
        if (seen.has(guid)) throw new Error(`In-flight manifest contains duplicate GUID ${guid}`)
        seen.add(guid)
        unsignedInteger(message.sourceNonce, `source nonce for ${guid}`, true)
        const sourceHeight = unsignedInteger(message.sourceHeight, `source height for ${guid}`)
        const amount = unsignedInteger(message.amountRaw, `raw amount for ${guid}`, true)
        nonempty(message.sourceTransaction, `source transaction for ${guid}`)
        nonempty(message.sourceBlockHash, `source block hash for ${guid}`)
        nonempty(message.sourceOft, `source OFT for ${guid}`)
        nonempty(message.destinationOft, `destination OFT for ${guid}`)
        nonempty(message.receiver, `receiver for ${guid}`)
        if (!Number.isSafeInteger(message.sourceEventIndex) || message.sourceEventIndex < 0) {
            throw new Error(`source event index for ${guid} is invalid`)
        }
        if (!['solana-to-robinhood', 'robinhood-to-solana'].includes(message.direction)) {
            throw new Error(`direction for ${guid} is invalid`)
        }
        if (!['in_flight', 'delivered', 'failed', 'blocked', 'unresolved'].includes(message.status)) {
            throw new Error(`status for ${guid} is invalid`)
        }
        const layerZeroApiStatus = nonempty(message.layerZeroApiStatus, `LayerZero API status for ${guid}`)
        const solanaToRobinhood = message.direction === 'solana-to-robinhood'
        const expectedSourceOft = solanaToRobinhood ? value.identities.solana.oftStore : value.identities.robinhood.oft
        const expectedDestinationOft = solanaToRobinhood
            ? value.identities.robinhood.oft
            : value.identities.solana.oftStore
        if (
            !equalIdentity(message.sourceOft, expectedSourceOft) ||
            !equalIdentity(message.destinationOft, expectedDestinationOft)
        ) {
            throw new Error(`source/destination OApp identity for ${guid} differs from the manifest pathway`)
        }
        const sourceFrom = unsignedInteger(
            solanaToRobinhood ? value.ranges.solana.fromSlot : value.ranges.robinhood.fromBlock,
            `source range start for ${guid}`
        )
        const sourceTo = unsignedInteger(
            solanaToRobinhood ? value.ranges.solana.toSlot : value.ranges.robinhood.toBlock,
            `source range end for ${guid}`
        )
        if (sourceHeight < sourceFrom || sourceHeight > sourceTo) {
            throw new Error(`source height for ${guid} is outside the approved scan range`)
        }
        if (solanaToRobinhood) nonempty(message.sourceBlockHash, `Solana source blockhash for ${guid}`)
        else hash32(message.sourceBlockHash, `Robinhood source block hash for ${guid}`)
        if (message.status === 'delivered') {
            if (!message.destinationTransaction || !message.destinationHeight || !message.destinationBlockHash) {
                throw new Error(`delivered GUID ${guid} lacks destination-chain evidence`)
            }
            const destinationHeight = unsignedInteger(message.destinationHeight, `destination height for ${guid}`)
            const destinationFrom = unsignedInteger(
                solanaToRobinhood ? value.ranges.robinhood.fromBlock : value.ranges.solana.fromSlot,
                `destination range start for ${guid}`
            )
            const destinationTo = unsignedInteger(
                solanaToRobinhood ? value.ranges.robinhood.toBlock : value.ranges.solana.toSlot,
                `destination range end for ${guid}`
            )
            if (destinationHeight < destinationFrom || destinationHeight > destinationTo) {
                throw new Error(`destination height for ${guid} is outside the approved scan range`)
            }
            if (solanaToRobinhood) hash32(message.destinationBlockHash, `Robinhood destination block hash for ${guid}`)
            else nonempty(message.destinationBlockHash, `Solana destination blockhash for ${guid}`)
            if (!['DELIVERED', 'CONFIRMING'].includes(layerZeroApiStatus.toUpperCase())) {
                throw new Error(`LayerZero API status for delivered GUID ${guid} is inconsistent`)
            }
        } else {
            if (
                message.destinationTransaction != null ||
                message.destinationHeight != null ||
                message.destinationBlockHash != null
            ) {
                throw new Error(`unresolved GUID ${guid} must not claim destination-chain evidence`)
            }
            if (layerZeroApiStatus.toUpperCase() === 'DELIVERED') {
                throw new Error(`LayerZero API reports delivery without destination-chain evidence for GUID ${guid}`)
            }
            unresolvedPacketCount += 1
            if (message.direction === 'solana-to-robinhood') solanaToRobinhoodRaw += amount
            else robinhoodToSolanaRaw += amount
        }
    }
    if (
        value.summary.resultCount !== seen.size ||
        value.summary.unresolvedPacketCount !== unresolvedPacketCount ||
        unsignedInteger(value.summary.solanaToRobinhoodRaw, 'summary Solana-to-Robinhood amount') !==
            solanaToRobinhoodRaw ||
        unsignedInteger(value.summary.robinhoodToSolanaRaw, 'summary Robinhood-to-Solana amount') !==
            robinhoodToSolanaRaw
    ) {
        throw new Error('In-flight manifest summary does not reconcile with packet evidence')
    }
    const { manifestChecksum: suppliedChecksum, ...unsigned } = value
    const expectedChecksum = manifestChecksum(unsigned)
    if (hash32(suppliedChecksum, 'Manifest checksum') !== expectedChecksum) {
        throw new Error('In-flight manifest checksum does not match its canonical contents')
    }
    return {
        manifest: value,
        inventoryId: value.inventoryId,
        inventorySha256: expectedChecksum,
        messageCount: seen.size,
        unresolvedPacketCount,
        solanaToRobinhoodRaw,
        robinhoodToSolanaRaw,
    }
}
