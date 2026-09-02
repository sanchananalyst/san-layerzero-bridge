import { PublicKey } from '@solana/web3.js'

import { CANONICAL_SAN_MINT, PRODUCTION_SOLANA_OFT_PROGRAM_ID } from './sanMintConfig'

const OFT_STORE_SEED = Buffer.from('OFT')

export const requireOftStoreAssetBindings = (
    oftStoreAddress: string,
    storeTokenMint: string,
    storeTokenEscrow: string,
    approvedEscrow: string
): void => {
    const storeAddress = new PublicKey(oftStoreAddress)
    const tokenMint = new PublicKey(storeTokenMint)
    const tokenEscrow = new PublicKey(storeTokenEscrow)
    const approvedEscrowAddress = new PublicKey(approvedEscrow)
    if (!tokenMint.equals(new PublicKey(CANONICAL_SAN_MINT))) {
        throw new Error('Solana OFT Store token mint is not canonical SAN')
    }
    if (!tokenEscrow.equals(approvedEscrowAddress)) {
        throw new Error('Solana OFT Store token escrow differs from the approved escrow')
    }
    const [derivedStore] = PublicKey.findProgramAddressSync(
        [OFT_STORE_SEED, approvedEscrowAddress.toBuffer()],
        new PublicKey(PRODUCTION_SOLANA_OFT_PROGRAM_ID)
    )
    if (!storeAddress.equals(derivedStore)) {
        throw new Error('Solana OFT Store is not the production PDA derived from the approved escrow')
    }
}
