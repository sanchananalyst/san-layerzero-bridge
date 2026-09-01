declare module '@solana-developers/helpers' {
    import type {
        AddressLookupTableAccount,
        Commitment,
        Connection,
        PublicKey,
        TransactionInstruction,
    } from '@solana/web3.js'

    export function getSimulationComputeUnits(
        connection: Connection,
        instructions: TransactionInstruction[],
        payer: PublicKey,
        lookupTables: AddressLookupTableAccount[],
        commitment?: Commitment
    ): Promise<number | null>
}
