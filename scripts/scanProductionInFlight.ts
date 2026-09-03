import { Connection, ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { ethers } from 'ethers'

import { PacketV1Codec } from '@layerzerolabs/lz-v2-utilities'

import {
    BRIDGE_CODE_AUDIT_TARGET,
    IN_FLIGHT_SCANNER_NAME,
    IN_FLIGHT_SCANNER_VERSION,
    InFlightManifest,
    InFlightMessageEvidence,
    PacketStatus,
    canonicalJson,
    manifestChecksum,
    parseInFlightInventory,
} from './inFlightInventory'
import {
    PRODUCTION_ROBINHOOD_ENDPOINT,
    PRODUCTION_SOLANA_ENDPOINT,
    PRODUCTION_SOLANA_OFT_PROGRAM,
} from './productionMainnetPolicy'
import { requireSolanaMainnet } from './sanMintConfig'

const SOLANA_EID = 30168
const ROBINHOOD_EID = 30416
const EVENT_CPI_DISCRIMINATOR = 'e445a52e51cb9a1d'
const OFT_SENT_DISCRIMINATOR = '6cabdb02bd156e6e'
const OFT_RECEIVED_DISCRIMINATOR = '908170439098c92a'
const OFT_ABI = [
    'event OFTSent(bytes32 indexed guid,uint32 dstEid,address indexed fromAddress,uint256 amountSentLD,uint256 amountReceivedLD)',
    'event OFTReceived(bytes32 indexed guid,uint32 srcEid,address indexed toAddress,uint256 amountReceivedLD)',
]
const ENDPOINT_ABI = ['event PacketSent(bytes encodedPayload,bytes options,address sendLibrary)']

export const requireFinalizedRangeEnd = (rangeEnd: number, finalizedHead: number, label: string): void => {
    if (
        !Number.isSafeInteger(rangeEnd) ||
        rangeEnd <= 0 ||
        !Number.isSafeInteger(finalizedHead) ||
        finalizedHead <= 0
    ) {
        throw new Error(`${label} range end and finalized head must be positive safe integers`)
    }
    if (rangeEnd > finalizedHead) throw new Error(`${label} scan end is newer than the provider finalized head`)
}

export interface ScanRangeEvidence {
    solana: InFlightManifest['ranges']['solana']
    robinhood: InFlightManifest['ranges']['robinhood']
}

export interface ScannerProviderResult {
    ranges: ScanRangeEvidence
    sourceMessages: InFlightMessageEvidence[]
    destinationMessages: InFlightMessageEvidence[]
}

export interface BuildManifestInput {
    inventoryId: string
    scannerSourceCommit: string
    generatedAt: string
    solanaProviderIds: string[]
    robinhoodProviderIds: string[]
    primary: ScannerProviderResult
    secondary: ScannerProviderResult
    identities: InFlightManifest['identities']
    layerZeroStatuses?: Map<string, string>
}

const sortMessages = (messages: InFlightMessageEvidence[]): InFlightMessageEvidence[] =>
    [...messages].sort((left, right) =>
        `${left.direction}:${left.sourceHeight.padStart(24, '0')}:${left.sourceTransaction}:${left.sourceEventIndex}:${left.guid}`.localeCompare(
            `${right.direction}:${right.sourceHeight.padStart(24, '0')}:${right.sourceTransaction}:${right.sourceEventIndex}:${right.guid}`
        )
    )

const providerComparable = (value: ScannerProviderResult): string =>
    canonicalJson({
        ranges: value.ranges,
        sourceMessages: sortMessages(value.sourceMessages),
        destinationMessages: sortMessages(value.destinationMessages),
    })

const unresolvedStatus = (apiStatus: string | undefined): PacketStatus => {
    const normalized = apiStatus?.toUpperCase()
    if (normalized === 'FAILED') return 'failed'
    if (normalized === 'BLOCKED' || normalized === 'PAYLOAD_STORED') return 'blocked'
    if (normalized === 'INFLIGHT' || normalized === 'CONFIRMING') return 'in_flight'
    return 'unresolved'
}

export const buildInFlightManifest = (input: BuildManifestInput): InFlightManifest => {
    if (providerComparable(input.primary) !== providerComparable(input.secondary)) {
        throw new Error('Independent RPC source/destination evidence disagrees')
    }
    const destinations = new Map<string, InFlightMessageEvidence>()
    for (const destination of input.primary.destinationMessages) {
        const guid = destination.guid.toLowerCase()
        if (destinations.has(guid)) throw new Error(`Duplicate/replay destination evidence for GUID ${guid}`)
        destinations.set(guid, destination)
    }
    const messages = sortMessages(
        input.primary.sourceMessages.map((source): InFlightMessageEvidence => {
            const guid = source.guid.toLowerCase()
            const destination = destinations.get(guid)
            const apiStatus = input.layerZeroStatuses?.get(guid) ?? null
            if (destination) {
                destinations.delete(guid)
                if (
                    destination.direction !== source.direction ||
                    destination.amountRaw !== source.amountRaw ||
                    destination.receiver.toLowerCase() !== source.receiver.toLowerCase()
                ) {
                    throw new Error(`Source-chain and destination-chain evidence disagrees for GUID ${guid}`)
                }
                if (apiStatus && !['DELIVERED', 'CONFIRMING'].includes(apiStatus.toUpperCase())) {
                    throw new Error(`LayerZero API disagrees with delivered chain evidence for GUID ${guid}`)
                }
                return {
                    ...source,
                    status: 'delivered',
                    destinationTransaction: destination.destinationTransaction,
                    destinationHeight: destination.destinationHeight,
                    destinationBlockHash: destination.destinationBlockHash,
                    layerZeroApiStatus: apiStatus,
                }
            }
            if (apiStatus?.toUpperCase() === 'DELIVERED') {
                throw new Error(`LayerZero API reports delivery without destination-chain evidence for GUID ${guid}`)
            }
            return { ...source, status: unresolvedStatus(apiStatus ?? undefined), layerZeroApiStatus: apiStatus }
        })
    )
    if (destinations.size !== 0)
        throw new Error('Destination evidence contains a receive without source-chain evidence')

    let solanaToRobinhoodRaw = 0n
    let robinhoodToSolanaRaw = 0n
    let unresolvedPacketCount = 0
    for (const message of messages) {
        if (message.status === 'delivered') continue
        unresolvedPacketCount += 1
        if (message.direction === 'solana-to-robinhood') solanaToRobinhoodRaw += BigInt(message.amountRaw)
        else robinhoodToSolanaRaw += BigInt(message.amountRaw)
    }
    const unsigned: Omit<InFlightManifest, 'manifestChecksum'> = {
        schemaVersion: 2,
        inventoryId: input.inventoryId,
        scanner: {
            name: IN_FLIGHT_SCANNER_NAME,
            version: IN_FLIGHT_SCANNER_VERSION,
            bridgeCodeAuditTarget: BRIDGE_CODE_AUDIT_TARGET,
            scannerSourceCommit: input.scannerSourceCommit,
        },
        generatedAt: input.generatedAt,
        identities: input.identities,
        ranges: input.primary.ranges,
        provenance: {
            model: 'DUAL_RPC_RECONCILED',
            solanaProviders: input.solanaProviderIds,
            robinhoodProviders: input.robinhoodProviderIds,
            sourceEvidenceAgreement: true,
            destinationEvidenceAgreement: true,
            layerZeroApiCorroborated: input.layerZeroStatuses != null,
            layerZeroApiDisagreements: [],
        },
        messages,
        summary: {
            resultCount: messages.length,
            unresolvedPacketCount,
            solanaToRobinhoodRaw: solanaToRobinhoodRaw.toString(),
            robinhoodToSolanaRaw: robinhoodToSolanaRaw.toString(),
        },
    }
    return { ...unsigned, manifestChecksum: manifestChecksum(unsigned) }
}

interface SolanaOftEvent {
    name: 'OFTSent' | 'OFTReceived'
    guid: string
    eid: number
    address: string
    amountRaw: string
    index: number
}

const u64le = (data: Buffer, offset: number): string => data.readBigUInt64LE(offset).toString()

export const extractSolanaOftEvents = (tx: ParsedTransactionWithMeta): SolanaOftEvent[] => {
    if (tx.meta?.err != null) return []
    const events: SolanaOftEvent[] = []
    let index = 0
    for (const group of tx.meta?.innerInstructions ?? []) {
        for (const rawInstruction of group.instructions) {
            const instruction = rawInstruction as { programId?: PublicKey; data?: string }
            if (!instruction.programId?.equals(new PublicKey(PRODUCTION_SOLANA_OFT_PROGRAM)) || !instruction.data)
                continue
            const data = Buffer.from(bs58.decode(instruction.data))
            if (data.length < 16 || data.subarray(0, 8).toString('hex') !== EVENT_CPI_DISCRIMINATOR) continue
            const discriminator = data.subarray(8, 16).toString('hex')
            const body = data.subarray(16)
            if (discriminator === OFT_SENT_DISCRIMINATOR && body.length >= 84) {
                events.push({
                    name: 'OFTSent',
                    guid: `0x${body.subarray(0, 32).toString('hex')}`,
                    eid: body.readUInt32LE(32),
                    address: new PublicKey(body.subarray(36, 68)).toBase58(),
                    amountRaw: u64le(body, 76),
                    index,
                })
            } else if (discriminator === OFT_RECEIVED_DISCRIMINATOR && body.length >= 76) {
                events.push({
                    name: 'OFTReceived',
                    guid: `0x${body.subarray(0, 32).toString('hex')}`,
                    eid: body.readUInt32LE(32),
                    address: new PublicKey(body.subarray(36, 68)).toBase58(),
                    amountRaw: u64le(body, 68),
                    index,
                })
            }
            index += 1
        }
    }
    return events
}

const blockAt = async (connection: Connection, slot: number): Promise<{ blockhash: string }> => {
    const block = await connection.getBlock(slot, {
        commitment: 'finalized',
        transactionDetails: 'none',
        rewards: false,
        maxSupportedTransactionVersion: 0,
    })
    if (!block) throw new Error(`Solana finalized block ${slot} is unavailable`)
    return block
}

const readOftReceiver = (messageHex: string): string => {
    const bytes = Buffer.from(messageHex.replace(/^0x/, ''), 'hex')
    if (bytes.length < 40) throw new Error('LayerZero OFT packet message is shorter than 40 bytes')
    return `0x${bytes.subarray(0, 32).toString('hex')}`
}

export const scanSolana = async (
    rpcUrl: string,
    fromSlot: number,
    toSlot: number,
    solanaStore: string,
    robinhoodOft: string
): Promise<{
    range: ScanRangeEvidence['solana']
    sent: InFlightMessageEvidence[]
    received: InFlightMessageEvidence[]
}> => {
    const { extractSentPacketEventByTxHash } = await import('@layerzerolabs/lz-solana-sdk-v2')
    const connection = new Connection(rpcUrl, 'finalized')
    const finalizedSlot = await connection.getSlot('finalized')
    requireFinalizedRangeEnd(toSlot, finalizedSlot, 'Solana')
    if ((await connection.getFirstAvailableBlock()) > fromSlot)
        throw new Error('Solana RPC history is pruned before the approved scan start')
    const [startBlock, endBlock, genesisHash] = await Promise.all([
        blockAt(connection, fromSlot),
        blockAt(connection, toSlot),
        connection.getGenesisHash(),
    ])
    requireSolanaMainnet(genesisHash)
    const program = new PublicKey(PRODUCTION_SOLANA_OFT_PROGRAM)
    const signatures: Array<{ signature: string; slot: number }> = []
    let before: string | undefined
    let paginationComplete = false
    for (;;) {
        const page = await connection.getSignaturesForAddress(program, { before, limit: 1_000 }, 'finalized')
        if (page.length === 0) {
            paginationComplete = true
            break
        }
        for (const item of page) {
            if (item.slot < fromSlot) {
                paginationComplete = true
                break
            }
            if (item.slot <= toSlot && item.err == null) signatures.push(item)
        }
        if (paginationComplete) break
        before = page[page.length - 1].signature
    }
    if (!paginationComplete) throw new Error('Solana signature pagination did not reach the approved range start')

    const sent: InFlightMessageEvidence[] = []
    const received: InFlightMessageEvidence[] = []
    for (const item of signatures) {
        const tx = await connection.getParsedTransaction(item.signature, {
            commitment: 'finalized',
            maxSupportedTransactionVersion: 0,
        })
        if (!tx) throw new Error(`Solana transaction evidence is unavailable: ${item.signature}`)
        const block = await blockAt(connection, item.slot)
        const events = extractSolanaOftEvents(tx)
        const packets = (await extractSentPacketEventByTxHash(connection, EndpointProgramId, tx, 'finalized')) ?? []
        for (const event of events) {
            if (event.name === 'OFTSent' && event.eid === ROBINHOOD_EID) {
                const packet = packets
                    .map(({ encodedPacket }) => PacketV1Codec.fromBytes(encodedPacket))
                    .find((value) => value.guid().toLowerCase() === event.guid.toLowerCase())
                if (
                    !packet ||
                    packet.srcEid() !== SOLANA_EID ||
                    packet.dstEid() !== ROBINHOOD_EID ||
                    packet.sender().toLowerCase() !==
                        ethers.utils.hexlify(new PublicKey(solanaStore).toBytes()).toLowerCase() ||
                    packet.receiverAddressB20().toLowerCase() !== robinhoodOft.toLowerCase()
                ) {
                    throw new Error(`Solana OFTSent lacks matching Endpoint packet evidence: ${event.guid}`)
                }
                sent.push({
                    guid: event.guid.toLowerCase(),
                    direction: 'solana-to-robinhood',
                    sourceNonce: packet.nonce(),
                    sourceTransaction: item.signature,
                    sourceHeight: item.slot.toString(),
                    sourceBlockHash: block.blockhash,
                    sourceEventIndex: event.index,
                    sourceOft: solanaStore,
                    destinationOft: ethers.utils.getAddress(robinhoodOft),
                    amountRaw: event.amountRaw,
                    receiver: readOftReceiver(packet.message()),
                    status: 'unresolved',
                    destinationTransaction: null,
                    destinationHeight: null,
                    destinationBlockHash: null,
                    layerZeroApiStatus: null,
                })
            } else if (event.name === 'OFTReceived' && event.eid === ROBINHOOD_EID) {
                received.push({
                    guid: event.guid.toLowerCase(),
                    direction: 'robinhood-to-solana',
                    sourceNonce: '0',
                    sourceTransaction: '',
                    sourceHeight: '0',
                    sourceBlockHash: '',
                    sourceEventIndex: event.index,
                    sourceOft: ethers.utils.getAddress(robinhoodOft),
                    destinationOft: solanaStore,
                    amountRaw: event.amountRaw,
                    receiver: `0x${Buffer.from(new PublicKey(event.address).toBytes()).toString('hex')}`,
                    status: 'delivered',
                    destinationTransaction: item.signature,
                    destinationHeight: item.slot.toString(),
                    destinationBlockHash: block.blockhash,
                    layerZeroApiStatus: null,
                })
            }
        }
    }
    return {
        range: {
            fromSlot: fromSlot.toString(),
            toSlot: toSlot.toString(),
            finalizedSlot: toSlot.toString(),
            genesisHash,
            startBlockhash: startBlock.blockhash,
            endBlockhash: endBlock.blockhash,
            complete: true,
            paginationComplete,
        },
        sent: sortMessages(sent),
        received: sortMessages(received),
    }
}

const EndpointProgramId = new PublicKey(PRODUCTION_SOLANA_ENDPOINT)

export const scanRobinhood = async (
    rpcUrl: string,
    fromBlock: number,
    toBlock: number,
    robinhoodOft: string,
    solanaStore: string,
    pageSize = 2_000
): Promise<{
    range: ScanRangeEvidence['robinhood']
    sent: InFlightMessageEvidence[]
    received: InFlightMessageEvidence[]
}> => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    if ((await provider.getNetwork()).chainId !== 4663) throw new Error('Robinhood scanner RPC chainId is not 4663')
    const finalized = (await provider.send('eth_getBlockByNumber', ['finalized', false])) as {
        number?: string
        hash?: string
    } | null
    if (!finalized?.number || !finalized.hash) throw new Error('Robinhood RPC does not expose a finalized block')
    const finalizedBlockNumber = Number(BigInt(finalized.number))
    requireFinalizedRangeEnd(toBlock, finalizedBlockNumber, 'Robinhood')
    const [startBlock, endBlock] = await Promise.all([provider.getBlock(fromBlock), provider.getBlock(toBlock)])
    if (
        !startBlock?.hash ||
        !endBlock?.hash ||
        (toBlock === finalizedBlockNumber && endBlock.hash.toLowerCase() !== finalized.hash.toLowerCase())
    ) {
        throw new Error('Robinhood finalized range block hashes are unavailable or inconsistent')
    }
    const oftInterface = new ethers.utils.Interface(OFT_ABI)
    const endpointInterface = new ethers.utils.Interface(ENDPOINT_ABI)
    const sent: InFlightMessageEvidence[] = []
    const received: InFlightMessageEvidence[] = []
    for (let start = fromBlock; start <= toBlock; start += pageSize) {
        const end = Math.min(start + pageSize - 1, toBlock)
        const logs = await provider.getLogs({ address: robinhoodOft, fromBlock: start, toBlock: end })
        for (const log of logs) {
            let parsed: ethers.utils.LogDescription
            try {
                parsed = oftInterface.parseLog(log)
            } catch {
                continue
            }
            if (parsed.name === 'OFTSent' && Number(parsed.args.dstEid) === SOLANA_EID) {
                const receipt = await provider.getTransactionReceipt(log.transactionHash)
                if (!receipt || receipt.status !== 1)
                    throw new Error(`Robinhood source receipt is unavailable: ${log.transactionHash}`)
                const packetLogs = receipt.logs
                    .filter((entry) => entry.address.toLowerCase() === PRODUCTION_ROBINHOOD_ENDPOINT.toLowerCase())
                    .map((entry) => {
                        try {
                            return endpointInterface.parseLog(entry)
                        } catch {
                            return null
                        }
                    })
                    .filter(
                        (entry): entry is ethers.utils.LogDescription => entry != null && entry.name === 'PacketSent'
                    )
                const packet = packetLogs
                    .map((entry) => PacketV1Codec.from(entry.args.encodedPayload))
                    .find((value) => value.guid().toLowerCase() === parsed.args.guid.toLowerCase())
                if (
                    !packet ||
                    packet.srcEid() !== ROBINHOOD_EID ||
                    packet.dstEid() !== SOLANA_EID ||
                    packet.senderAddressB20().toLowerCase() !== robinhoodOft.toLowerCase() ||
                    packet.receiver().toLowerCase() !==
                        ethers.utils.hexlify(new PublicKey(solanaStore).toBytes()).toLowerCase()
                )
                    throw new Error(`Robinhood OFTSent lacks matching Endpoint packet evidence: ${parsed.args.guid}`)
                sent.push({
                    guid: parsed.args.guid.toLowerCase(),
                    direction: 'robinhood-to-solana',
                    sourceNonce: packet.nonce(),
                    sourceTransaction: log.transactionHash.toLowerCase(),
                    sourceHeight: log.blockNumber.toString(),
                    sourceBlockHash: log.blockHash.toLowerCase(),
                    sourceEventIndex: log.logIndex,
                    sourceOft: ethers.utils.getAddress(robinhoodOft),
                    destinationOft: solanaStore,
                    amountRaw: parsed.args.amountReceivedLD.toString(),
                    receiver: readOftReceiver(packet.message()),
                    status: 'unresolved',
                    destinationTransaction: null,
                    destinationHeight: null,
                    destinationBlockHash: null,
                    layerZeroApiStatus: null,
                })
            } else if (parsed.name === 'OFTReceived' && Number(parsed.args.srcEid) === SOLANA_EID) {
                received.push({
                    guid: parsed.args.guid.toLowerCase(),
                    direction: 'solana-to-robinhood',
                    sourceNonce: '0',
                    sourceTransaction: '',
                    sourceHeight: '0',
                    sourceBlockHash: '',
                    sourceEventIndex: log.logIndex,
                    sourceOft: solanaStore,
                    destinationOft: ethers.utils.getAddress(robinhoodOft),
                    amountRaw: parsed.args.amountReceivedLD.toString(),
                    receiver: ethers.utils.hexZeroPad(parsed.args.toAddress, 32).toLowerCase(),
                    status: 'delivered',
                    destinationTransaction: log.transactionHash.toLowerCase(),
                    destinationHeight: log.blockNumber.toString(),
                    destinationBlockHash: log.blockHash.toLowerCase(),
                    layerZeroApiStatus: null,
                })
            }
        }
    }
    return {
        range: {
            fromBlock: fromBlock.toString(),
            toBlock: toBlock.toString(),
            finalizedBlock: toBlock.toString(),
            startBlockHash: startBlock.hash.toLowerCase(),
            endBlockHash: endBlock.hash.toLowerCase(),
            complete: true,
            paginationComplete: true,
        },
        sent: sortMessages(sent),
        received: sortMessages(received),
    }
}

