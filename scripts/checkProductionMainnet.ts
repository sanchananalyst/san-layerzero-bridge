import { createHash } from 'crypto'
import { readFileSync } from 'fs'

import { publicKey, unwrapOption } from '@metaplex-foundation/umi'
import { unpackAccount, unpackMint } from '@solana/spl-token'
import { Connection, PublicKey } from '@solana/web3.js'
import { ethers } from 'ethers'

import { EndpointPDADeriver, EndpointProgram } from '@layerzerolabs/lz-solana-sdk-v2'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import { OftPDA, oft } from '@layerzerolabs/oft-v2-solana-sdk'

import { collectLayerZeroObservation, solanaLayerZeroContextAccounts } from './checkLayerZeroConfig'
import { InFlightInventory, parseInFlightInventory } from './inFlightInventory'
import {
    ApprovedProductionState,
    PRODUCTION_ROBINHOOD_ENDPOINT,
    PRODUCTION_SOLANA_OFT_PROGRAM,
    ProductionExpectedState,
    ProductionMainnetObservation,
    SOLANA_UPGRADEABLE_LOADER,
    collectRepeatedProductionObservations,
    validateProductionMainnetObservation,
    validateRepeatedProductionObservations,
} from './productionMainnetPolicy'
import { PRODUCTION_RATE_LIMIT_PROFILES } from './productionRateLimitPolicy'
import { requireOftStoreAssetBindings } from './productionStoreBindings'
import { CANONICAL_SAN_MINT } from './sanMintConfig'
import { collectSolanaCommonContext, toUmiRpcAccount } from './solanaCommonContext'

const SOLANA_EID = 30168
const ROBINHOOD_EID = 30416
const SOLANA_ULN_PROGRAM = new PublicKey('7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH')
const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
const EIP1967_ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e0195d589d6dcae8ea4538b3a00b0b5d6103'

const requiredEnv = (name: string): string => {
    const value = process.env[name]?.trim()
    if (!value) throw new Error(`${name} is required; the production checker never guesses approved state`)
    return value
}

const requiredBigInt = (name: string): bigint => {
    const value = requiredEnv(name)
    if (!/^\d+$/.test(value)) throw new Error(`${name} must be an unsigned base-10 integer`)
    return BigInt(value)
}

const requiredList = (name: string): string[] => {
    const values = requiredEnv(name)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    if (values.length === 0) throw new Error(`${name} must contain at least one address`)
    return values
}

const optionalSolanaAuthority = (name: string): string | null => {
    const value = requiredEnv(name)
    return value === 'NONE' ? null : new PublicKey(value).toBase58()
}

const loadInFlightInventory = (): InFlightInventory =>
    parseInFlightInventory(readFileSync(requiredEnv('SAN_OBSERVED_IN_FLIGHT_INVENTORY_PATH'), 'utf8'))

const addressFromStorage = (value: string): string | null => {
    if (BigInt(value) === 0n) return null
    return ethers.utils.getAddress(`0x${value.slice(-40)}`)
}

const decodeReceiveOption = (value: Uint8Array | string): { gasOrCompute: bigint; value: bigint } => {
    const hex = typeof value === 'string' ? value : ethers.utils.hexlify(value)
    const option = Options.fromOptions(hex).decodeExecutorLzReceiveOption()
    if (!option) throw new Error('Required enforced lzReceive option is missing')
    return { gasOrCompute: option.gas, value: option.value }
}

const parseProgramData = (programData: Buffer): { upgradeAuthority: string; executableSha256: string } => {
    if (programData.length < 13 || programData.readUInt32LE(0) !== 3) {
        throw new Error('Solana ProgramData account has an unexpected loader state')
    }
    const hasAuthority = programData[12]
    if (hasAuthority !== 1 || programData.length < 45) {
        throw new Error('Solana ProgramData upgrade authority is absent or malformed')
    }
    return {
        upgradeAuthority: new PublicKey(programData.subarray(13, 45)).toBase58(),
        executableSha256: `0x${createHash('sha256').update(programData.subarray(45).toString('hex'), 'hex').digest('hex')}`,
    }
}

const requireAccountOwner = (info: { owner: PublicKey }, expected: PublicKey, label: string): void => {
    if (!info.owner.equals(expected)) throw new Error(`${label} has an unexpected program owner`)
}

const requireUpgradeableProgram = (info: { owner: PublicKey; executable: boolean }, label: string): void => {
    requireAccountOwner(info, new PublicKey(SOLANA_UPGRADEABLE_LOADER), label)
    if (!info.executable) throw new Error(`${label} is not executable`)
}

