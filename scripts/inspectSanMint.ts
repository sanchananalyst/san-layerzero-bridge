import 'dotenv/config'

import {
    AccountState,
    ExtensionType,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    getDefaultAccountState,
    getExtensionData,
    getExtensionTypes,
    getGroupMemberPointerState,
    getGroupPointerState,
    getInterestBearingMintConfigState,
    getMetadataPointerState,
    getMintCloseAuthority,
    getNonTransferable,
    getPausableConfig,
    getPermanentDelegate,
    getPermissionedBurn,
    getScaledUiAmountConfig,
    getTokenMetadata,
    getTransferFeeConfig,
    getTransferHook,
    unpackMint,
} from '@solana/spl-token'
import { AccountInfo, Connection, PublicKey, clusterApiUrl } from '@solana/web3.js'

import {
    formatRawTokenAmount,
    requireCanonicalSanMint,
    requireSolanaMainnet,
    requireSupportedTokenProgram,
} from './sanMintConfig'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function jsonValue(value: unknown): JsonValue {
    if (value === null || value === undefined) return null
    if (typeof value === 'bigint') return value.toString()
    if (value instanceof PublicKey) return value.toBase58()
    if (Buffer.isBuffer(value)) return value.toString('hex')
    if (value instanceof Uint8Array) {
        return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')
    }
    if (Array.isArray(value)) return value.map(jsonValue)
    if (typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]))
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
    return String(value)
}

function decodeExtension(type: ExtensionType, mint: ReturnType<typeof unpackMint>): JsonValue {
    switch (type) {
        case ExtensionType.TransferFeeConfig:
            return jsonValue(getTransferFeeConfig(mint))
        case ExtensionType.TransferHook:
            return jsonValue(getTransferHook(mint))
        case ExtensionType.PermanentDelegate:
            return jsonValue(getPermanentDelegate(mint))
        case ExtensionType.DefaultAccountState: {
            const state = getDefaultAccountState(mint)
            return state ? { state: AccountState[state.state] ?? state.state } : null
        }
        case ExtensionType.NonTransferable:
            return { enabled: getNonTransferable(mint) !== null }
        case ExtensionType.MintCloseAuthority:
            return jsonValue(getMintCloseAuthority(mint))
        case ExtensionType.InterestBearingConfig:
            return jsonValue(getInterestBearingMintConfigState(mint))
        case ExtensionType.MetadataPointer:
            return jsonValue(getMetadataPointerState(mint))
        case ExtensionType.GroupPointer:
            return jsonValue(getGroupPointerState(mint))
        case ExtensionType.GroupMemberPointer:
            return jsonValue(getGroupMemberPointerState(mint))
        case ExtensionType.ScaledUiAmountConfig:
            return jsonValue(getScaledUiAmountConfig(mint))
        case ExtensionType.PausableConfig:
            return jsonValue(getPausableConfig(mint))
        case ExtensionType.PermissionedBurn:
            return jsonValue(getPermissionedBurn(mint))
        case ExtensionType.ConfidentialTransferMint:
            return { enabled: true, decoderAvailable: false }
        default:
            return { enabled: true }
    }
}

function compatibilityNote(type: ExtensionType): string {
    switch (type) {
        case ExtensionType.TransferFeeConfig:
            return 'Transfer fees change the escrowed and credited amounts; the installed adapter has explicit fee-aware amount calculations, but exact behavior requires dedicated tests.'
        case ExtensionType.TransferHook:
            return 'Potentially incompatible: hook transfers may require extra accounts not supplied by the fixed adapter account list.'
        case ExtensionType.PermanentDelegate:
            return 'Security-sensitive: a permanent delegate may be able to move or burn escrowed SAN independently of the OFT Store.'
        case ExtensionType.DefaultAccountState:
            return 'If new token accounts default to Frozen, the newly created escrow cannot receive SAN until an authorized thaw occurs.'
        case ExtensionType.ConfidentialTransferMint:
            return 'Confidential transfer behavior is outside the standard transparent lock/unlock path and requires separate compatibility review.'
        case ExtensionType.NonTransferable:
            return 'Incompatible with lock/unlock bridging because SAN cannot be transferred into or out of escrow.'
        case ExtensionType.PausableConfig:
            return 'Transfers can be paused by the configured authority, which can halt bridge lock/unlock operations.'
        case ExtensionType.ScaledUiAmountConfig:
        case ExtensionType.InterestBearingConfig:
            return 'UI-denominated balances can diverge from raw units; OFT accounting uses raw token units.'
        case ExtensionType.PermissionedBurn:
            return 'Security-sensitive if an external authority can burn escrowed SAN.'
        default:
            return 'No automatic incompatibility identified; review the decoded extension semantics before creating the adapter.'
    }
}

