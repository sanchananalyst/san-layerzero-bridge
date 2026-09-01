// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";

/// @dev TEST ONLY. Provides initial remote-side balances for local endpoint-mock
///      tests. This contract is not referenced by any deployment script.
contract OFTTestPeer is OFT {
    constructor(
        string memory name_,
        string memory symbol_,
        address endpoint_,
        address delegate_
    ) OFT(name_, symbol_, endpoint_, delegate_) Ownable(delegate_) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to_, uint256 amount_) external {
        _mint(to_, amount_);
    }
}