const approvedStateFromEnv = (): ApprovedProductionState => ({
    solanaOftStore: requiredEnv('SAN_SOLANA_OFT_STORE'),
    solanaEscrow: requiredEnv('SAN_SOLANA_ESCROW'),
    solanaUpgradeAuthority: requiredEnv('SAN_SOLANA_UPGRADE_AUTHORITY'),
    solanaStoreAdmin: requiredEnv('SAN_SOLANA_STORE_ADMIN'),
    solanaDelegate: requiredEnv('SAN_SOLANA_DELEGATE'),
    solanaPauser: requiredEnv('SAN_SOLANA_PAUSER'),
    solanaUnpauser: requiredEnv('SAN_SOLANA_UNPAUSER'),
    robinhoodOft: requiredEnv('SAN_ROBINHOOD_OFT_ADDRESS'),
    robinhoodOwner: requiredEnv('SAN_ROBINHOOD_OWNER'),
    robinhoodDelegate: requiredEnv('SAN_ROBINHOOD_DELEGATE'),
    robinhoodSourceConfirmations: requiredBigInt('SAN_ROBINHOOD_SOURCE_CONFIRMATIONS'),
    rateLimitProfile: PRODUCTION_RATE_LIMIT_PROFILES.canary,
    expectedRobinhoodSupplyRaw: requiredBigInt('SAN_EXPECTED_ROBINHOOD_SUPPLY_RAW'),
    expectedSolanaMintSupplyRaw: requiredBigInt('SAN_EXPECTED_SOLANA_MINT_SUPPLY_RAW'),
    expectedSolanaMintAuthority: optionalSolanaAuthority('SAN_EXPECTED_SOLANA_MINT_AUTHORITY'),
    expectedSolanaFreezeAuthority: optionalSolanaAuthority('SAN_EXPECTED_SOLANA_FREEZE_AUTHORITY'),
    forbiddenSolanaBootstrapAuthorities: requiredList('SAN_FORBIDDEN_SOLANA_BOOTSTRAP_AUTHORITIES'),
    forbiddenRobinhoodBootstrapAuthorities: requiredList('SAN_FORBIDDEN_ROBINHOOD_BOOTSTRAP_AUTHORITIES'),
    expectedSolanaProgramData: requiredEnv('SAN_SOLANA_PROGRAM_DATA'),
    expectedSolanaProgramDataSha256: requiredEnv('SAN_SOLANA_PROGRAM_DATA_SHA256'),
    expectedRobinhoodRuntimeCodeHash: requiredEnv('SAN_ROBINHOOD_RUNTIME_CODE_HASH'),
    expectedInFlight: {
        inventoryId: requiredEnv('SAN_APPROVED_IN_FLIGHT_INVENTORY_ID'),
        inventorySha256: requiredEnv('SAN_APPROVED_IN_FLIGHT_INVENTORY_SHA256'),
        scannerSourceCommit: requiredEnv('SAN_APPROVED_IN_FLIGHT_SCANNER_COMMIT'),
        solanaFromSlot: requiredBigInt('SAN_APPROVED_IN_FLIGHT_SOLANA_FROM_SLOT'),
        solanaToSlot: requiredBigInt('SAN_APPROVED_IN_FLIGHT_SOLANA_TO_SLOT'),
        robinhoodFromBlock: requiredBigInt('SAN_APPROVED_IN_FLIGHT_ROBINHOOD_FROM_BLOCK'),
        robinhoodToBlock: requiredBigInt('SAN_APPROVED_IN_FLIGHT_ROBINHOOD_TO_BLOCK'),
        solanaToRobinhoodRaw: requiredBigInt('SAN_APPROVED_IN_FLIGHT_SOLANA_TO_ROBINHOOD_RAW'),
        robinhoodToSolanaRaw: requiredBigInt('SAN_APPROVED_IN_FLIGHT_ROBINHOOD_TO_SOLANA_RAW'),
    },
})