const required = (name: string): string => {
    const value = process.env[name]?.trim()
    if (!value) throw new Error(`${name} is required; the scanner never infers production identities or ranges`)
    return value
}

const safeProviderId = (url: string): string => {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}`
}

const scanProviderPair = async (
    solanaRpc: string,
    robinhoodRpc: string,
    values: {
        solanaFrom: number
        solanaTo: number
        robinhoodFrom: number
        robinhoodTo: number
        store: string
        oft: string
    }
): Promise<ScannerProviderResult> => {
    const [solana, robinhood] = await Promise.all([
        scanSolana(solanaRpc, values.solanaFrom, values.solanaTo, values.store, values.oft),
        scanRobinhood(robinhoodRpc, values.robinhoodFrom, values.robinhoodTo, values.oft, values.store),
    ])
    return {
        ranges: { solana: solana.range, robinhood: robinhood.range },
        sourceMessages: [...solana.sent, ...robinhood.sent],
        destinationMessages: [...solana.received, ...robinhood.received],
    }
}

const fetchLayerZeroStatuses = async (messages: InFlightMessageEvidence[]): Promise<Map<string, string>> => {
    const statuses = new Map<string, string>()
    const byTransaction = new Map<string, InFlightMessageEvidence[]>()
    for (const message of messages) {
        const group = byTransaction.get(message.sourceTransaction) ?? []
        group.push(message)
        byTransaction.set(message.sourceTransaction, group)
    }
    for (const [transaction, expected] of byTransaction) {
        const response = await fetch(
            `https://scan.layerzero-api.com/v1/messages/tx/${encodeURIComponent(transaction)}`,
            {
                headers: { accept: 'application/json' },
            }
        )
        if (!response.ok)
            throw new Error(`LayerZero Scan corroboration failed for ${transaction}: HTTP ${response.status}`)
        const body = (await response.json()) as {
            data?: Array<{ guid?: string; pathway?: { srcEid?: number; dstEid?: number }; status?: { name?: string } }>
        }
        for (const message of expected) {
            const entry = body.data?.find((candidate) => candidate.guid?.toLowerCase() === message.guid.toLowerCase())
            if (!entry?.status?.name) throw new Error(`LayerZero Scan omitted source GUID ${message.guid}`)
            const expectedEids =
                message.direction === 'solana-to-robinhood' ? [SOLANA_EID, ROBINHOOD_EID] : [ROBINHOOD_EID, SOLANA_EID]
            if (entry.pathway?.srcEid !== expectedEids[0] || entry.pathway?.dstEid !== expectedEids[1]) {
                throw new Error(`LayerZero Scan pathway disagrees for GUID ${message.guid}`)
            }
            statuses.set(message.guid.toLowerCase(), entry.status.name)
        }
    }
    return statuses
}

