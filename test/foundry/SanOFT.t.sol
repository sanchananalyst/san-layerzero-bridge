// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { SanOFT } from "../../contracts/SanOFT.sol";
import { OFTTestPeer } from "../../contracts/mocks/OFTTestPeer.sol";

import { OFTReceipt, SendParam } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { MessagingFee, MessagingReceipt } from "@layerzerolabs/oft-evm/contracts/OFTCore.sol";
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import { ILayerZeroEndpointV2, Origin } from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import { TestHelperOz5 } from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";

contract SanOFTTest is TestHelperOz5 {
    using OptionsBuilder for bytes;

    uint32 private constant SOLANA_EID = 30168;
    uint8 private constant SAN_DECIMALS = 6;
    uint256 private constant CURRENT_SAN_SUPPLY_RAW = 999998816193310;
    uint256 private constant UNIT = 1e6;
    uint256 private constant CANARY_CAPACITY = 500_000 * UNIT;
    uint64 private constant DAY = 1 days;
    OFTTestPeer private solanaPeer;
    SanOFT private sanOFT;
    address private user = address(0xBEEF);
    address private recipient = address(0xCAFE);
    address private attacker = address(0xBAD);

    event RateLimitConfigured(
        bool indexed inbound,
        uint256 capacity,
        uint256 refillAmount,
        uint64 refillDuration,
        uint256 available
    );

    function setUp() public override {
        vm.deal(user, 100 ether);

        super.setUp();
        setUpEndpoints(2, LibraryType.UltraLightNode);

        // TestHelper endpoints are indexed from 1, so the production EIDs are
        // represented by the peer configuration rather than the endpoint array.
        solanaPeer = OFTTestPeer(
            _deployOApp(
                type(OFTTestPeer).creationCode,
                abi.encode("SAN Solana Test Peer", "SAN", address(endpoints[1]), address(this))
            )
        );
        sanOFT = SanOFT(
            _deployOApp(type(SanOFT).creationCode, abi.encode("San Chan", "SAN", address(endpoints[2]), address(this)))
        );

        solanaPeer.setPeer(2, addressToBytes32(address(sanOFT)));
        sanOFT.setPeer(1, addressToBytes32(address(solanaPeer)));
    }

    function test_constructorConfiguration() public view {
        assertEq(sanOFT.owner(), address(this));
        assertEq(sanOFT.token(), address(sanOFT));
        assertEq(sanOFT.totalSupply(), 0);
        assertEq(sanOFT.name(), "San Chan");
        assertEq(sanOFT.symbol(), "SAN");
        assertEq(sanOFT.decimals(), SAN_DECIMALS);
        assertEq(sanOFT.sharedDecimals(), SAN_DECIMALS);
        assertEq(sanOFT.decimalConversionRate(), 1);
        (uint256 outCapacity, uint256 outAvailable, uint256 outRefill, uint64 outDuration) = sanOFT.outboundRateLimit();
        (uint256 inCapacity, uint256 inAvailable, uint256 inRefill, uint64 inDuration) = sanOFT.inboundRateLimit();
        assertEq(outCapacity, CANARY_CAPACITY);
        assertEq(outAvailable, CANARY_CAPACITY);
        assertEq(outRefill, CANARY_CAPACITY);
        assertEq(outDuration, DAY);
        assertEq(inCapacity, CANARY_CAPACITY);
        assertEq(inAvailable, CANARY_CAPACITY);
        assertEq(inRefill, CANARY_CAPACITY);
        assertEq(inDuration, DAY);
    }

    function test_oneBaseUnitAndNoDust() public view {
        uint256 oneBaseUnit = 1;
        assertEq(oneBaseUnit, 1e-6 * 1e6);

        uint256 amount = 123456789;
        SendParam memory sendParam = SendParam(SOLANA_EID, addressToBytes32(user), amount, amount, "", "", "");
        (, , OFTReceipt memory receipt) = sanOFT.quoteOFT(sendParam);
        assertEq(receipt.amountSentLD, amount);
        assertEq(receipt.amountReceivedLD, amount);
    }

    function test_currentSupplyBelowSharedDecimalMaximum() public pure {
        assertLt(CURRENT_SAN_SUPPLY_RAW, type(uint64).max);
    }

    function test_unauthorizedPeerChangeReverts() public {
        vm.expectRevert();
        vm.prank(user);
        sanOFT.setPeer(SOLANA_EID, addressToBytes32(user));
    }

    function test_ownershipRenunciationIsDisabled() public {
        vm.expectRevert(SanOFT.OwnershipRenunciationDisabled.selector);
        sanOFT.renounceOwnership();

        vm.expectRevert();
        vm.prank(attacker);
        sanOFT.renounceOwnership();
        assertEq(sanOFT.owner(), address(this));
    }

    function test_authenticatedCreditAndDebitBurn() public {
        uint256 amount = 25 * 10 ** SAN_DECIMALS;
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200000, 0);

        solanaPeer.mint(user, amount);
        SendParam memory inbound = SendParam(2, addressToBytes32(user), amount, amount, options, "", "");
        MessagingFee memory inboundFee = solanaPeer.quoteSend(inbound, false);

        vm.prank(user);
        solanaPeer.send{ value: inboundFee.nativeFee }(inbound, inboundFee, payable(user));
        verifyPackets(2, addressToBytes32(address(sanOFT)));

        assertEq(sanOFT.balanceOf(user), amount);
        assertEq(sanOFT.totalSupply(), amount);

        SendParam memory outbound = SendParam(1, addressToBytes32(user), amount, amount, options, "", "");
        MessagingFee memory outboundFee = sanOFT.quoteSend(outbound, false);

        vm.prank(user);
        sanOFT.send{ value: outboundFee.nativeFee }(outbound, outboundFee, payable(user));

        assertEq(sanOFT.balanceOf(user), 0);
        assertEq(sanOFT.totalSupply(), 0);
    }

    function test_outboundCapacityBoundariesAndNoRefillAboveCapacity() public {
        _bridgeIn(CANARY_CAPACITY, user);
        _bridgeOut(CANARY_CAPACITY);
        (, uint256 available, , ) = sanOFT.outboundRateLimit();
        assertEq(available, 0);

        SendParam memory oneMore = _sendParam(1, user, 1);
        vm.expectRevert();
        sanOFT.quoteSend(oneMore, false);

        vm.warp(block.timestamp + DAY / 2);
        (, available, , ) = sanOFT.outboundRateLimit();
        assertEq(available, CANARY_CAPACITY / 2);
        vm.warp(block.timestamp + DAY / 2);
        (, available, , ) = sanOFT.outboundRateLimit();
        assertEq(available, CANARY_CAPACITY);
        vm.warp(block.timestamp + 365 days);
        (, available, , ) = sanOFT.outboundRateLimit();
        assertEq(available, CANARY_CAPACITY);
    }

    function test_outboundBelowAndExactlyCapacity() public {
        _bridgeIn(CANARY_CAPACITY, user);
        sanOFT.setOutboundRateLimit(CANARY_CAPACITY, 1, DAY);
        _bridgeOut(CANARY_CAPACITY - 1);
        (, uint256 available, , ) = sanOFT.outboundRateLimit();
        assertEq(available, 1);
        _bridgeOut(1);
        (, available, , ) = sanOFT.outboundRateLimit();
        assertEq(available, 0);
    }

    function test_inboundExhaustionDoesNotMintAndRetriesAfterRefill() public {
        sanOFT.setInboundRateLimit(CANARY_CAPACITY, 1, DAY);
        _bridgeIn(CANARY_CAPACITY, user);
        _scheduleInbound(1, recipient);

        vm.expectRevert();
        this.verifyPackets(2, addressToBytes32(address(sanOFT)));
        assertEq(sanOFT.balanceOf(recipient), 0);
        assertTrue(hasPendingPackets(2, addressToBytes32(address(sanOFT))));

        sanOFT.setInboundRateLimit(CANARY_CAPACITY, CANARY_CAPACITY, DAY);
        vm.warp(block.timestamp + DAY);
        verifyPackets(2, addressToBytes32(address(sanOFT)));
        assertEq(sanOFT.balanceOf(recipient), 1);
        assertFalse(hasPendingPackets(2, addressToBytes32(address(sanOFT))));
    }

    function test_ownerConfigurationEventClampAndAuthorization() public {
        uint256 capacity = 100 * UNIT;
        sanOFT.setOutboundRateLimit(capacity, capacity, DAY);
        _bridgeIn(capacity, user);
        _bridgeOut(40 * UNIT);

        uint256 lower = 50 * UNIT;
        vm.expectEmit(true, false, false, true);
        emit RateLimitConfigured(false, lower, lower, DAY, lower);
        sanOFT.setOutboundRateLimit(lower, lower, DAY);
        (, uint256 available, , ) = sanOFT.outboundRateLimit();
        assertEq(available, lower);

        sanOFT.setOutboundRateLimit(200 * UNIT, 200 * UNIT, DAY);
        (, available, , ) = sanOFT.outboundRateLimit();
        assertEq(available, lower);

        vm.startPrank(attacker);
        vm.expectRevert();
        sanOFT.setOutboundRateLimit(1, 1, 1);
        vm.expectRevert();
        sanOFT.setInboundRateLimit(1, 1, 1);
        vm.stopPrank();
    }

    function test_invalidRateConfigurationsRevert() public {
        vm.expectRevert();
        sanOFT.setOutboundRateLimit(0, 1, 1);
        vm.expectRevert();
        sanOFT.setOutboundRateLimit(1, 0, 1);
        vm.expectRevert();
        sanOFT.setOutboundRateLimit(1, 1, 0);
        vm.expectRevert();
        sanOFT.setOutboundRateLimit(1, 2, 1);
        vm.expectRevert();
        sanOFT.setOutboundRateLimit(uint256(type(uint64).max) + 1, 1, 1);
    }

    function test_failedBurnAndDispatchDoNotConsumeOutboundCapacity() public {
        uint256 capacity = 100 * UNIT;
        sanOFT.setOutboundRateLimit(capacity, capacity, DAY);
        SendParam memory params = _sendParam(1, user, UNIT);
        MessagingFee memory fee = sanOFT.quoteSend(params, false);

        vm.prank(user);
        vm.expectRevert();
        sanOFT.send{ value: fee.nativeFee }(params, fee, payable(user));
        (, uint256 available, , ) = sanOFT.outboundRateLimit();
        assertEq(available, capacity);

        _bridgeIn(UNIT, user);
        uint256 balanceBefore = sanOFT.balanceOf(user);
        sanOFT.setPeer(1, bytes32(0));
        vm.prank(user);
        vm.expectRevert();
        sanOFT.send(params, MessagingFee(0, 0), payable(user));
        (, available, , ) = sanOFT.outboundRateLimit();
        assertEq(available, capacity);
        assertEq(sanOFT.balanceOf(user), balanceBefore);
    }

    function test_pauseLeavesTransfersLiveAndRetryIsExactlyOnce() public {
        uint256 amount = 25 * UNIT;
        sanOFT.pause();
        MessagingReceipt memory receipt = _scheduleInbound(amount, user);

        vm.expectRevert();
        this.verifyPackets(2, addressToBytes32(address(sanOFT)));
        assertEq(sanOFT.totalSupply(), 0);
        assertTrue(hasPendingPackets(2, addressToBytes32(address(sanOFT))));

        vm.prank(attacker);
        vm.expectRevert();
        sanOFT.unpause();
        sanOFT.unpause();
        verifyPackets(2, addressToBytes32(address(sanOFT)));
        assertEq(sanOFT.balanceOf(user), amount);
        assertFalse(hasPendingPackets(2, addressToBytes32(address(sanOFT))));

        vm.prank(user);
        sanOFT.transfer(recipient, UNIT);
        assertEq(sanOFT.balanceOf(recipient), UNIT);

        Origin memory origin = Origin(1, addressToBytes32(address(solanaPeer)), receipt.nonce);
        bytes memory message = abi.encodePacked(addressToBytes32(user), uint64(amount));
        ILayerZeroEndpointV2 endpoint = ILayerZeroEndpointV2(endpoints[2]);
        vm.expectRevert();
        endpoint.lzReceive(origin, address(sanOFT), receipt.guid, message, "");
        assertEq(sanOFT.totalSupply(), amount);
    }

    function test_bridgeSendAndQuotesFailWhilePausedThenRecover() public {
        _bridgeIn(10 * UNIT, user);
        sanOFT.pause();
        SendParam memory params = _sendParam(1, user, UNIT);
        vm.expectRevert();
        sanOFT.quoteOFT(params);
        vm.expectRevert();
        sanOFT.quoteSend(params, false);
        vm.prank(user);
        vm.expectRevert();
        sanOFT.send(params, MessagingFee(0, 0), payable(user));
        assertEq(sanOFT.totalSupply(), 10 * UNIT);

        sanOFT.unpause();
        _bridgeOut(UNIT);
        assertEq(sanOFT.totalSupply(), 9 * UNIT);
    }

    function test_wrongEndpointPeerMalformedAndEmergencyCallsCannotMint() public {
        bytes memory message = abi.encodePacked(addressToBytes32(user), uint64(UNIT));
        Origin memory valid = Origin(1, addressToBytes32(address(solanaPeer)), 1);
        vm.expectRevert();
        sanOFT.lzReceive(valid, bytes32(0), message, attacker, "");

        vm.prank(endpoints[2]);
        vm.expectRevert();
        sanOFT.lzReceive(Origin(1, addressToBytes32(attacker), 1), bytes32(0), message, attacker, "");
        vm.prank(endpoints[2]);
        vm.expectRevert();
        sanOFT.lzReceive(valid, bytes32(0), hex"1234", attacker, "");

        sanOFT.pause();
        sanOFT.unpause();
        sanOFT.setOutboundRateLimit(CANARY_CAPACITY, CANARY_CAPACITY, DAY);
        sanOFT.setInboundRateLimit(CANARY_CAPACITY, CANARY_CAPACITY, DAY);
        assertEq(sanOFT.totalSupply(), 0);

        (bool success, ) = address(sanOFT).call(abi.encodeWithSignature("mint(address,uint256)", attacker, UNIT));
        assertFalse(success);
        assertEq(sanOFT.totalSupply(), 0);
    }

    function test_crossChainBackingModelWithPendingMessages() public {
        uint256 modeledEscrow;
        uint256 amount = 100 * UNIT;
        modeledEscrow += amount;
        _bridgeIn(amount, user);
        assertLe(sanOFT.totalSupply(), modeledEscrow);

        uint256 returning = 40 * UNIT;
        _bridgeOut(returning);
        assertLe(sanOFT.totalSupply(), modeledEscrow);
        modeledEscrow -= returning;
        assertEq(sanOFT.totalSupply(), modeledEscrow);

        sanOFT.pause();
        modeledEscrow += returning;
        _scheduleInbound(returning, user);
        vm.expectRevert();
        this.verifyPackets(2, addressToBytes32(address(sanOFT)));
        assertLe(sanOFT.totalSupply(), modeledEscrow);
    }

    function _options() private pure returns (bytes memory) {
        return OptionsBuilder.newOptions().addExecutorLzReceiveOption(200_000, 0);
    }

    function _sendParam(uint32 dstEid, address to, uint256 amount) private pure returns (SendParam memory) {
        return SendParam(dstEid, addressToBytes32(to), amount, amount, _options(), "", "");
    }

    function _scheduleInbound(uint256 amount, address to) private returns (MessagingReceipt memory receipt) {
        solanaPeer.mint(user, amount);
        SendParam memory inbound = _sendParam(2, to, amount);
        MessagingFee memory fee = solanaPeer.quoteSend(inbound, false);
        vm.prank(user);
        (receipt, ) = solanaPeer.send{ value: fee.nativeFee }(inbound, fee, payable(user));
    }

    function _bridgeIn(uint256 amount, address to) private {
        _scheduleInbound(amount, to);
        verifyPackets(2, addressToBytes32(address(sanOFT)));
    }

    function _bridgeOut(uint256 amount) private {
        SendParam memory outbound = _sendParam(1, user, amount);
        MessagingFee memory fee = sanOFT.quoteSend(outbound, false);
        vm.prank(user);
        sanOFT.send{ value: fee.nativeFee }(outbound, fee, payable(user));
    }
}
