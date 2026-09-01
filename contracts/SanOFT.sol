// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";

/// @title SAN Omnichain Fungible Token
/// @notice Robinhood Chain representation of canonical SAN escrowed by the
///         LayerZero Solana OFT Adapter.
/// @dev Token credit and debit behavior is inherited unchanged from LayerZero's
///      standard OFT implementation. In particular, OFT burns on send and only
///      mints from the authenticated LayerZero receive path.
contract SanOFT is OFT, Pausable {
    uint256 public constant CANARY_CAPACITY = 500_000 * 10 ** 6;
    uint256 public constant CANARY_REFILL_AMOUNT = 500_000 * 10 ** 6;
    uint64 public constant CANARY_REFILL_DURATION = 1 days;

    struct TokenBucket {
        uint256 capacity;
        uint256 available;
        uint256 refillAmount;
        uint64 refillDuration;
        uint256 lastUpdated;
        uint256 remainder;
    }

    error InvalidRateLimitConfiguration();
    error BridgeRateLimitExceeded(bool inbound, uint256 requested, uint256 available);
    error OwnershipRenunciationDisabled();

    event RateLimitConfigured(
        bool indexed inbound,
        uint256 capacity,
        uint256 refillAmount,
        uint64 refillDuration,
        uint256 available
    );

    TokenBucket private _outboundBucket;
    TokenBucket private _inboundBucket;

    constructor(
        string memory name_,
        string memory symbol_,
        address endpoint_,
        address delegate_
    ) OFT(name_, symbol_, endpoint_, delegate_) Ownable(delegate_) {
        _initializeBucket(_outboundBucket, false);
        _initializeBucket(_inboundBucket, true);
    }

    /// @notice SAN uses the canonical Solana mint's six-decimal precision on
    ///         every chain in the OFT mesh.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Stops cross-chain debit and credit without stopping ERC-20 transfers.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Restores cross-chain debit and credit.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice A live bridge must never lose all peer and emergency-control
    ///         administration. Ownership may only be handed to another owner.
    function renounceOwnership() public view override onlyOwner {
        revert OwnershipRenunciationDisabled();
    }

    function setOutboundRateLimit(uint256 capacity_, uint256 refillAmount_, uint64 refillDuration_) external onlyOwner {
        _configureBucket(_outboundBucket, false, capacity_, refillAmount_, refillDuration_);
    }

    function setInboundRateLimit(uint256 capacity_, uint256 refillAmount_, uint64 refillDuration_) external onlyOwner {
        _configureBucket(_inboundBucket, true, capacity_, refillAmount_, refillDuration_);
    }

    function outboundRateLimit()
        external
        view
        returns (uint256 capacity, uint256 available, uint256 refillAmount, uint64 refillDuration)
    {
        return _bucketView(_outboundBucket);
    }

    function inboundRateLimit()
        external
        view
        returns (uint256 capacity, uint256 available, uint256 refillAmount, uint64 refillDuration)
    {
        return _bucketView(_inboundBucket);
    }

    function _debitView(
        uint256 amountLD_,
        uint256 minAmountLD_,
        uint32 dstEid_
    ) internal view override returns (uint256 amountSentLD, uint256 amountReceivedLD) {
        _requireNotPaused();
        (amountSentLD, amountReceivedLD) = super._debitView(amountLD_, minAmountLD_, dstEid_);
        uint256 available = _available(_outboundBucket);
        if (amountReceivedLD > available) {
            revert BridgeRateLimitExceeded(false, amountReceivedLD, available);
        }
    }

    function _debit(
        address from_,
        uint256 amountLD_,
        uint256 minAmountLD_,
        uint32 dstEid_
    ) internal override returns (uint256 amountSentLD, uint256 amountReceivedLD) {
        (amountSentLD, amountReceivedLD) = super._debit(from_, amountLD_, minAmountLD_, dstEid_);
        _consume(_outboundBucket, false, amountReceivedLD);
    }

    function _credit(
        address to_,
        uint256 amountLD_,
        uint32 srcEid_
    ) internal override whenNotPaused returns (uint256 amountReceivedLD) {
        _consume(_inboundBucket, true, amountLD_);
        return super._credit(to_, amountLD_, srcEid_);
    }

    function _initializeBucket(TokenBucket storage bucket_, bool inbound_) private {
        bucket_.capacity = CANARY_CAPACITY;
        bucket_.available = CANARY_CAPACITY;
        bucket_.refillAmount = CANARY_REFILL_AMOUNT;
        bucket_.refillDuration = CANARY_REFILL_DURATION;
        bucket_.lastUpdated = block.timestamp;
        emit RateLimitConfigured(
            inbound_,
            CANARY_CAPACITY,
            CANARY_REFILL_AMOUNT,
            CANARY_REFILL_DURATION,
            CANARY_CAPACITY
        );
    }

    function _configureBucket(
        TokenBucket storage bucket_,
        bool inbound_,
        uint256 capacity_,
        uint256 refillAmount_,
        uint64 refillDuration_
    ) private {
        if (
            capacity_ == 0 ||
            capacity_ > type(uint64).max ||
            refillAmount_ == 0 ||
            refillAmount_ > capacity_ ||
            refillDuration_ == 0
        ) revert InvalidRateLimitConfiguration();

        _refill(bucket_);
        uint256 available = Math.min(bucket_.available, capacity_);
        bucket_.capacity = capacity_;
        bucket_.available = available;
        bucket_.refillAmount = refillAmount_;
        bucket_.refillDuration = refillDuration_;
        bucket_.lastUpdated = block.timestamp;
        bucket_.remainder = 0;

        emit RateLimitConfigured(inbound_, capacity_, refillAmount_, refillDuration_, available);
    }

    function _consume(TokenBucket storage bucket_, bool inbound_, uint256 amount_) private {
        _refill(bucket_);
        uint256 available = bucket_.available;
        if (amount_ > available) revert BridgeRateLimitExceeded(inbound_, amount_, available);
        bucket_.available = available - amount_;
    }

    function _refill(TokenBucket storage bucket_) private {
        (uint256 available, uint256 remainder) = _preview(bucket_);
        bucket_.available = available;
        bucket_.remainder = remainder;
        bucket_.lastUpdated = block.timestamp;
    }

    function _bucketView(
        TokenBucket storage bucket_
    ) private view returns (uint256 capacity, uint256 available, uint256 refillAmount, uint64 refillDuration) {
        capacity = bucket_.capacity;
        available = _available(bucket_);
        refillAmount = bucket_.refillAmount;
        refillDuration = bucket_.refillDuration;
    }

    function _available(TokenBucket storage bucket_) private view returns (uint256 available) {
        (available, ) = _preview(bucket_);
    }

    function _preview(TokenBucket storage bucket_) private view returns (uint256 available, uint256 remainder) {
        available = bucket_.available;
        remainder = bucket_.remainder;
        uint256 now_ = block.timestamp;
        if (now_ <= bucket_.lastUpdated || available == bucket_.capacity) return (available, remainder);

        uint256 elapsed = now_ - bucket_.lastUpdated;
        uint256 duration = bucket_.refillDuration;
        uint256 added = Math.mulDiv(elapsed, bucket_.refillAmount, duration);
        uint256 fractional = mulmod(elapsed, bucket_.refillAmount, duration);
        uint256 combinedRemainder = fractional + remainder;
        if (combinedRemainder >= duration) {
            ++added;
            combinedRemainder -= duration;
        }

        uint256 room = uint256(bucket_.capacity) - available;
        if (added >= room) return (bucket_.capacity, 0);
        return (available + added, combinedRemainder);
    }
}
