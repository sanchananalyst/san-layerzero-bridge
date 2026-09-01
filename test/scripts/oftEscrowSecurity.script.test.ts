import { readFileSync } from 'fs'
import { resolve } from 'path'

const readProgramSource = (relativePath: string): string =>
    readFileSync(resolve(process.cwd(), 'programs/oft/src', relativePath), 'utf8')

describe('LayerZero Solana OFT Adapter escrow source regression guards', () => {
    const send = readProgramSource('instructions/send.rs')
    const receive = readProgramSource('instructions/lz_receive.rs')
    const withdrawFee = readProgramSource('instructions/withdraw_fee.rs')
    const cargo = readFileSync(resolve(process.cwd(), 'Cargo.toml'), 'utf8')

    it('requires the OFT Store admin and restricts fee withdrawal to escrow surplus', () => {
        expect(withdrawFee).toContain('has_one = admin @OFTError::Unauthorized')
        expect(withdrawFee).toContain(
            'ctx.accounts.token_escrow.amount - ctx.accounts.oft_store.tvl_ld >= params.fee_ld'
        )
        expect(withdrawFee).toContain('authority: ctx.accounts.oft_store.to_account_info()')
        expect(cargo).toContain('overflow-checks = true')
    })

    it('accounts outbound Adapter principal before transferring the same flow into escrow', () => {
        expect(send).toContain('ctx.accounts.oft_store.tvl_ld += amount_received_ld')
        expect(send).toContain('from: ctx.accounts.token_source.to_account_info()')
        expect(send).toContain('to: ctx.accounts.token_escrow.to_account_info()')
        expect(send).toContain('amount_sent_ld,')
    })

    it('requires the configured peer and Endpoint clear before releasing Adapter escrow', () => {
        const peerCheck = receive.indexOf('peer.peer_address == params.sender')
        const clear = receive.indexOf('oapp::endpoint_cpi::clear(')
        const tvlDebit = receive.indexOf('ctx.accounts.oft_store.tvl_ld -= amount_received_ld')
        const escrowTransfer = receive.indexOf('from: ctx.accounts.token_escrow.to_account_info()')

        expect(peerCheck).toBeGreaterThan(-1)
        expect(clear).toBeGreaterThan(peerCheck)
        expect(tvlDebit).toBeGreaterThan(clear)
        expect(escrowTransfer).toBeGreaterThan(tvlDebit)
        expect(receive).toContain('sender: params.sender')
        expect(receive).toContain('message: params.message.clone()')
        expect(receive).toContain('authority: ctx.accounts.oft_store.to_account_info()')
    })

    it('preserves escrow balance greater than or equal to TVL in the zero-transfer-fee SAN model', () => {
        let escrow = 0n
        let tvl = 0n

        const outbound = (principal: bigint, applicationFee: bigint) => {
            escrow += principal + applicationFee
            tvl += principal
            expect(escrow).toBeGreaterThanOrEqual(tvl)
        }
        const inbound = (principal: bigint) => {
            expect(principal).toBeLessThanOrEqual(tvl)
            escrow -= principal
            tvl -= principal
            expect(escrow).toBeGreaterThanOrEqual(tvl)
        }
        const withdrawSurplus = (amount: bigint) => {
            expect(amount).toBeLessThanOrEqual(escrow - tvl)
            escrow -= amount
            expect(escrow).toBeGreaterThanOrEqual(tvl)
        }

        outbound(100_000_000n, 1_000_000n)
        inbound(40_000_000n)
        withdrawSurplus(1_000_000n)
        inbound(60_000_000n)
        expect({ escrow, tvl }).toEqual({ escrow: 0n, tvl: 0n })
    })
})
