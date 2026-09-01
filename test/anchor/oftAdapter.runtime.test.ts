import * as anchor from '@coral-xyz/anchor'
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccount,
    createMint,
    getAccount,
    getAssociatedTokenAddressSync,
    getMint,
    mintTo,
} from '@solana/spl-token'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'

import endpointIdl from '../../target/idl/endpoint.json'
import oftIdl from '../../target/idl/oft.json'

const OFT_PROGRAM_ID = new PublicKey('9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD')
const ENDPOINT_MOCK_ID = new PublicKey('8eGbY1MUKMSRoLTSPxen83hPWfT3zTuCVgj2UbS1kKsL')
const REMOTE_EID = 40451
const HOLDER_START = 1_000_000n
const OFT_SEED = Buffer.from('OFT')
const PEER_SEED = Buffer.from('Peer')
const RECEIVE_TYPES_SEED = Buffer.from('LzReceiveTypes')
const OAPP_SEED = Buffer.from('OApp')
const AUTHORIZED_MESSAGE_SEED = Buffer.from('AuthorizedMessage')
const EVENT_SEED = Buffer.from('__event_authority')

type ProgramWithAccounts = anchor.Program & {
    account: Record<string, { fetch(address: PublicKey): Promise<any> }>
}

const bn = (value: bigint | number): anchor.BN => new anchor.BN(value.toString())

const expectRejected = async (operation: () => Promise<unknown>): Promise<void> => {
    let rejected = false
    try {
        await operation()
    } catch {
        rejected = true
    }
    expect(rejected).toBe(true)
}

const encodeMessage = (recipient: PublicKey, amount: bigint): Buffer => {
    const message = Buffer.alloc(40)
    message.set(recipient.toBytes(), 0)
    message.writeBigUInt64BE(amount, 32)
    return message
}