export const collectProductionMainnetObservation = async (
    approved: ApprovedProductionState,
    solanaRpcUrl: string,
    robinhoodRpcUrl: string
): Promise<ProductionMainnetObservation> => {
    const connection = new Connection(solanaRpcUrl, 'finalized')
    const provider = new ethers.providers.JsonRpcProvider(robinhoodRpcUrl)
    const network = await provider.getNetwork()
    if (network.chainId !== 4663) throw new Error('Robinhood RPC chainId is not 4663')

    const storeAddress = new PublicKey(approved.solanaOftStore)
    const programAddress = new PublicKey(PRODUCTION_SOLANA_OFT_PROGRAM)
    const robinhoodFinalized = (await provider.send('eth_getBlockByNumber', ['finalized', false])) as {
        number?: string
        hash?: string
    } | null
    if (!robinhoodFinalized?.number || !robinhoodFinalized.hash) {
        throw new Error('Robinhood RPC does not expose an explicit finalized block and hash')
    }
    const robinhoodBlockTag = Number(BigInt(robinhoodFinalized.number))
    if (!Number.isSafeInteger(robinhoodBlockTag) || robinhoodBlockTag <= 0) {
        throw new Error('Robinhood finalized block is not a positive safe integer')
    }
    const evmCall = { blockTag: robinhoodBlockTag }
    const inventory = loadInFlightInventory()
    const [peerAddress] = new OftPDA(publicKey(PRODUCTION_SOLANA_OFT_PROGRAM)).peer(
        publicKey(approved.solanaOftStore),
        ROBINHOOD_EID
    )
    const peerKey = new PublicKey(peerAddress.toString())
    const programDataAddress = new PublicKey(approved.expectedSolanaProgramData)
    const escrowAddress = new PublicKey(approved.solanaEscrow)
    const mintAddress = new PublicKey(CANONICAL_SAN_MINT)
    const epDeriver = new EndpointPDADeriver(EndpointProgram.PROGRAM_ID)
    const [oappRegistryAddress] = epDeriver.oappRegistry(storeAddress)
    const layerZeroContextAccounts = solanaLayerZeroContextAccounts(approved.solanaOftStore)
    const solanaSnapshot = await collectSolanaCommonContext(connection, [
        { label: 'OFT Store', address: storeAddress },
        { label: 'canonical SAN mint', address: mintAddress },
        { label: 'SAN escrow token account', address: escrowAddress },
        { label: 'production OFT program', address: programAddress },
        { label: 'production OFT ProgramData', address: programDataAddress },
        { label: 'LayerZero Endpoint program', address: EndpointProgram.PROGRAM_ID },
        { label: 'LayerZero ULN302 program', address: SOLANA_ULN_PROGRAM },
        ...layerZeroContextAccounts,
    ])
    requireAccountOwner(solanaSnapshot.account(storeAddress), programAddress, 'OFT Store')
    for (const item of layerZeroContextAccounts) {
        const expectedOwner =
            item.label === 'OFT peer config'
                ? programAddress
                : item.label.startsWith('ULN ')
                  ? SOLANA_ULN_PROGRAM
                  : EndpointProgram.PROGRAM_ID
        requireAccountOwner(solanaSnapshot.account(item.address), expectedOwner, item.label)
    }
    requireUpgradeableProgram(solanaSnapshot.account(EndpointProgram.PROGRAM_ID), 'LayerZero Endpoint program')
    requireUpgradeableProgram(solanaSnapshot.account(SOLANA_ULN_PROGRAM), 'LayerZero ULN302 program')
    const store = oft.accounts.deserializeOFTStore(toUmiRpcAccount(storeAddress, solanaSnapshot.account(storeAddress)))
    requireOftStoreAssetBindings(
        storeAddress.toBase58(),
        store.tokenMint.toString(),
        store.tokenEscrow.toString(),
        escrowAddress.toBase58()
    )
    const peer = oft.accounts.deserializePeerConfig(toUmiRpcAccount(peerKey, solanaSnapshot.account(peerKey)))

    const programInfo = solanaSnapshot.account(programAddress)
    if (programInfo.data.length < 36 || programInfo.data.readUInt32LE(0) !== 2) {
        throw new Error('Solana OFT program account has an unexpected loader state')
    }
    const linkedProgramDataAddress = new PublicKey(programInfo.data.subarray(4, 36))
    if (!linkedProgramDataAddress.equals(programDataAddress)) {
        throw new Error('Solana program points to a different ProgramData account than the approved identity')
    }
    const programDataInfo = solanaSnapshot.account(programDataAddress)
    const parsedProgramData = parseProgramData(programDataInfo.data)

    const escrowInfo = solanaSnapshot.account(escrowAddress)
    const mintInfo = solanaSnapshot.account(mintAddress)
    const escrow = unpackAccount(escrowAddress, escrowInfo)
    const mint = unpackMint(mintAddress, mintInfo)
    const oappRegistry = EndpointProgram.accounts.OAppRegistry.fromAccountInfo(
        solanaSnapshot.account(oappRegistryAddress)
    )[0]

    const oftContract = new ethers.Contract(
        approved.robinhoodOft,
        [
            'function owner() view returns(address)',
            'function paused() view returns(bool)',
            'function endpoint() view returns(address)',
            'function decimals() view returns(uint8)',
            'function sharedDecimals() view returns(uint8)',
            'function totalSupply() view returns(uint256)',
            'function outboundRateLimit() view returns(uint256 capacity,uint256 available,uint256 refillAmount,uint64 refillDuration)',
            'function inboundRateLimit() view returns(uint256 capacity,uint256 available,uint256 refillAmount,uint64 refillDuration)',
            'function enforcedOptions(uint32,uint16) view returns(bytes)',
        ],
        provider
    )
    const endpointContract = new ethers.Contract(
        PRODUCTION_ROBINHOOD_ENDPOINT,
        ['function delegates(address) view returns(address)'],
        provider
    )
    const [
        robinhoodOwner,
        robinhoodPaused,
        robinhoodEndpoint,
        robinhoodDecimals,
        robinhoodSharedDecimals,
        robinhoodSupply,
        robinhoodOutbound,
        robinhoodInbound,
        solanaReceiveOptions,
        robinhoodDelegate,
        runtimeCode,
        implementationSlot,
        adminSlot,
        robinhoodBlock,
        layerZero,
    ] = await Promise.all([
        oftContract.owner(evmCall),
        oftContract.paused(evmCall),
        oftContract.endpoint(evmCall),
        oftContract.decimals(evmCall),
        oftContract.sharedDecimals(evmCall),
        oftContract.totalSupply(evmCall),
        oftContract.outboundRateLimit(evmCall),
        oftContract.inboundRateLimit(evmCall),
        oftContract.enforcedOptions(SOLANA_EID, 1, evmCall),
        endpointContract.delegates(approved.robinhoodOft, evmCall),
        provider.getCode(approved.robinhoodOft, robinhoodBlockTag),
        provider.getStorageAt(approved.robinhoodOft, EIP1967_IMPLEMENTATION_SLOT, robinhoodBlockTag),
        provider.getStorageAt(approved.robinhoodOft, EIP1967_ADMIN_SLOT, robinhoodBlockTag),
        Promise.resolve(robinhoodBlockTag),
        collectLayerZeroObservation(
            solanaRpcUrl,
            robinhoodRpcUrl,
            approved.solanaOftStore,
            approved.robinhoodOft,
            {
                solanaMinContextSlot: Number(solanaSnapshot.evidence.contextSlot),
                robinhoodBlockTag,
            },
            solanaSnapshot
        ),
    ])
    if (runtimeCode === '0x') throw new Error('Robinhood SanOFT runtime bytecode is empty')

    const solanaOutbound = unwrapOption(peer.outboundRateLimiter)
    const solanaInbound = unwrapOption(peer.inboundRateLimiter)
    if (!solanaOutbound || !solanaInbound) throw new Error('Solana peer is missing a required directional limiter')

    return {
        solana: {
            eid: SOLANA_EID,
            mint: mintAddress.toBase58(),
            tokenProgram: mintInfo.owner.toBase58(),
            decimals: mint.decimals,
            sharedDecimals: mint.decimals - Math.log10(Number(store.ld2sdRate)),
            oftType: Number(store.oftType),
            mintSupplyRaw: mint.supply,
            mintAuthority: mint.mintAuthority?.toBase58() ?? null,
            freezeAuthority: mint.freezeAuthority?.toBase58() ?? null,
            programId: programAddress.toBase58(),
            endpoint: store.endpointProgram.toString(),
            oftStore: approved.solanaOftStore,
            escrow: escrowAddress.toBase58(),
            tvlRaw: BigInt(store.tvlLd),
            escrowBalanceRaw: escrow.amount,
            upgradeAuthority: parsedProgramData.upgradeAuthority,
            storeAdmin: store.admin.toString(),
            delegate: oappRegistry.delegate.toBase58(),
            paused: store.paused,
            pauser: unwrapOption(store.pauser, () => null)?.toString() ?? null,
            unpauser: unwrapOption(store.unpauser, () => null)?.toString() ?? null,
            programExecutable: programInfo.executable,
            programOwner: programInfo.owner.toBase58(),
            programData: programDataAddress.toBase58(),
            programDataSha256: parsedProgramData.executableSha256,
            programDataOwner: programDataInfo.owner.toBase58(),
            programDataExecutable: programDataInfo.executable,
            escrowProgramOwner: escrowInfo.owner.toBase58(),
            escrowMint: escrow.mint.toBase58(),
            escrowAuthority: escrow.owner.toBase58(),
        },
        robinhood: {
            chainId: network.chainId,
            eid: ROBINHOOD_EID,
            endpoint: robinhoodEndpoint,
            oft: ethers.utils.getAddress(approved.robinhoodOft),
            decimals: Number(robinhoodDecimals),
            sharedDecimals: Number(robinhoodSharedDecimals),
            totalSupplyRaw: BigInt(robinhoodSupply.toString()),
            owner: robinhoodOwner,
            delegate: robinhoodDelegate,
            paused: robinhoodPaused,
            runtimeCodeHash: ethers.utils.keccak256(runtimeCode),
            proxyImplementation: addressFromStorage(implementationSlot),
            proxyAdmin: addressFromStorage(adminSlot),
            blockHash: robinhoodFinalized.hash.toLowerCase(),
        },
        layerZero,
        enforcedOptions: {
            solanaReceive: decodeReceiveOption(solanaReceiveOptions),
            robinhoodReceive: decodeReceiveOption(peer.enforcedOptions.send),
        },
        rateLimits: {
            solana: {
                outbound: {
                    capacity: BigInt(solanaOutbound.capacity),
                    available: BigInt(solanaOutbound.tokens),
                    refill: BigInt(solanaOutbound.refillPerSecond),
                },
                inbound: {
                    capacity: BigInt(solanaInbound.capacity),
                    available: BigInt(solanaInbound.tokens),
                    refill: BigInt(solanaInbound.refillPerSecond),
                },
            },
            robinhood: {
                outbound: {
                    capacity: BigInt(robinhoodOutbound.capacity.toString()),
                    available: BigInt(robinhoodOutbound.available.toString()),
                    refill: BigInt(robinhoodOutbound.refillAmount.toString()),
                    durationSeconds: BigInt(robinhoodOutbound.refillDuration.toString()),
                },
                inbound: {
                    capacity: BigInt(robinhoodInbound.capacity.toString()),
                    available: BigInt(robinhoodInbound.available.toString()),
                    refill: BigInt(robinhoodInbound.refillAmount.toString()),
                    durationSeconds: BigInt(robinhoodInbound.refillDuration.toString()),
                },
            },
        },
        solanaContext: solanaSnapshot.evidence,
        inFlight: {
            manifest: inventory.manifest,
            inventoryId: inventory.inventoryId,
            inventorySha256: inventory.inventorySha256,
            messageCount: inventory.messageCount,
            solanaSlot: solanaSnapshot.evidence.contextSlot,
            robinhoodBlock: BigInt(robinhoodBlock),
            solanaToRobinhoodRaw: inventory.solanaToRobinhoodRaw,
            robinhoodToSolanaRaw: inventory.robinhoodToSolanaRaw,
        },
    }
}

