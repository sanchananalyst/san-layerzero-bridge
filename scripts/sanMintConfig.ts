import bs58 from 'bs58'

export const CANONICAL_SAN_MINT = 'GQz5ThKHNcuAvMKA8rCPSdoFUoApk9Fi8qB9m3Gqpump'
export const LEGACY_SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
export const PRODUCTION_SOLANA_OFT_PROGRAM_ID = '9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD'
export const SOLANA_MAINNET_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'

export type SupportedTokenProgramKind = 'SPL Token' | 'Token-2022'

export type SanAdapterConfig = {
    eid: number
    mint: string
    configuredMint: string | undefined
    tokenProgram: string
    programId: string
}

export type SanMintAccountObservation = {
    decimals: number
    mintAuthority: string | null
    freezeAuthority: string | null
}

function isSolanaPublicKey(value: string): boolean {
    try {
        return bs58.decode(value).length === 32
    } catch {
        return false
    }
}

export function requireCanonicalSanMint(value: string | undefined): string {
    if (!value?.trim()) throw new Error('SAN_SOLANA_MINT is required')

    const mint = value.trim()
    if (!isSolanaPublicKey(mint)) throw new Error('SAN_SOLANA_MINT is not a valid Solana public key')
    if (mint !== CANONICAL_SAN_MINT) throw new Error(`Refusing non-canonical SAN mint: ${mint}`)
    return mint
}

export function requireSupportedTokenProgram(owner: string): SupportedTokenProgramKind {
    if (owner === LEGACY_SPL_TOKEN_PROGRAM) return 'SPL Token'
    if (owner === TOKEN_2022_PROGRAM) return 'Token-2022'
    throw new Error(`Unsupported SAN mint owner: ${owner}`)
}

export function requireSolanaMainnet(genesisHash: string): void {
    if (genesisHash !== SOLANA_MAINNET_GENESIS_HASH) {
        throw new Error(`RPC is not Solana mainnet: unexpected genesis hash ${genesisHash}`)
    }
}

export function validateSanAdapterConfig(config: SanAdapterConfig): SupportedTokenProgramKind {
    if (config.eid !== 30168) throw new Error(`SAN adapter creation is restricted to Solana mainnet EID 30168`)

    const configuredMint = requireCanonicalSanMint(config.configuredMint)
    const commandMint = requireCanonicalSanMint(config.mint)
    if (configuredMint !== commandMint) throw new Error('Adapter mint does not match SAN_SOLANA_MINT')
    if (config.programId !== PRODUCTION_SOLANA_OFT_PROGRAM_ID) {
        throw new Error(`SAN adapter creation requires production OFT program ${PRODUCTION_SOLANA_OFT_PROGRAM_ID}`)
    }
    if (config.tokenProgram !== LEGACY_SPL_TOKEN_PROGRAM) {
        throw new Error('Canonical SAN must use the legacy SPL Token program')
    }

    return requireSupportedTokenProgram(config.tokenProgram)
}

export function validateCanonicalSanMintAccount(observation: SanMintAccountObservation): void {
    if (observation.decimals !== 6) throw new Error('Canonical SAN mint decimals are not 6')
    if (observation.mintAuthority !== null) throw new Error('Canonical SAN mint authority is not revoked')
    if (observation.freezeAuthority !== null) throw new Error('Canonical SAN freeze authority is not revoked')
}

export function formatRawTokenAmount(rawAmount: bigint, decimals: number): string {
    if (!Number.isInteger(decimals) || decimals < 0) throw new Error(`Invalid mint decimals: ${decimals}`)
    if (decimals === 0) return rawAmount.toString()

    const digits = rawAmount.toString().padStart(decimals + 1, '0')
    const whole = digits.slice(0, -decimals)
    const fraction = digits.slice(-decimals).replace(/0+$/, '')
    return fraction ? `${whole}.${fraction}` : whole
}