async function inspectToken2022Extensions(
    connection: Connection,
    mintAddress: PublicKey,
    mint: ReturnType<typeof unpackMint>
): Promise<JsonValue[]> {
    const extensionTypes = getExtensionTypes(mint.tlvData)
    const extensions = extensionTypes.map((type) => {
        const raw = getExtensionData(type, mint.tlvData)
        return {
            type,
            name: ExtensionType[type] ?? `Unknown(${type})`,
            dataLength: raw?.length ?? 0,
            rawDataHex: raw?.toString('hex') ?? '',
            decoded: decodeExtension(type, mint),
            oftCompatibility: compatibilityNote(type),
        }
    })

    if (extensionTypes.includes(ExtensionType.TokenMetadata)) {
        const metadata = await getTokenMetadata(connection, mintAddress, 'finalized', TOKEN_2022_PROGRAM_ID)
        const tokenMetadata = extensions.find((item) => item.type === ExtensionType.TokenMetadata)
        if (tokenMetadata) tokenMetadata.decoded = jsonValue(metadata)
    }

    return extensions
}

export async function inspectSanMint(): Promise<JsonValue> {
    const mintAddress = new PublicKey(requireCanonicalSanMint(process.env.SAN_SOLANA_MINT))
    const rpcUrl = process.env.RPC_URL_SOLANA?.trim() || clusterApiUrl('mainnet-beta')
    const connection = new Connection(rpcUrl, 'finalized')

    const genesisHash = await connection.getGenesisHash()
    requireSolanaMainnet(genesisHash)

    const accountResponse = await connection.getAccountInfoAndContext(mintAddress, 'finalized')
    const accountInfo: AccountInfo<Buffer> | null = accountResponse.value
    if (!accountInfo) throw new Error(`Canonical SAN mint account not found: ${mintAddress.toBase58()}`)

    const tokenProgramKind = requireSupportedTokenProgram(accountInfo.owner.toBase58())
    const tokenProgramId = tokenProgramKind === 'SPL Token' ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID
    const mint = unpackMint(mintAddress, accountInfo, tokenProgramId)
    if (!mint.isInitialized) throw new Error('Canonical SAN mint account is not initialized')

    const extensions =
        tokenProgramKind === 'Token-2022' ? await inspectToken2022Extensions(connection, mintAddress, mint) : []

    return {
        network: 'Solana mainnet',
        genesisHash,
        observedSlot: accountResponse.context.slot,
        rpcEndpoint: connection.rpcEndpoint,
        mintAddress: mintAddress.toBase58(),
        owningTokenProgram: tokenProgramId.toBase58(),
        tokenProgramKind,
        mintAccountDataLength: accountInfo.data.length,
        decimals: mint.decimals,
        rawTotalSupply: mint.supply.toString(),
        humanReadableTotalSupply: formatRawTokenAmount(mint.supply, mint.decimals),
        mintAuthority: mint.mintAuthority?.toBase58() ?? null,
        freezeAuthority: mint.freezeAuthority?.toBase58() ?? null,
        mintAuthorityRevoked: mint.mintAuthority === null,
        freezeAuthorityRevoked: mint.freezeAuthority === null,
        token2022Extensions: extensions,
    }
}

async function main(): Promise<void> {
    const report = await inspectSanMint()
    console.log(JSON.stringify(report, null, 2))
}

if (require.main === module) {
    main().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error)
        process.exitCode = 1
    })
}