describe('OFT Adapter custody runtime', () => {
    const provider = anchor.AnchorProvider.env()
    anchor.setProvider(provider)
    const payer = (provider.wallet as anchor.Wallet).payer
    const oft = new anchor.Program(oftIdl as anchor.Idl, provider) as ProgramWithAccounts
    const endpoint = new anchor.Program(endpointIdl as anchor.Idl, provider) as ProgramWithAccounts
    const escrow = Keypair.generate()
    const attacker = Keypair.generate()
    const recipient = Keypair.generate()
    const peerAddress = Array.from(Keypair.generate().publicKey.toBytes())
    const wrongPeerAddress = Array.from(Keypair.generate().publicKey.toBytes())
    const [oftStore] = PublicKey.findProgramAddressSync([OFT_SEED, escrow.publicKey.toBuffer()], OFT_PROGRAM_ID)
    const [receiveTypes] = PublicKey.findProgramAddressSync([RECEIVE_TYPES_SEED, oftStore.toBuffer()], OFT_PROGRAM_ID)
    const [peer] = PublicKey.findProgramAddressSync(
        [PEER_SEED, oftStore.toBuffer(), Buffer.from([0, 0, 158, 3])],
        OFT_PROGRAM_ID
    )
    const [oappRegistry] = PublicKey.findProgramAddressSync([OAPP_SEED, oftStore.toBuffer()], ENDPOINT_MOCK_ID)
    const [endpointEventAuthority] = PublicKey.findProgramAddressSync([EVENT_SEED], ENDPOINT_MOCK_ID)
    const [oftEventAuthority] = PublicKey.findProgramAddressSync([EVENT_SEED], OFT_PROGRAM_ID)

    let mint: PublicKey
    let holderToken: PublicKey
    let feeToken: PublicKey
    let recipientToken: PublicKey

    const assertInvariant = async (): Promise<void> => {
        const escrowState = await getAccount(provider.connection, escrow.publicKey)
        const store = await oft.account.oftStore.fetch(oftStore)
        expect(escrowState.amount).toBeGreaterThanOrEqual(BigInt(store.tvlLd.toString()))
    }

    const setPeerConfig = async (config: unknown): Promise<void> => {
        await oft.methods
            .setPeerConfig({ remoteEid: REMOTE_EID, config })
            .accountsStrict({ admin: payer.publicKey, peer, oftStore, systemProgram: SystemProgram.programId })
            .rpc()
        await assertInvariant()
    }

    const sendRemainingAccounts = () => [
        { pubkey: ENDPOINT_MOCK_ID, isSigner: false, isWritable: false },
        { pubkey: oftStore, isSigner: false, isWritable: false },
        { pubkey: oappRegistry, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: payer.publicKey, isSigner: false, isWritable: true },
        { pubkey: endpointEventAuthority, isSigner: false, isWritable: false },
        { pubkey: ENDPOINT_MOCK_ID, isSigner: false, isWritable: false },
    ]

    const send = async (amount: bigint, signer = payer, source = holderToken): Promise<void> => {
        await oft.methods
            .send({
                dstEid: REMOTE_EID,
                to: recipient.publicKey.toBytes(),
                amountLd: bn(amount),
                minAmountLd: bn(amount),
                options: Buffer.alloc(0),
                composeMsg: null,
                nativeFee: bn(0),
                lzTokenFee: bn(0),
            })
            .accountsStrict({
                signer: signer.publicKey,
                peer,
                oftStore,
                tokenSource: source,
                tokenEscrow: escrow.publicKey,
                tokenMint: mint,
                tokenProgram: TOKEN_PROGRAM_ID,
                eventAuthority: oftEventAuthority,
                program: OFT_PROGRAM_ID,
            })
            .remainingAccounts(sendRemainingAccounts())
            .signers(signer === payer ? [] : [signer])
            .rpc()
        await assertInvariant()
    }

    const authorizeMessage = async (
        sender: number[],
        nonce: number,
        guid: number[],
        message: Buffer
    ): Promise<PublicKey> => {
        const [authorizedMessage] = PublicKey.findProgramAddressSync(
            [AUTHORIZED_MESSAGE_SEED, oftStore.toBuffer(), Buffer.from(guid)],
            ENDPOINT_MOCK_ID
        )
        await endpoint.methods
            .authorizeMessage({
                receiver: oftStore,
                srcEid: REMOTE_EID,
                sender,
                nonce: bn(nonce),
                guid,
                message,
            })
            .accountsStrict({
                authority: payer.publicKey,
                oappRegistry,
                authorizedMessage,
                systemProgram: SystemProgram.programId,
            })
            .rpc()
        await assertInvariant()
        return authorizedMessage
    }

    const receive = async (
        sender: number[],
        nonce: number,
        guid: number[],
        message: Buffer,
        authorizedMessage: PublicKey,
        endpointProgram = ENDPOINT_MOCK_ID
    ): Promise<void> => {
        await oft.methods
            .lzReceive({
                srcEid: REMOTE_EID,
                sender,
                nonce: bn(nonce),
                guid,
                message,
                extraData: Buffer.alloc(0),
            })
            .accountsStrict({
                payer: payer.publicKey,
                peer,
                oftStore,
                tokenEscrow: escrow.publicKey,
                toAddress: recipient.publicKey,
                tokenDest: recipientToken,
                tokenMint: mint,
                mintAuthority: null as unknown as PublicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                eventAuthority: oftEventAuthority,
                program: OFT_PROGRAM_ID,
            })
            .remainingAccounts([
                { pubkey: endpointProgram, isSigner: false, isWritable: false },
                { pubkey: oftStore, isSigner: false, isWritable: false },
                { pubkey: oappRegistry, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: authorizedMessage, isSigner: false, isWritable: true },
                { pubkey: payer.publicKey, isSigner: false, isWritable: true },
                { pubkey: endpointEventAuthority, isSigner: false, isWritable: false },
                { pubkey: ENDPOINT_MOCK_ID, isSigner: false, isWritable: false },
            ])
            .rpc()
        await assertInvariant()
    }

    beforeAll(async () => {
        mint = await createMint(provider.connection, payer, payer.publicKey, payer.publicKey, 6)
        holderToken = await createAssociatedTokenAccount(provider.connection, payer, mint, payer.publicKey)
        feeToken = await createAssociatedTokenAccount(provider.connection, payer, mint, Keypair.generate().publicKey)
        recipientToken = getAssociatedTokenAddressSync(mint, recipient.publicKey)
        await mintTo(provider.connection, payer, mint, holderToken, payer, HOLDER_START)
    })

    it('initializes Adapter custody without changing mint authorities', async () => {
        const before = await getMint(provider.connection, mint)
        const [endpointEvent] = PublicKey.findProgramAddressSync([EVENT_SEED], ENDPOINT_MOCK_ID)
        await oft.methods
            .initOft({
                oftType: { adapter: {} },
                admin: payer.publicKey,
                sharedDecimals: 6,
                endpointProgram: ENDPOINT_MOCK_ID,
            })
            .accountsStrict({
                payer: payer.publicKey,
                oftStore,
                lzReceiveTypesAccounts: receiveTypes,
                tokenMint: mint,
                tokenEscrow: escrow.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .remainingAccounts([
                { pubkey: ENDPOINT_MOCK_ID, isSigner: false, isWritable: false },
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: oftStore, isSigner: false, isWritable: false },
                { pubkey: oappRegistry, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: endpointEvent, isSigner: false, isWritable: false },
                { pubkey: ENDPOINT_MOCK_ID, isSigner: false, isWritable: false },
            ])
            .signers([escrow])
            .rpc()

        const after = await getMint(provider.connection, mint)
        const escrowState = await getAccount(provider.connection, escrow.publicKey)
        const store = await oft.account.oftStore.fetch(oftStore)
        expect(escrowState.owner.equals(oftStore)).toBe(true)
        expect(store.tokenMint.equals(mint)).toBe(true)
        expect(store.tokenEscrow.equals(escrow.publicKey)).toBe(true)
        expect(store.tvlLd.toString()).toBe('0')
        expect(after.mintAuthority?.equals(before.mintAuthority!)).toBe(true)
        expect(after.freezeAuthority?.equals(before.freezeAuthority!)).toBe(true)
        await assertInvariant()

        await setPeerConfig({ peerAddress: [peerAddress] })
    })

    it('debits holder tokens atomically into escrow and increases TVL', async () => {
        const amount = 200_000n
        await send(amount)
        expect((await getAccount(provider.connection, holderToken)).amount).toBe(HOLDER_START - amount)
        expect((await getAccount(provider.connection, escrow.publicKey)).amount).toBe(amount)
        expect((await oft.account.oftStore.fetch(oftStore)).tvlLd.toString()).toBe(amount.toString())
    })

    it('rejects an unauthorized holder debit without changing custody', async () => {
        const before = await getAccount(provider.connection, escrow.publicKey)
        await expectRejected(() => send(1n, attacker, holderToken))
        expect((await getAccount(provider.connection, escrow.publicKey)).amount).toBe(before.amount)
        await assertInvariant()
    })

    it('withdraws only surplus and rejects principal or a non-admin', async () => {
        await mintTo(provider.connection, payer, mint, escrow.publicKey, payer, 100n)
        await assertInvariant()
        await oft.methods
            .withdrawFee({ feeLd: bn(100) })
            .accountsStrict({
                admin: payer.publicKey,
                oftStore,
                tokenMint: mint,
                tokenEscrow: escrow.publicKey,
                tokenDest: feeToken,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc()
        expect((await getAccount(provider.connection, feeToken)).amount).toBe(100n)
        await assertInvariant()

        await expectRejected(() =>
            oft.methods
                .withdrawFee({ feeLd: bn(1) })
                .accountsStrict({
                    admin: payer.publicKey,
                    oftStore,
                    tokenMint: mint,
                    tokenEscrow: escrow.publicKey,
                    tokenDest: feeToken,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc()
        )
        await expectRejected(() =>
            oft.methods
                .withdrawFee({ feeLd: bn(1) })
                .accountsStrict({
                    admin: attacker.publicKey,
                    oftStore,
                    tokenMint: mint,
                    tokenEscrow: escrow.publicKey,
                    tokenDest: feeToken,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([attacker])
                .rpc()
        )
        await assertInvariant()
    })

    it('credits only an authenticated matching peer message', async () => {
        const amount = 50_000n
        const nonce = 1
        const guid = Array.from(Keypair.generate().publicKey.toBytes())
        const message = encodeMessage(recipient.publicKey, amount)
        const authorized = await authorizeMessage(peerAddress, nonce, guid, message)
        await receive(peerAddress, nonce, guid, message, authorized)
        expect((await getAccount(provider.connection, recipientToken)).amount).toBe(amount)
        expect((await oft.account.oftStore.fetch(oftStore)).tvlLd.toString()).toBe('150000')
    })

    it('rejects wrong peer, wrong Endpoint, and malformed message atomically', async () => {
        const escrowBefore = (await getAccount(provider.connection, escrow.publicKey)).amount
        const malformedAmount = 1n

        const wrongPeerGuid = Array.from(Keypair.generate().publicKey.toBytes())
        const wrongPeerMessage = encodeMessage(recipient.publicKey, malformedAmount)
        const wrongPeerAuth = await authorizeMessage(wrongPeerAddress, 2, wrongPeerGuid, wrongPeerMessage)
        await expectRejected(() => receive(wrongPeerAddress, 2, wrongPeerGuid, wrongPeerMessage, wrongPeerAuth))

        const wrongEndpointGuid = Array.from(Keypair.generate().publicKey.toBytes())
        const wrongEndpointMessage = encodeMessage(recipient.publicKey, malformedAmount)
        const wrongEndpointAuth = await authorizeMessage(peerAddress, 3, wrongEndpointGuid, wrongEndpointMessage)
        await expectRejected(() =>
            receive(peerAddress, 3, wrongEndpointGuid, wrongEndpointMessage, wrongEndpointAuth, SystemProgram.programId)
        )

        const malformedGuid = Array.from(Keypair.generate().publicKey.toBytes())
        const validMessage = encodeMessage(recipient.publicKey, malformedAmount)
        const malformedAuth = await authorizeMessage(peerAddress, 4, malformedGuid, validMessage)
        const malformedMessage = Buffer.from(Array.from(validMessage))
        malformedMessage[39] ^= 1
        await expectRejected(() => receive(peerAddress, 4, malformedGuid, malformedMessage, malformedAuth))

        expect((await getAccount(provider.connection, escrow.publicKey)).amount).toBe(escrowBefore)
        await assertInvariant()
    })

    it('pauses send and receive while leaving surplus withdrawal callable', async () => {
        await oft.methods
            .setOftConfig({ pauser: [payer.publicKey] })
            .accountsStrict({ admin: payer.publicKey, oftStore })
            .rpc()
        await oft.methods
            .setOftConfig({ unpauser: [payer.publicKey] })
            .accountsStrict({ admin: payer.publicKey, oftStore })
            .rpc()
        await oft.methods.setPause({ paused: true }).accountsStrict({ signer: payer.publicKey, oftStore }).rpc()
        await assertInvariant()

        await expectRejected(() => send(1n))
        const guid = Array.from(Keypair.generate().publicKey.toBytes())
        const message = encodeMessage(recipient.publicKey, 1n)
        const authorized = await authorizeMessage(peerAddress, 5, guid, message)
        await expectRejected(() => receive(peerAddress, 5, guid, message, authorized))

        await mintTo(provider.connection, payer, mint, escrow.publicKey, payer, 1n)
        await oft.methods
            .withdrawFee({ feeLd: bn(1) })
            .accountsStrict({
                admin: payer.publicKey,
                oftStore,
                tokenMint: mint,
                tokenEscrow: escrow.publicKey,
                tokenDest: feeToken,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc()
        await assertInvariant()

        await oft.methods.setPause({ paused: false }).accountsStrict({ signer: payer.publicKey, oftStore }).rpc()
        await assertInvariant()
    })

    it('enforces outbound and inbound buckets including time refill', async () => {
        await setPeerConfig({
            // Keep a ten-second refill window so transaction processing cannot
            // refill the entire bucket before the immediate rejection check.
            outboundRateLimit: [{ refillPerSecond: bn(100), capacity: bn(1_000) }],
        })
        await expectRejected(() => send(1_001n))
        await send(900n)
        await expectRejected(() => send(900n))
        await new Promise((resolve) => setTimeout(resolve, 10_200))
        await send(900n)

        await setPeerConfig({
            inboundRateLimit: [{ refillPerSecond: bn(100), capacity: bn(1_000) }],
        })
        const authorizeAndReceive = async (amount: bigint, nonce: number): Promise<void> => {
            const guid = Array.from(Keypair.generate().publicKey.toBytes())
            const message = encodeMessage(recipient.publicKey, amount)
            const authorized = await authorizeMessage(peerAddress, nonce, guid, message)
            await receive(peerAddress, nonce, guid, message, authorized)
        }

        const overGuid = Array.from(Keypair.generate().publicKey.toBytes())
        const overMessage = encodeMessage(recipient.publicKey, 1_001n)
        const overAuth = await authorizeMessage(peerAddress, 6, overGuid, overMessage)
        await expectRejected(() => receive(peerAddress, 6, overGuid, overMessage, overAuth))
        await authorizeAndReceive(900n, 7)

        const blockedGuid = Array.from(Keypair.generate().publicKey.toBytes())
        const blockedMessage = encodeMessage(recipient.publicKey, 900n)
        const blockedAuth = await authorizeMessage(peerAddress, 8, blockedGuid, blockedMessage)
        await expectRejected(() => receive(peerAddress, 8, blockedGuid, blockedMessage, blockedAuth))
        await new Promise((resolve) => setTimeout(resolve, 10_200))
        await receive(peerAddress, 8, blockedGuid, blockedMessage, blockedAuth)
        await assertInvariant()
    })
})
