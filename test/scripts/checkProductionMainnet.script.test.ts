import { InFlightManifest, InFlightMessageEvidence, parseInFlightInventory } from '../../scripts/inFlightInventory'
import {
    BuildManifestInput,
    ScannerProviderResult,
    buildInFlightManifest,
    requireFinalizedRangeEnd,
} from '../../scripts/scanProductionInFlight'

const hash = (fill: string) => `0x${fill.repeat(64)}`
const source = (
    guidFill = '1',
    direction: InFlightMessageEvidence['direction'] = 'solana-to-robinhood'
): InFlightMessageEvidence => ({
    guid: hash(guidFill),
    direction,
    sourceNonce: '1',
    sourceTransaction: direction === 'solana-to-robinhood' ? `sig-${guidFill}` : hash(guidFill),
    sourceHeight: direction === 'solana-to-robinhood' ? '101' : '201',
    sourceBlockHash: direction === 'solana-to-robinhood' ? `solblock-${guidFill}` : hash('a'),
    sourceEventIndex: 0,
    sourceOft: direction === 'solana-to-robinhood' ? 'Store111' : '0x1111111111111111111111111111111111111111',
    destinationOft: direction === 'solana-to-robinhood' ? '0x1111111111111111111111111111111111111111' : 'Store111',
    amountRaw: direction === 'solana-to-robinhood' ? '7' : '9',
    receiver: hash('b'),
    status: 'unresolved',
    destinationTransaction: null,
    destinationHeight: null,
    destinationBlockHash: null,
    layerZeroApiStatus: null,
})

const destination = (message: InFlightMessageEvidence): InFlightMessageEvidence => ({
    ...message,
    sourceNonce: '0',
    sourceTransaction: '',
    sourceHeight: '0',
    sourceBlockHash: '',
    status: 'delivered',
    destinationTransaction: message.direction === 'solana-to-robinhood' ? hash('c') : 'dest-sig',
    destinationHeight: message.direction === 'solana-to-robinhood' ? '202' : '102',
    destinationBlockHash: message.direction === 'solana-to-robinhood' ? hash('d') : 'sol-dest-block',
})

const providerResult = (
    sources: InFlightMessageEvidence[] = [],
    destinations: InFlightMessageEvidence[] = []
): ScannerProviderResult => ({
    ranges: {
        solana: {
            fromSlot: '100',
            toSlot: '110',
            finalizedSlot: '110',
            genesisHash: 'genesis',
            startBlockhash: 'start',
            endBlockhash: 'end',
            complete: true,
            paginationComplete: true,
        },
        robinhood: {
            fromBlock: '200',
            toBlock: '210',
            finalizedBlock: '210',
            startBlockHash: hash('e'),
            endBlockHash: hash('f'),
            complete: true,
            paginationComplete: true,
        },
    },
    sourceMessages: sources,
    destinationMessages: destinations,
})

const buildInput = (
    primary = providerResult(),
    secondary: ScannerProviderResult = structuredClone(primary)
): BuildManifestInput => ({
    inventoryId: 'review-1',
    scannerSourceCommit: '1'.repeat(40),
    generatedAt: '2026-09-03T00:00:00.000Z',
    solanaProviderIds: ['solana-a', 'solana-b'],
    robinhoodProviderIds: ['robinhood-a', 'robinhood-b'],
    layerZeroStatuses: new Map(
        primary.sourceMessages.map((message) => [
            message.guid,
            primary.destinationMessages.some((destinationMessage) => destinationMessage.guid === message.guid)
                ? 'DELIVERED'
                : 'INFLIGHT',
        ])
    ),
    primary,
    secondary,
    identities: {
        solana: {
            chain: 'solana-mainnet',
            eid: 30168,
            endpoint: 'EndpointSol',
            oftProgram: 'ProgramSol',
            oftStore: 'Store111',
        },
        robinhood: {
            chainId: 4663,
            eid: 30416,
            endpoint: '0x2222222222222222222222222222222222222222',
            oft: '0x1111111111111111111111111111111111111111',
        },
    },
})

const parse = (manifest: InFlightManifest) => parseInFlightInventory(`${JSON.stringify(manifest)}\n`)

