import { createHash } from 'crypto'

import { RpcAccount, lamports, publicKey } from '@metaplex-foundation/umi'
import { AccountInfo, Connection, PublicKey } from '@solana/web3.js'

export const SOLANA_OBSERVATION_MODEL = 'COMMON_CONTEXT_STRONG' as const

export interface SolanaContextAccountRequest {
    label: string
    address: PublicKey
}

export interface SolanaContextAccountEvidence {
    label: string
    address: string
    owner: string
    executable: boolean
    lamports: string
    dataLength: number
    accountSha256: string
}

export interface SolanaCommonContextEvidence {
    model: typeof SOLANA_OBSERVATION_MODEL
    commitment: 'finalized'
    contextSlot: bigint
    finalizedSlotBefore: bigint
    finalizedSlotAfter: bigint
    blockhash: string
    parentSlot: bigint
    accounts: SolanaContextAccountEvidence[]
    remainingCrossCallGaps: string[]
}

export interface SolanaCommonContextSnapshot {
    evidence: SolanaCommonContextEvidence
    account(address: PublicKey): AccountInfo<Buffer>
}

export const toUmiRpcAccount = (address: PublicKey, info: AccountInfo<Buffer>): RpcAccount => ({
    publicKey: publicKey(address.toBase58()),
    owner: publicKey(info.owner.toBase58()),
    executable: info.executable,
    lamports: lamports(info.lamports),
    rentEpoch: BigInt(info.rentEpoch ?? 0),
    data: new Uint8Array(info.data),
})

export interface CommonContextEnvelope {
    requestedAccounts: number
    returnedAccounts: number
    finalizedSlotBefore: number
    contextSlot: number
    finalizedSlotAfter: number
    blockSlot: number
    blockhash: string | null
}

export const validateCommonContextEnvelope = (value: CommonContextEnvelope): void => {
    for (const [label, slot] of [
        ['finalized slot before', value.finalizedSlotBefore],
        ['account context slot', value.contextSlot],
        ['finalized slot after', value.finalizedSlotAfter],
        ['block slot', value.blockSlot],
    ] as const) {
        if (!Number.isSafeInteger(slot) || slot <= 0) throw new Error(`${label} must be a positive safe integer`)
    }
    if (value.requestedAccounts <= 0 || value.returnedAccounts !== value.requestedAccounts) {
        throw new Error('Solana common-context batch is truncated')
    }
    if (value.contextSlot < value.finalizedSlotBefore) {
        throw new Error('Solana common-context response is older than the required finalized slot')
    }
    if (value.contextSlot > value.finalizedSlotAfter) {
        throw new Error('Solana common-context response is newer than the observed finalized head')
    }
    if (value.blockSlot !== value.contextSlot || !value.blockhash || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(value.blockhash)) {
        throw new Error('Solana common-context block identifier does not match the account context slot')
    }
}

const accountHash = (info: AccountInfo<Buffer>): string => {
    const header = Buffer.from(
        JSON.stringify({
            owner: info.owner.toBase58(),
            executable: info.executable,
            lamports: info.lamports.toString(),
            rentEpoch: (info.rentEpoch ?? 0).toString(),
            dataLength: info.data.length,
        }),
        'utf8'
    )
    return `0x${createHash('sha256').update(header.toString('utf8'), 'utf8').update(info.data.toString('hex'), 'hex').digest('hex')}`
}

/**
 * Fetches every custody-critical Solana account in one finalized
 * getMultipleAccountsInfoAndContext call. The returned account bytes, their
 * context slot, and that slot's finalized blockhash form the evidence root.
 */
export const collectSolanaCommonContext = async (
    connection: Connection,
    requested: SolanaContextAccountRequest[]
): Promise<SolanaCommonContextSnapshot> => {
    const byAddress = new Map<string, SolanaContextAccountRequest>()
    for (const item of requested) {
        const address = item.address.toBase58()
        if (byAddress.has(address)) throw new Error(`Duplicate Solana common-context account ${address}`)
        byAddress.set(address, item)
    }
    const accounts = [...byAddress.values()]
    if (accounts.length === 0) throw new Error('Solana common-context account set is empty')

    const finalizedSlotBefore = await connection.getSlot('finalized')
    const response = await connection.getMultipleAccountsInfoAndContext(
        accounts.map(({ address }) => address),
        { commitment: 'finalized', minContextSlot: finalizedSlotBefore }
    )
    const finalizedSlotAfter = await connection.getSlot('finalized')
    const block = await connection.getBlock(response.context.slot, {
        commitment: 'finalized',
        transactionDetails: 'none',
        rewards: false,
        maxSupportedTransactionVersion: 0,
    })
    validateCommonContextEnvelope({
        requestedAccounts: accounts.length,
        returnedAccounts: response.value.length,
        finalizedSlotBefore,
        contextSlot: response.context.slot,
        finalizedSlotAfter,
        blockSlot: response.context.slot,
        blockhash: block?.blockhash ?? null,
    })
    if (!block) throw new Error('Solana common-context finalized block is unavailable')

    const values = new Map<string, AccountInfo<Buffer>>()
    const evidenceAccounts = accounts.map((item, index): SolanaContextAccountEvidence => {
        const info = response.value[index]
        if (!info) throw new Error(`Solana common-context account is missing: ${item.label} ${item.address.toBase58()}`)
        const address = item.address.toBase58()
        values.set(address, info)
        return {
            label: item.label,
            address,
            owner: info.owner.toBase58(),
            executable: info.executable,
            lamports: info.lamports.toString(),
            dataLength: info.data.length,
            accountSha256: accountHash(info),
        }
    })

    const evidence: SolanaCommonContextEvidence = {
        model: SOLANA_OBSERVATION_MODEL,
        commitment: 'finalized',
        contextSlot: BigInt(response.context.slot),
        finalizedSlotBefore: BigInt(finalizedSlotBefore),
        finalizedSlotAfter: BigInt(finalizedSlotAfter),
        blockhash: block.blockhash,
        parentSlot: BigInt(block.parentSlot),
        accounts: evidenceAccounts,
        remainingCrossCallGaps: [
            'Robinhood state is pinned independently to one finalized EVM block.',
            'LayerZero metadata is an HTTPS observation outside the Solana bank snapshot.',
            'In-flight evidence spans separately approved finalized chain ranges.',
        ],
    }
    return {
        evidence,
        account(address: PublicKey): AccountInfo<Buffer> {
            const info = values.get(address.toBase58())
            if (!info) throw new Error(`Account was not bound to the Solana common context: ${address.toBase58()}`)
            return info
        },
    }
}