export const scanProductionInFlight = async (): Promise<InFlightManifest> => {
    const solanaPrimary = required('SOLANA_MAINNET_RPC_URL')
    const solanaSecondary = required('SOLANA_MAINNET_SECONDARY_RPC_URL')
    const robinhoodPrimary = required('ROBINHOOD_RPC_URL')
    const robinhoodSecondary = required('ROBINHOOD_SECONDARY_RPC_URL')
    const values = {
        solanaFrom: Number(required('SAN_SCAN_SOLANA_FROM_SLOT')),
        solanaTo: Number(required('SAN_SCAN_SOLANA_TO_SLOT')),
        robinhoodFrom: Number(required('SAN_SCAN_ROBINHOOD_FROM_BLOCK')),
        robinhoodTo: Number(required('SAN_SCAN_ROBINHOOD_TO_BLOCK')),
        store: new PublicKey(required('SAN_SOLANA_OFT_STORE')).toBase58(),
        oft: ethers.utils.getAddress(required('SAN_ROBINHOOD_OFT_ADDRESS')),
    }
    if (![values.solanaFrom, values.solanaTo, values.robinhoodFrom, values.robinhoodTo].every(Number.isSafeInteger))
        throw new Error('Scanner ranges must be safe integers')
    const [primary, secondary] = await Promise.all([
        scanProviderPair(solanaPrimary, robinhoodPrimary, values),
        scanProviderPair(solanaSecondary, robinhoodSecondary, values),
    ])
    const layerZeroStatuses = await fetchLayerZeroStatuses(primary.sourceMessages)
    const manifest = buildInFlightManifest({
        inventoryId: required('SAN_APPROVED_IN_FLIGHT_INVENTORY_ID'),
        scannerSourceCommit: required('SAN_SCANNER_SOURCE_COMMIT'),
        generatedAt: new Date().toISOString(),
        solanaProviderIds: [safeProviderId(solanaPrimary), safeProviderId(solanaSecondary)],
        robinhoodProviderIds: [safeProviderId(robinhoodPrimary), safeProviderId(robinhoodSecondary)],
        primary,
        secondary,
        layerZeroStatuses,
        identities: {
            solana: {
                chain: 'solana-mainnet',
                eid: 30168,
                endpoint: PRODUCTION_SOLANA_ENDPOINT,
                oftProgram: PRODUCTION_SOLANA_OFT_PROGRAM,
                oftStore: values.store,
            },
            robinhood: { chainId: 4663, eid: 30416, endpoint: PRODUCTION_ROBINHOOD_ENDPOINT, oft: values.oft },
        },
    })
    parseInFlightInventory(`${JSON.stringify(manifest)}\n`)
    return manifest
}

if (require.main === module) {
    scanProductionInFlight()
        .then((manifest) => console.log(JSON.stringify(manifest, null, 2)))
        .catch((error: unknown) => {
            console.error(error instanceof Error ? error.message : String(error))
            process.exitCode = 1
        })
}
