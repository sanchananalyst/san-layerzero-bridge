import { PublicKey } from '@solana/web3.js'

import { requireOftStoreAssetBindings } from '../../scripts/productionStoreBindings'
import { CANONICAL_SAN_MINT, PRODUCTION_SOLANA_OFT_PROGRAM_ID } from '../../scripts/sanMintConfig'

const solanaAddress = (fill: number): string => new PublicKey(Uint8Array.from({ length: 32 }, () => fill)).toBase58()

describe('production OFT Store asset bindings', () => {
    const approvedEscrow = solanaAddress(1)
    const [derivedStore] = PublicKey.findProgramAddressSync(
        [Buffer.from('OFT'), new PublicKey(approvedEscrow).toBuffer()],
        new PublicKey(PRODUCTION_SOLANA_OFT_PROGRAM_ID)
    )

    it('accepts the canonical mint, approved escrow, and its production Store PDA', () => {
        expect(() =>
            requireOftStoreAssetBindings(derivedStore.toBase58(), CANONICAL_SAN_MINT, approvedEscrow, approvedEscrow)
        ).not.toThrow()
    })

    it('rejects a Store configured for a different mint despite a canonical decoy account', () => {
        expect(() =>
            requireOftStoreAssetBindings(derivedStore.toBase58(), solanaAddress(2), approvedEscrow, approvedEscrow)
        ).toThrow('token mint is not canonical SAN')
    })

    it('rejects a Store configured for a different escrow than the approved account', () => {
        expect(() =>
            requireOftStoreAssetBindings(derivedStore.toBase58(), CANONICAL_SAN_MINT, solanaAddress(3), approvedEscrow)
        ).toThrow('token escrow differs from the approved escrow')
    })

    it('rejects an approved Store address that is not derived from the approved escrow', () => {
        expect(() =>
            requireOftStoreAssetBindings(solanaAddress(4), CANONICAL_SAN_MINT, approvedEscrow, approvedEscrow)
        ).toThrow('not the production PDA derived from the approved escrow')
    })
})
