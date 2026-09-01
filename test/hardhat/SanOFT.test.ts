import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract, ContractFactory } from 'ethers'
import { deployments, ethers } from 'hardhat'

import { Options } from '@layerzerolabs/lz-v2-utilities'

describe('SanOFT', function () {
    const solanaEid = 30168
    const robinhoodEid = 30416
    const sanDecimals = 6
    const currentSanSupplyRaw = ethers.BigNumber.from('999998816193310')
    const maxSharedSupplyRaw = ethers.BigNumber.from(2).pow(64).sub(1)

    let SanOFT: ContractFactory
    let OFTTestPeer: ContractFactory
    let EndpointV2Mock: ContractFactory
    let owner: SignerWithAddress
    let user: SignerWithAddress
    let attacker: SignerWithAddress
    let endpointOwner: SignerWithAddress
    let solanaPeer: Contract
    let sanOFT: Contract
    let solanaEndpoint: Contract
    let robinhoodEndpoint: Contract

    const toBytes32 = (address: string): string => ethers.utils.hexZeroPad(address, 32)
    const receiveOptions = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()

    before(async function () {
        SanOFT = await ethers.getContractFactory('SanOFT')
        OFTTestPeer = await ethers.getContractFactory('OFTTestPeer')

        ;[owner, user, attacker, endpointOwner] = (await ethers.getSigners()) as unknown as SignerWithAddress[]

        const endpointArtifact = await deployments.getArtifact('EndpointV2Mock')
        EndpointV2Mock = new ContractFactory(endpointArtifact.abi, endpointArtifact.bytecode, endpointOwner)
    })

    beforeEach(async function () {
        solanaEndpoint = await EndpointV2Mock.deploy(solanaEid)
        robinhoodEndpoint = await EndpointV2Mock.deploy(robinhoodEid)

        // OFTTestPeer represents the remote OFT protocol behavior in unit tests only.
        // The production destination under test is always the unmodified SanOFT.
        solanaPeer = await OFTTestPeer.deploy('SAN Solana Test Peer', 'SAN', solanaEndpoint.address, owner.address)
        sanOFT = await SanOFT.deploy('San Chan', 'SAN', robinhoodEndpoint.address, owner.address)

        await solanaEndpoint.setDestLzEndpoint(sanOFT.address, robinhoodEndpoint.address)
        await robinhoodEndpoint.setDestLzEndpoint(solanaPeer.address, solanaEndpoint.address)

        await solanaPeer.connect(owner).setPeer(robinhoodEid, toBytes32(sanOFT.address))
        await sanOFT.connect(owner).setPeer(solanaEid, toBytes32(solanaPeer.address))
    })

    it('configures constructor metadata, endpoint, token address, and owner', async function () {
        expect(await sanOFT.name()).to.equal('San Chan')
        expect(await sanOFT.symbol()).to.equal('SAN')
        expect(await sanOFT.endpoint()).to.equal(robinhoodEndpoint.address)
        expect(await sanOFT.token()).to.equal(sanOFT.address)
        expect(await sanOFT.owner()).to.equal(owner.address)
        expect(await sanOFT.approvalRequired()).to.equal(false)
    })

    it('uses six local/shared decimals with one-to-one base-unit conversion and no dust', async function () {
        expect(await sanOFT.decimals()).to.equal(sanDecimals)
        expect(await sanOFT.sharedDecimals()).to.equal(sanDecimals)
        expect(await sanOFT.decimalConversionRate()).to.equal(1)
        expect(ethers.utils.formatUnits(1, sanDecimals)).to.equal('0.000001')

        const amount = ethers.BigNumber.from('123456789')
        const sendParam = [solanaEid, toBytes32(user.address), amount, amount, '0x', '0x', '0x']
        const [, , receipt] = await sanOFT.quoteOFT(sendParam)

        expect(receipt.amountSentLD).to.equal(amount)
        expect(receipt.amountReceivedLD).to.equal(amount)
    })

    it('keeps the inspected fixed SAN supply below the uint64 shared-decimal maximum', async function () {
        expect(currentSanSupplyRaw.lt(maxSharedSupplyRaw)).to.equal(true)
    })

    it('does not expose arbitrary mint entry points', async function () {
        const callableFunctions = Object.keys(sanOFT.interface.functions)

        expect(callableFunctions.some((signature) => /^mint\(/.test(signature))).to.equal(false)
        expect(callableFunctions.some((signature) => /^ownerMint\(/.test(signature))).to.equal(false)
        expect(callableFunctions.some((signature) => /^adminMint\(/.test(signature))).to.equal(false)

        const mintSelector = ethers.utils.id('mint(address,uint256)').slice(0, 10)
        const calldata = ethers.utils.hexConcat([
            mintSelector,
            ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [attacker.address, 1]),
        ])

        await expect(attacker.sendTransaction({ to: sanOFT.address, data: calldata })).to.be.reverted
        expect(await sanOFT.totalSupply()).to.equal(0)
    })

    it('rejects unauthorized configuration changes', async function () {
        const originalPeer = await sanOFT.peers(solanaEid)

        await expect(sanOFT.connect(attacker).setPeer(solanaEid, toBytes32(attacker.address))).to.be.reverted
        await expect(sanOFT.connect(attacker).setDelegate(attacker.address)).to.be.reverted
        await expect(sanOFT.connect(attacker).setMsgInspector(attacker.address)).to.be.reverted

        expect(await sanOFT.peers(solanaEid)).to.equal(originalPeer)
        expect(await sanOFT.msgInspector()).to.equal(ethers.constants.AddressZero)
        expect(await sanOFT.owner()).to.equal(owner.address)
    })

    it('rejects direct receive calls that do not come from the configured endpoint', async function () {
        const origin = [solanaEid, toBytes32(solanaPeer.address), 1]

        await expect(
            sanOFT.connect(attacker).lzReceive(origin, ethers.constants.HashZero, '0x', attacker.address, '0x')
        ).to.be.reverted
        expect(await sanOFT.totalSupply()).to.equal(0)
    })

    it('credits SAN only through an authenticated LayerZero endpoint delivery', async function () {
        const amount = ethers.utils.parseUnits('25', sanDecimals)
        await solanaPeer.mint(user.address, amount)

        const sendParam = [robinhoodEid, toBytes32(user.address), amount, amount, receiveOptions, '0x', '0x']
        const [nativeFee] = await solanaPeer.connect(user).quoteSend(sendParam, false)

        await solanaPeer.connect(user).send(sendParam, [nativeFee, 0], user.address, { value: nativeFee })

        expect(await sanOFT.balanceOf(user.address)).to.equal(amount)
        expect(await sanOFT.totalSupply()).to.equal(amount)
    })

    it('burns SAN on debit before sending it back through LayerZero', async function () {
        const initialAmount = ethers.utils.parseUnits('25', sanDecimals)
        const returnAmount = ethers.utils.parseUnits('10', sanDecimals)
        await solanaPeer.mint(user.address, initialAmount)

        const inboundParam = [
            robinhoodEid,
            toBytes32(user.address),
            initialAmount,
            initialAmount,
            receiveOptions,
            '0x',
            '0x',
        ]
        const [inboundFee] = await solanaPeer.connect(user).quoteSend(inboundParam, false)
        await solanaPeer.connect(user).send(inboundParam, [inboundFee, 0], user.address, { value: inboundFee })

        const outboundParam = [
            solanaEid,
            toBytes32(user.address),
            returnAmount,
            returnAmount,
            receiveOptions,
            '0x',
            '0x',
        ]
        const [outboundFee] = await sanOFT.connect(user).quoteSend(outboundParam, false)
        const remoteBalanceBefore = await solanaPeer.balanceOf(user.address)

        await sanOFT.connect(user).send(outboundParam, [outboundFee, 0], user.address, { value: outboundFee })

        expect(await sanOFT.balanceOf(user.address)).to.equal(initialAmount.sub(returnAmount))
        expect(await sanOFT.totalSupply()).to.equal(initialAmount.sub(returnAmount))
        expect(await solanaPeer.balanceOf(user.address)).to.equal(remoteBalanceBefore.add(returnAmount))
    })
})