describe('production in-flight scanner manifest', () => {
    it('allows an approved end below a provider finalized head but rejects a future end', () => {
        expect(() => requireFinalizedRangeEnd(100, 101, 'Solana')).not.toThrow()
        expect(() => requireFinalizedRangeEnd(102, 101, 'Solana')).toThrow('newer than')
    })
    it('accepts a dual-provider complete no-message scan', () => {
        const parsed = parse(buildInFlightManifest(buildInput()))
        expect(parsed.messageCount).toBe(0)
        expect(parsed.unresolvedPacketCount).toBe(0)
        expect(parsed.solanaToRobinhoodRaw).toBe(0n)
    })

    it('counts one pending message as directional in-flight value', () => {
        const pending = source()
        const result = providerResult([pending])
        const parsed = parse(buildInFlightManifest(buildInput(result, structuredClone(result))))
        expect(parsed.unresolvedPacketCount).toBe(1)
        expect(parsed.solanaToRobinhoodRaw).toBe(7n)
    })

    it('removes a delivered message from outstanding accounting', () => {
        const sent = source()
        const result = providerResult([sent], [destination(sent)])
        const parsed = parse(buildInFlightManifest(buildInput(result, structuredClone(result))))
        expect(parsed.manifest.messages[0].status).toBe('delivered')
        expect(parsed.solanaToRobinhoodRaw).toBe(0n)
    })

    it('reconciles simultaneous forward and return packets directionally', () => {
        const forward = source('1')
        const returned = source('2', 'robinhood-to-solana')
        const result = providerResult([forward, returned])
        const parsed = parse(buildInFlightManifest(buildInput(result, structuredClone(result))))
        expect(parsed.solanaToRobinhoodRaw).toBe(7n)
        expect(parsed.robinhoodToSolanaRaw).toBe(9n)
    })

    it('rejects duplicate/replay source and destination appearances', () => {
        const sent = source()
        const duplicateSource = providerResult([sent, sent])
        expect(() =>
            parse(buildInFlightManifest(buildInput(duplicateSource, structuredClone(duplicateSource))))
        ).toThrow('duplicate GUID')
        const duplicateDestination = providerResult([sent], [destination(sent), destination(sent)])
        expect(() =>
            buildInFlightManifest(buildInput(duplicateDestination, structuredClone(duplicateDestination)))
        ).toThrow('Duplicate/replay destination')
    })

    it('classifies missing destination evidence as unresolved and rejects an API delivery claim', () => {
        const sent = source()
        const result = providerResult([sent])
        const input = buildInput(result, structuredClone(result))
        expect(parse(buildInFlightManifest(input)).unresolvedPacketCount).toBe(1)
        input.layerZeroStatuses = new Map([[sent.guid, 'DELIVERED']])
        expect(() => buildInFlightManifest(input)).toThrow('without destination-chain evidence')
    })

    it('rejects RPC range truncation and incomplete pagination', () => {
        const manifest = buildInFlightManifest(buildInput())
        manifest.ranges.solana.complete = false
        expect(() => parse(manifest)).toThrow('range or pagination is incomplete')
        const second = buildInFlightManifest(buildInput())
        second.ranges.robinhood.paginationComplete = false
        expect(() => parse(second)).toThrow('range or pagination is incomplete')
    })

    it('accepts evidence spanning multiple complete pagination pages', () => {
        const manifest = buildInFlightManifest(buildInput())
        expect(manifest.ranges.solana.paginationComplete).toBe(true)
        expect(() => parse(manifest)).not.toThrow()
    })

    it('rejects LayerZero API and on-chain delivery disagreement', () => {
        const sent = source()
        const result = providerResult([sent], [destination(sent)])
        const input = buildInput(result, structuredClone(result))
        input.layerZeroStatuses = new Map([[sent.guid, 'FAILED']])
        expect(() => buildInFlightManifest(input)).toThrow('API disagrees')
    })

    it('rejects independent source-chain evidence disagreement', () => {
        const primary = providerResult([source()])
        const secondary = providerResult([])
        expect(() => buildInFlightManifest(buildInput(primary, secondary))).toThrow('Independent RPC')
    })

    it('rejects wrong identity, missing provenance, incomplete range, and checksum mutation', () => {
        const wrongChain = buildInFlightManifest(buildInput())
        ;(wrongChain.identities.robinhood.chainId as number) = 1
        expect(() => parse(wrongChain)).toThrow('wrong production chain')
        const missingProvenance = buildInFlightManifest(buildInput())
        missingProvenance.provenance.sourceEvidenceAgreement = false
        expect(() => parse(missingProvenance)).toThrow('missing or unreconciled')
        const incomplete = buildInFlightManifest(buildInput())
        incomplete.ranges.solana.finalizedSlot = '109'
        expect(() => parse(incomplete)).toThrow('not finalized through its end')
        const mutated = buildInFlightManifest(buildInput())
        mutated.inventoryId = 'mutated'
        expect(() => parse(mutated)).toThrow('checksum does not match')
    })

    it('rejects absent LayerZero API corroboration', () => {
        const input = buildInput()
        input.layerZeroStatuses = undefined
        const manifest = buildInFlightManifest(input)
        expect(() => parse(manifest)).toThrow('missing or unreconciled')
    })

    it('rejects per-message OApp identities and heights outside the bound pathway range', () => {
        const sent = source()
        const result = providerResult([sent])
        const wrongOapp = buildInFlightManifest(buildInput(result, structuredClone(result)))
        wrongOapp.messages[0].sourceOft = 'WrongStore'
        expect(() => parse(wrongOapp)).toThrow('differs from the manifest pathway')

        const outsideRange = buildInFlightManifest(buildInput(result, structuredClone(result)))
        outsideRange.messages[0].sourceHeight = '99'
        expect(() => parse(outsideRange)).toThrow('outside the approved scan range')
    })

    it('rejects unresolved destination claims and API statuses inconsistent with delivery evidence', () => {
        const sent = source()
        const result = providerResult([sent])
        const unresolved = buildInFlightManifest(buildInput(result, structuredClone(result)))
        unresolved.messages[0].destinationTransaction = hash('c')
        expect(() => parse(unresolved)).toThrow('must not claim destination-chain evidence')

        const deliveredResult = providerResult([sent], [destination(sent)])
        const delivered = buildInFlightManifest(buildInput(deliveredResult, structuredClone(deliveredResult)))
        delivered.messages[0].layerZeroApiStatus = 'FAILED'
        expect(() => parse(delivered)).toThrow('status for delivered GUID')
    })
})
