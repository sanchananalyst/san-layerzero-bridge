import { createHash } from 'crypto'
import { readFileSync } from 'fs'

import { publicKey, unwrapOption } from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { getAccount, getMint } from '@solana/spl-token'
import { Connection, PublicKey } from '@solana/web3.js'
import { ethers } from 'ethers'

import { EndpointPDADeriver, EndpointProgram } from '@layerzerolabs/lz-solana-sdk-v2'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import { OftPDA, oft } from '@layerzerolabs/oft-v2-solana-sdk'

import { collectLayerZeroObservation } from './checkLayerZeroConfig'
import { InFlightInventory, parseInFlightInventory } from './inFlightInventory'
import {
    ApprovedProductionState,
    PRODUCTION_ROBINHOOD_ENDPOINT,
    PRODUCTION_SOLANA_OFT_PROGRAM,
    ProductionExpectedState,
    ProductionMainnetObservation,
    collectRepeatedProductionObservations,
    validateProductionMainnetObservation,
    validateRepeatedProductionObservations,
} from './productionMainnetPolicy'
import { PRODUCTION_RATE_LIMIT_PROFILES } from './productionRateLimitPolicy'

const SOLANA_EID = 30168
const ROBINHOOD_EID = 30416
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
    const solanaStartSlot = await connection.getSlot('finalized')
    const robinhoodBlockTag = await provider.getBlockNumber()
    const solanaAccountConfig = { commitment: 'finalized' as const, minContextSlot: solanaStartSlot }
    const evmCall = { blockTag: robinhoodBlockTag }
    const inventory = loadInFlightInventory()
    const umi = createUmi(solanaRpcUrl)
    const store = await oft.accounts.fetchOFTStore(umi, publicKey(approved.solanaOftStore), { commitment: 'finalized' })
    const [peerAddress] = new OftPDA(publicKey(PRODUCTION_SOLANA_OFT_PROGRAM)).peer(
        publicKey(approved.solanaOftStore),
        ROBINHOOD_EID
    )
    const peer = await oft.accounts.fetchPeerConfig(umi, peerAddress, { commitment: 'finalized' })

    const programInfo = await connection.getAccountInfo(programAddress, solanaAccountConfig)
    if (!programInfo) throw new Error('Solana OFT program account is missing')
    if (programInfo.data.length < 36 || programInfo.data.readUInt32LE(0) !== 2) {
        throw new Error('Solana OFT program account has an unexpected loader state')
    }
    const programDataAddress = new PublicKey(programInfo.data.subarray(4, 36))
    const programDataInfo = await connection.getAccountInfo(programDataAddress, solanaAccountConfig)
    if (!programDataInfo) throw new Error('Solana ProgramData account is missing')
    const parsedProgramData = parseProgramData(programDataInfo.data)

    const escrowAddress = new PublicKey(store.tokenEscrow.toString())
    const mintAddress = new PublicKey(store.tokenMint.toString())
    const [escrow, escrowInfo, mint, mintInfo] = await Promise.all([
        getAccount(connection, escrowAddress, 'finalized'),
        connection.getAccountInfo(escrowAddress, solanaAccountConfig),
        getMint(connection, mintAddress, 'finalized'),
        connection.getAccountInfo(mintAddress, solanaAccountConfig),
    ])
    if (!escrowInfo) throw new Error('Solana escrow token account is missing')
    if (!mintInfo) throw new Error('Canonical SAN mint account is missing')

    const epDeriver = new EndpointPDADeriver(EndpointProgram.PROGRAM_ID)
    const [oappRegistryAddress] = epDeriver.oappRegistry(storeAddress)
    const oappRegistry = await EndpointProgram.accounts.OAppRegistry.fromAccountAddress(
        connection,
        oappRegistryAddress,
        'finalized'
    )

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
        solanaSlot,
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
        Promise.resolve(solanaStartSlot),
        Promise.resolve(robinhoodBlockTag),
        collectLayerZeroObservation(solanaRpcUrl, robinhoodRpcUrl, approved.solanaOftStore, approved.robinhoodOft, {
            solanaMinContextSlot: solanaStartSlot,
            robinhoodBlockTag,
        }),
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
        inFlight: {
            inventoryId: inventory.inventoryId,
            inventorySha256: inventory.inventorySha256,
            messageCount: inventory.messageCount,
            solanaSlot: BigInt(solanaSlot),
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
    console.log(`SAN production state matches ${expectedState}; no transaction was constructed or submitted.`)
}

if (require.main === module) {
    checkProductionMainnet().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
    })
}
