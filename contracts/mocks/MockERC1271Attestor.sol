// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract MockERC1271Attestor is IERC1271 {
    address public immutable signer;

    constructor(address signerAddress) {
        signer = signerAddress;
    }

    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) external view override returns (bytes4) {
        return
            ECDSA.recover(hash, signature) == signer
                ? IERC1271.isValidSignature.selector
                : bytes4(0xffffffff);
    }
}
