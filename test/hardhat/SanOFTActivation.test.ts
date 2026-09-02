import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract, ContractFactory } from 'ethers'
import { deployments, ethers } from 'hardhat'

import { Options } from '@layerzerolabs/lz-v2-utilities'

describe('SanOFT fail-closed activation', function () {
    const solanaEid = 30168
    const robinhoodEid = 30416
    const unit = ethers.BigNumber.from(10).pow(6)
    const canaryCapacity = ethers.BigNumber.from(500_000).mul(unit)
    const day = 86_400
    const receiveOptions = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()

    let owner: SignerWithAddress
    let user: SignerWithAddress
    let endpointOwner: SignerWithAddress
    let solanaPeer: Contract
    let sanOFT: Contract
    let solanaEndpoint: Contract
    let robinhoodEndpoint: Contract

    const toBytes32 = (address: string): string => ethers.utils.hexZeroPad(address, 32)
    const sendParam = (dstEid: number, to: string, amount: ReturnType<typeof ethers.BigNumber.from>) => [
        dstEid,
        toBytes32(to),
        amount,
        amount,
        receiveOptions,
        '0x',
        '0x',
    ]

    beforeEach(async function () {
        ;[owner, user, endpointOwner] = (await ethers.getSigners()) as unknown as SignerWithAddress[]
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
    })

    const assertInert = async (label: string): Promise<void> => {
        const amount = unit
        const params = sendParam(solanaEid, user.address, amount)
        const supplyBefore = await sanOFT.totalSupply()
        const sentBefore = await sanOFT.queryFilter(sanOFT.filters.OFTSent())

        expect(await sanOFT.paused(), `${label}: pause state`).to.equal(true)
        await expect(sanOFT.quoteOFT(params), `${label}: quoteOFT`).to.be.reverted
        await expect(sanOFT.quoteSend(params, false), `${label}: quoteSend`).to.be.reverted
        await expect(sanOFT.connect(user).send(params, [0, 0], user.address), `${label}: public send`).to.be.reverted
        expect(await sanOFT.totalSupply(), `${label}: supply`).to.equal(supplyBefore)
        expect((await sanOFT.queryFilter(sanOFT.filters.OFTSent())).length, `${label}: packet event count`).to.equal(
            sentBefore.length
        )
    }

    it('keeps states A-F inert and makes explicit unpause the only activation transition', async function () {
        await assertInert('A: initialized without peer')

        await sanOFT.connect(owner).setPeer(solanaEid, toBytes32(solanaPeer.address))
        await assertInert('B: peer configured')

        await sanOFT.connect(owner).setDelegate(owner.address)
        await assertInert('C: Endpoint delegate/defaults available')

        await sanOFT.connect(owner).setEnforcedOptions([[solanaEid, 1, receiveOptions]])
        await assertInert('D: enforced options configured')

        await sanOFT.connect(owner).setOutboundRateLimit(canaryCapacity, canaryCapacity, day)
        await assertInert('E: security stack remains externally incomplete')

        await sanOFT.connect(owner).setInboundRateLimit(canaryCapacity, canaryCapacity, day)
        await assertInert('F: intended application configuration complete')

        await expect(sanOFT.connect(user).unpause()).to.be.reverted
        await expect(sanOFT.connect(owner).unpause()).to.emit(sanOFT, 'Unpaused').withArgs(owner.address)
        expect(await sanOFT.paused()).to.equal(false)

        const amount = unit
        const inbound = sendParam(robinhoodEid, user.address, amount)
        await solanaPeer.mint(user.address, amount)
        const [inboundFee] = await solanaPeer.connect(user).quoteSend(inbound, false)
        await solanaPeer.connect(user).send(inbound, [inboundFee, 0], user.address, { value: inboundFee })

        const outbound = sendParam(solanaEid, user.address, amount)
        const [outboundFee] = await sanOFT.connect(user).quoteSend(outbound, false)
        await expect(
            sanOFT.connect(user).send(outbound, [outboundFee, 0], user.address, { value: outboundFee })
        ).to.emit(sanOFT, 'OFTSent')
        expect(await sanOFT.totalSupply()).to.equal(0)
    })

    it('keeps the Robinhood-first zero-supply intermediate state unable to send', async function () {
        await sanOFT.connect(owner).setPeer(solanaEid, toBytes32(solanaPeer.address))
        await sanOFT.connect(owner).unpause()
        expect(await sanOFT.paused()).to.equal(false)

        const params = sendParam(solanaEid, user.address, unit)
        const [nativeFee] = await sanOFT.connect(user).quoteSend(params, false)
        const sentBefore = await sanOFT.queryFilter(sanOFT.filters.OFTSent())
        await expect(sanOFT.connect(user).send(params, [nativeFee, 0], user.address, { value: nativeFee })).to.be
            .reverted
        expect(await sanOFT.totalSupply()).to.equal(0)
        expect((await sanOFT.queryFilter(sanOFT.filters.OFTSent())).length).to.equal(sentBefore.length)

        // This local state deliberately represents an interrupted two-chain
        // ceremony. Production policy tests require the opposite application
        // state to match and reject this combination.
        await sanOFT.connect(owner).pause()
        await assertInert('interrupted activation restored to inert')
    })
})