export const checkProductionMainnet = async (): Promise<void> => {
    const expectedState = requiredEnv('SAN_EXPECTED_ACTIVATION_STATE') as ProductionExpectedState
    if (!Object.values(ProductionExpectedState).includes(expectedState)) {
        throw new Error('SAN_EXPECTED_ACTIVATION_STATE must be PRE_ACTIVATION_INERT or CANARY_ACTIVE')
    }
    const approved = approvedStateFromEnv()
    const solanaRpcUrl = process.env.SOLANA_MAINNET_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
    const robinhoodRpcUrl = process.env.ROBINHOOD_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'
    const [observation, confirmation] = await collectRepeatedProductionObservations(() =>
        collectProductionMainnetObservation(approved, solanaRpcUrl, robinhoodRpcUrl)
    )
    validateProductionMainnetObservation(observation, approved, expectedState)
    validateProductionMainnetObservation(confirmation, approved, expectedState)
    validateRepeatedProductionObservations(observation, confirmation)
    console.log(
        JSON.stringify(
            {
                solanaObservationModel: observation.solanaContext.model,
                contextSlot: observation.solanaContext.contextSlot,
                finalizedSlot: observation.solanaContext.finalizedSlotAfter,
                blockhash: observation.solanaContext.blockhash,
                boundAccounts: observation.solanaContext.accounts.map(({ label, address }) => ({ label, address })),
                remainingCrossCallGaps: observation.solanaContext.remainingCrossCallGaps,
                manifestToSolanaContextSlotGap:
                    observation.solanaContext.contextSlot - BigInt(observation.inFlight.manifest.ranges.solana.toSlot),
                manifestToRobinhoodFinalizedBlockGap:
                    observation.inFlight.robinhoodBlock -
                    BigInt(observation.inFlight.manifest.ranges.robinhood.toBlock),
            },
            (_, value) => (typeof value === 'bigint' ? value.toString() : value),
            2
        )
    )
    console.log(`SAN production state matches ${expectedState}; no transaction was constructed or submitted.`)
}

if (require.main === module) {
    checkProductionMainnet().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
    })
}
