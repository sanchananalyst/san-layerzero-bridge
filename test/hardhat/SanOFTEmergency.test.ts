import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Contract, ContractFactory } from 'ethers'
import { deployments, ethers, network } from 'hardhat'

import { Options } from '@layerzerolabs/lz-v2-utilities'

describe('SanOFT emergency controls', function () {
    const solanaEid = 30168
    const robinhoodEid = 30416
    const unit = BigNumber.from(10).pow(6)
    const canaryCapacity = BigNumber.from(500_000).mul(unit)
    const day = 86_400
    const receiveOptions = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()

    let owner: SignerWithAddress
    let user: SignerWithAddress
    let recipient: SignerWithAddress
    let attacker: SignerWithAddress
    let endpointOwner: SignerWithAddress
    let solanaPeer: Contract
    let sanOFT: Contract
    let solanaEndpoint: Contract
    let robinhoodEndpoint: Contract

    const toBytes32 = (address: string): string => ethers.utils.hexZeroPad(address, 32)
    const sendParam = (dstEid: number, to: string, amount: BigNumber) => [
        dstEid,
        toBytes32(to),
        amount,
        amount,
        receiveOptions,
        '0x',
        '0x',
    ]
    const oftMessage = (to: string, amount: BigNumber): string =>
        ethers.utils.solidityPack(['bytes32', 'uint64'], [toBytes32(to), amount])

    const bridgeIn = async (amount: BigNumber, to = user.address): Promise<void> => {
        await solanaPeer.mint(user.address, amount)
        const params = sendParam(robinhoodEid, to, amount)
        const [nativeFee] = await solanaPeer.connect(user).quoteSend(params, false)
        await solanaPeer.connect(user).send(params, [nativeFee, 0], user.address, { value: nativeFee })
    }

    const bridgeOut = async (amount: BigNumber): Promise<void> => {
        const params = sendParam(solanaEid, user.address, amount)
        const [nativeFee] = await sanOFT.connect(user).quoteSend(params, false)
        await sanOFT.connect(user).send(params, [nativeFee, 0], user.address, { value: nativeFee })
    }

    const advance = async (seconds: number): Promise<void> => {
        await network.provider.send('evm_increaseTime', [seconds])
        await network.provider.send('evm_mine')
    }

    before(async function () {
        ;[owner, user, recipient, attacker, endpointOwner] =
            (await ethers.getSigners()) as unknown as SignerWithAddress[]
    })

    beforeEach(async function () {
        const endpointArtifact = await deployments.getArtifact('EndpointV2Mock')
        const EndpointV2Mock = new ContractFactory(endpointArtifact.abi, endpointArtifact.bytecode, endpointOwner)
        const OFTTestPeer = await ethers.getContractFactory('OFTTestPeer')
        const SanOFT = await ethers.getContractFactory('SanOFT')

        solanaEndpoint = await EndpointV2Mock.deploy(solanaEid)
        robinhoodEndpoint = await EndpointV2Mock.deploy(robinhoodEid)
        solanaPeer = await OFTTestPeer.deploy('SAN Bridge Test Peer', 'tSAN', solanaEndpoint.address, owner.address)
        sanOFT = await SanOFT.deploy('San Chan', 'SAN', robinhoodEndpoint.address, owner.address)

        await solanaEndpoint.setDestLzEndpoint(sanOFT.address, robinhoodEndpoint.address)
        await robinhoodEndpoint.setDestLzEndpoint(solanaPeer.address, solanaEndpoint.address)
        await solanaPeer.connect(owner).setPeer(robinhoodEid, toBytes32(sanOFT.address))
        await sanOFT.connect(owner).setPeer(solanaEid, toBytes32(solanaPeer.address))
    })

    it('initializes exact six-decimal canary buckets', async function () {
        for (const bucket of [await sanOFT.outboundRateLimit(), await sanOFT.inboundRateLimit()]) {
            expect(bucket.capacity).to.equal(canaryCapacity)
            expect(bucket.available).to.equal(canaryCapacity)
            expect(bucket.refillAmount).to.equal(canaryCapacity)
            expect(bucket.refillDuration).to.equal(day)
        }
        expect(await sanOFT.decimals()).to.equal(6)
        expect(await sanOFT.sharedDecimals()).to.equal(6)
        expect(await sanOFT.decimalConversionRate()).to.equal(1)
    })

    it('allows outbound below and exactly at capacity, then rejects zero capacity and one base unit more', async function () {
        await bridgeIn(canaryCapacity)
        await sanOFT.connect(owner).setOutboundRateLimit(canaryCapacity, 1, day)
        await bridgeOut(canaryCapacity.sub(1))
        expect((await sanOFT.outboundRateLimit()).available).to.equal(1)
        await bridgeOut(BigNumber.from(1))
        expect((await sanOFT.outboundRateLimit()).available).to.equal(0)

        const one = BigNumber.from(1)
        await expect(sanOFT.quoteSend(sendParam(solanaEid, user.address, one), false)).to.be.reverted

        await sanOFT.connect(owner).setOutboundRateLimit(canaryCapacity, canaryCapacity, day)
        await expect(sanOFT.quoteSend(sendParam(solanaEid, user.address, canaryCapacity.add(1)), false)).to.be.reverted
    })

    it('refills partially, fully after 24 hours, and never above capacity', async function () {
        await bridgeIn(canaryCapacity)
        await bridgeOut(canaryCapacity)
        await advance(day / 2)
        expect((await sanOFT.outboundRateLimit()).available).to.equal(canaryCapacity.div(2))

        await advance(day / 2)
        expect((await sanOFT.outboundRateLimit()).available).to.equal(canaryCapacity)

        await advance(day * 365)
        expect((await sanOFT.outboundRateLimit()).available).to.equal(canaryCapacity)
    })

    it('enforces the inbound bucket before mint and refills it', async function () {
        await sanOFT.connect(owner).setInboundRateLimit(canaryCapacity, 1, day)
        await bridgeIn(canaryCapacity)
        expect(await sanOFT.totalSupply()).to.equal(canaryCapacity)
        expect((await sanOFT.inboundRateLimit()).available).to.equal(0)

        await bridgeIn(BigNumber.from(1), recipient.address)
        expect(await sanOFT.balanceOf(recipient.address)).to.equal(0)
        expect((await sanOFT.inboundRateLimit()).available).to.equal(0)

        await sanOFT.connect(owner).setInboundRateLimit(canaryCapacity, canaryCapacity, day)
        await advance(day / 2)
        await bridgeIn(canaryCapacity.div(2), recipient.address)
        expect(await sanOFT.balanceOf(recipient.address)).to.equal(canaryCapacity.div(2))
    })

    it('allows owner configuration, emits events, clamps decreases, and does not gift capacity on increases', async function () {
        const capacity = BigNumber.from(100).mul(unit)
        const used = BigNumber.from(40).mul(unit)
        await sanOFT.connect(owner).setOutboundRateLimit(capacity, capacity, day)
        await bridgeIn(capacity)
        await bridgeOut(used)

        const lower = BigNumber.from(50).mul(unit)
        await expect(sanOFT.connect(owner).setOutboundRateLimit(lower, lower, day))
            .to.emit(sanOFT, 'RateLimitConfigured')
            .withArgs(false, lower, lower, day, lower)
        expect((await sanOFT.outboundRateLimit()).available).to.equal(lower)

        const higher = BigNumber.from(200).mul(unit)
        await sanOFT.connect(owner).setOutboundRateLimit(higher, higher, day)
        expect((await sanOFT.outboundRateLimit()).available).to.equal(lower)
    })

    it('rejects unauthorized and invalid rate-limit configuration', async function () {
        await expect(sanOFT.connect(attacker).setOutboundRateLimit(1, 1, 1)).to.be.reverted
        await expect(sanOFT.connect(attacker).setInboundRateLimit(1, 1, 1)).to.be.reverted
        await expect(sanOFT.connect(owner).setOutboundRateLimit(0, 1, 1)).to.be.reverted
        await expect(sanOFT.connect(owner).setOutboundRateLimit(1, 0, 1)).to.be.reverted
        await expect(sanOFT.connect(owner).setOutboundRateLimit(1, 1, 0)).to.be.reverted
        await expect(sanOFT.connect(owner).setOutboundRateLimit(1, 2, 1)).to.be.reverted
        await expect(sanOFT.connect(owner).setOutboundRateLimit(BigNumber.from(2).pow(64), 1, 1)).to.be.reverted
    })

    it('disables ownership renunciation for owner and non-owner', async function () {
        await expect(sanOFT.connect(owner).renounceOwnership()).to.be.reverted
        await expect(sanOFT.connect(attacker).renounceOwnership()).to.be.reverted
        expect(await sanOFT.owner()).to.equal(owner.address)
    })

    it('does not consume outbound capacity when burn or LayerZero dispatch fails', async function () {
        const capacity = BigNumber.from(100).mul(unit)
        await sanOFT.connect(owner).setOutboundRateLimit(capacity, capacity, day)

        const noBalanceAmount = BigNumber.from(1).mul(unit)
        const params = sendParam(solanaEid, user.address, noBalanceAmount)
        const [nativeFee] = await sanOFT.connect(user).quoteSend(params, false)
        await expect(sanOFT.connect(user).send(params, [nativeFee, 0], user.address, { value: nativeFee })).to.be
            .reverted
        expect((await sanOFT.outboundRateLimit()).available).to.equal(capacity)

        await bridgeIn(noBalanceAmount)
        const balanceBefore = await sanOFT.balanceOf(user.address)
        await sanOFT.connect(owner).setPeer(solanaEid, ethers.constants.HashZero)
        await expect(sanOFT.connect(user).send(params, [0, 0], user.address)).to.be.reverted
        expect((await sanOFT.outboundRateLimit()).available).to.equal(capacity)
        expect(await sanOFT.balanceOf(user.address)).to.equal(balanceBefore)
    })

    it('pauses only bridging and restores outbound operation after unpause', async function () {
        const amount = BigNumber.from(10).mul(unit)
        await bridgeIn(amount)
        const supplyBefore = await sanOFT.totalSupply()

        await expect(sanOFT.connect(owner).pause()).to.emit(sanOFT, 'Paused').withArgs(owner.address)
        await expect(sanOFT.connect(attacker).unpause()).to.be.reverted
        await expect(sanOFT.quoteOFT(sendParam(solanaEid, user.address, amount))).to.be.reverted
        await expect(sanOFT.quoteSend(sendParam(solanaEid, user.address, amount), false)).to.be.reverted
        await expect(sanOFT.connect(user).send(sendParam(solanaEid, user.address, amount), [0, 0], user.address)).to.be
            .reverted
        expect(await sanOFT.totalSupply()).to.equal(supplyBefore)

        await sanOFT.connect(user).transfer(recipient.address, amount.div(2))
        expect(await sanOFT.balanceOf(recipient.address)).to.equal(amount.div(2))

        await expect(sanOFT.connect(owner).unpause()).to.emit(sanOFT, 'Unpaused').withArgs(owner.address)
        await bridgeOut(amount.div(2))
        expect(await sanOFT.totalSupply()).to.equal(supplyBefore.sub(amount.div(2)))
    })

    it('keeps a paused inbound credit unminted and permits authenticated retry after unpause', async function () {
        const amount = BigNumber.from(25).mul(unit)
        await sanOFT.connect(owner).pause()
        await bridgeIn(amount)
        expect(await sanOFT.totalSupply()).to.equal(0)
        expect((await sanOFT.inboundRateLimit()).available).to.equal(canaryCapacity)

        await sanOFT.connect(owner).unpause()
        await network.provider.request({ method: 'hardhat_impersonateAccount', params: [robinhoodEndpoint.address] })
        await network.provider.send('hardhat_setBalance', [robinhoodEndpoint.address, '0x1000000000000000000'])
        const endpointSigner = (await ethers.getSigner(robinhoodEndpoint.address)) as unknown as SignerWithAddress
        const origin = [solanaEid, toBytes32(solanaPeer.address), 1]
        await sanOFT
            .connect(endpointSigner)
            .lzReceive(origin, ethers.utils.id('retry'), oftMessage(user.address, amount), attacker.address, '0x')
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [robinhoodEndpoint.address],
        })

        expect(await sanOFT.balanceOf(user.address)).to.equal(amount)
        expect((await sanOFT.inboundRateLimit()).available).to.equal(canaryCapacity.sub(amount))
    })

    it('preserves Endpoint, peer, and message authentication', async function () {
        const amount = BigNumber.from(1).mul(unit)
        const validOrigin = [solanaEid, toBytes32(solanaPeer.address), 1]
        const message = oftMessage(user.address, amount)
        await expect(
            sanOFT.connect(attacker).lzReceive(validOrigin, ethers.constants.HashZero, message, attacker.address, '0x')
        ).to.be.reverted

        await network.provider.request({ method: 'hardhat_impersonateAccount', params: [robinhoodEndpoint.address] })
        await network.provider.send('hardhat_setBalance', [robinhoodEndpoint.address, '0x1000000000000000000'])
        const endpointSigner = (await ethers.getSigner(robinhoodEndpoint.address)) as unknown as SignerWithAddress
        const wrongOrigin = [solanaEid, toBytes32(attacker.address), 1]
        await expect(
            sanOFT
                .connect(endpointSigner)
                .lzReceive(wrongOrigin, ethers.constants.HashZero, message, attacker.address, '0x')
        ).to.be.reverted
        await expect(
            sanOFT
                .connect(endpointSigner)
                .lzReceive(validOrigin, ethers.constants.HashZero, '0x1234', attacker.address, '0x')
        ).to.be.reverted
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [robinhoodEndpoint.address],
        })

        expect(await sanOFT.totalSupply()).to.equal(0)
        expect((await sanOFT.inboundRateLimit()).available).to.equal(canaryCapacity)
    })

    it('exposes no arbitrary mint ABI and emergency owner calls cannot alter supply', async function () {
        const forbidden = /^(mint|ownerMint|adminMint|bridgeMint|emergencyMint)\(/
        expect(Object.keys(sanOFT.interface.functions).some((signature) => forbidden.test(signature))).to.equal(false)

        await sanOFT.connect(owner).pause()
        await sanOFT.connect(owner).unpause()
        await sanOFT.connect(owner).setOutboundRateLimit(canaryCapacity, canaryCapacity, day)
        await sanOFT.connect(owner).setInboundRateLimit(canaryCapacity, canaryCapacity, day)
        expect(await sanOFT.totalSupply()).to.equal(0)
    })

    it('preserves the escrow-backing model across settled and pending messages', async function () {
        const amount = BigNumber.from(100).mul(unit)
        let modeledEscrow = BigNumber.from(0)

        modeledEscrow = modeledEscrow.add(amount)
        await bridgeIn(amount)
        expect(await sanOFT.totalSupply()).to.equal(amount)
        expect((await sanOFT.totalSupply()).lte(modeledEscrow)).to.equal(true)

        const returning = BigNumber.from(40).mul(unit)
        await bridgeOut(returning)
        expect(await sanOFT.totalSupply()).to.equal(amount.sub(returning))
        expect((await sanOFT.totalSupply()).lte(modeledEscrow)).to.equal(true)
        modeledEscrow = modeledEscrow.sub(returning)
        expect(await sanOFT.totalSupply()).to.equal(modeledEscrow)

        await sanOFT.connect(owner).pause()
        modeledEscrow = modeledEscrow.add(returning)
        await bridgeIn(returning)
        expect((await sanOFT.totalSupply()).lte(modeledEscrow)).to.equal(true)
    })
})
