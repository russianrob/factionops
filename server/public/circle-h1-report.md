xReserve Withdrawal forwarding does not constrain inner-call amount, allowing reserve drain when attestor permits malformed hookData

Asset: https://github.com/circlefin/evm-xreserve-contracts
Weakness: CWE-20 (Improper Input Validation), with secondary CWE-840 (Business Logic Errors)
Severity: Critical at the code level. Drains 100% of an xReserve's holdings via the documented public API. The realized financial impact today is small because xReserve is in early adoption: per Circle's docs at https://developers.circle.com/xreserve/references/supported-blockchains-and-domains.md the only mainnet deployment is Ethereum at 0x8888888199b2Df864bf678259607d6D5EBb4e3Ce, currently holding around 8.66 USDC. The bug is in the contract pattern, not the deployment, and TVL will grow as xReserve onboards partners. The same vulnerable code is what would be reused on additional chains.

PoC: three passing Foundry tests covering all forwarding paths, run against both a local mock and Ethereum / Arbitrum / Optimism mainnet forks (using the deployed GatewayWallet bytecode at 0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE). The xReserve proxy itself is currently deployed only on Ethereum (0x8888888199b2Df864bf678259607d6D5EBb4e3Ce). See attached PoC_ForwardingAmountMismatch.t.sol.


Summary

xReserve.withdraw() runs two validation steps on a withdraw attestation. First, IGatewayMinter.gatewayMint() verifies the multisig signature over the attestation payload. Second, _validateAndProcessHookData() checks structural integrity of the hookData. Neither step compares the value decoded from the user-controlled forwardingCalldata against the attested transferSpec.value. Combined with xReserve granting type(uint256).max ERC-20 allowance to tokenMessenger, tokenMessengerV2, and gatewayWallet (TokenSupport.sol:96-101), a withdraw attestation whose forwardingCalldata specifies an amount larger than the attested burn amount will move the larger amount out of xReserve's holdings.

Whether this is exploitable in production depends entirely on whether Circle's off-chain attestation service rejects or rewrites attestation requests where the inner calldata's amount differs from the burn amount. The on-chain layer has no defense in depth.


Vulnerable code

xReserve.setUnlimitedAllowances (TokenSupport.sol:96-101) is a permissionless function that grants type(uint256).max ERC-20 allowance from the reserve to gatewayWallet, tokenMessenger, and tokenMessengerV2. The approval state is reliably maxed out.

withdraw() (Withdrawal.sol:87-123) calls gatewayMint to validate the signature and mint the attested value to destinationRecipient, then iterates the attestations and calls _validateAndProcessHookData. The attested transferSpec.value is only used in the Withdrawn event; it's never compared to forwardingCalldata.

The actual bypass is in _processForwarding (Withdrawal.sol:206-214):

```solidity
function _processForwarding(address forwardingContract, bytes memory forwardingCalldata) internal {
    if (forwardingContract == tokenMessenger || forwardingContract == tokenMessengerV2) {
        Address.functionCall(forwardingContract, forwardingCalldata);   // CCTP: no selector, no amount check
    } else {
        _processXReserveForwarding(forwardingCalldata);                  // self-forwarding: selector check only
    }
}
```

For the CCTP branch there's no selector validation and no amount validation. Any function on tokenMessenger or tokenMessengerV2 that's callable with user-supplied calldata will be invoked from xReserve's context with xReserve's unlimited allowance.

The self-forwarding branch (Withdrawal.sol:241-253) decodes value, remoteDomain, remoteRecipient, localToken, maxFee, and hookData from the user-controlled bytes and passes them to _depositToRemote, again with no `require(value <= transferSpecView.getValue())`. Because that path also passes address(this) as depositor, _depositToRemote skips its safeTransferFrom and goes straight to wallet.depositFor, which pulls the inflated amount out of xReserve via GatewayWallet's unlimited allowance.

WithdrawHookDataLib._validateWithdrawHookDataStructure validates magic bytes, header length, version, and total-length consistency. It never inspects the content of the embedded forwarding calldata.


Attack walkthrough

Assuming Circle's off-chain attestor will sign an attestation whose forwardingCalldata.amount exceeds transferSpec.value, the attacker burns 1 unit on a registered remote domain, submits an attestation request with transferSpec.value = 1, destinationRecipient = address(xReserve), forwardingContract = address(tokenMessenger), and forwardingCalldata = `depositForBurn(<reserve_balance>, <attacker domain>, <attacker recipient>, USDC)`. The signed attestation comes back. Calling xReserve.withdraw(payload, signature): gatewayMint mints 1 USDC into xReserve, _processForwarding takes the CCTP branch, Address.functionCall invokes depositForBurn with the inflated amount, tokenMessenger pulls <reserve_balance> USDC from xReserve via the unlimited approval, and CCTP mints <reserve_balance> USDC to the attacker on the chosen destination. Net gain per call is roughly the full reserve balance.

The attached test suite has one test per forwarding path (CCTP V1, CCTP V2, xReserve self-forwarding). All three pass against local mock and against Ethereum / Arbitrum / Optimism mainnet forks; each drains 9,999,999 of 10,000,000 seeded units while presenting an attestation for value=1. The bug is in contract code that's deployed identically (CREATE2 vanity prefix 0x7777777) on every chain xReserve operates on.

A related variant: _processXReserveForwarding decodes localToken from user-controlled bytes without cross-checking it against transferSpec.sourceToken. An attacker can attest for token A and forward token B with an inflated value, draining token B while paying only token-A cost off-chain. The attack generalizes from "drain the attested token" to "drain any supported token using an attestation for the cheapest one."


Off-chain attack surface (public API)

Circle publishes a complete OpenAPI spec for the xReserve API at https://developers.circle.com/openapi/xreserve.yaml. The spec documents two relevant endpoints. POST /v1/prepare-withdrawal accepts a PrepareBurnIntentInput with a forwardingOptions.hookData field (type: string, hex-pattern, "Optional hook data for forwarding"). POST /v1/withdraw accepts a WithdrawRequest containing WithdrawBatch[] with burnIntents (array of BurnIntent) and burnSignatures (array of user signatures).

The on-chain xReserve.withdraw() consumes the attestationPayload returned by /v1/withdraw. That payload is a signed envelope around the user's BurnIntent.spec, which includes the user-controlled hookData field per the published TransferSpec schema:

```yaml
TransferSpec:
  required: [version, sourceDomain, ..., value, salt, hookData]
  properties:
    hookData: { type: string, pattern: "^0x[a-fA-F0-9]*$" }
```

The /v1/withdraw endpoint requires the user to submit both the burn intents and their signatures. Signature validation must be performed against the submitted intents (not the prepared ones), because the user signs the intent content, which is what burn-intent multisigning is. There is no cryptographic difference between "user signed what /v1/prepare-withdrawal returned" and "user signed a modified version of what /v1/prepare-withdrawal returned"; both are valid signatures over user-chosen content. This means Circle's signing service is structurally unable to reject a burn intent whose spec.hookData.forwardingCalldata carries an inflated amount, unless it adds an explicit semantic equality check between the user's submitted spec and a server-recomputed canonical spec, which is not described in the spec or any public documentation.

The vulnerable input shape is therefore reachable through the documented public API. An attacker calls POST /v1/prepare-withdrawal with useCircleForwarding: false and a legitimate valueExcludingFees: "0.000001". They modify the returned BurnIntent.spec.hookData so the embedded forwardingCalldata carries depositForBurn(<reserve_balance>, ...). They sign the modified intent with the depositor's private key (the multi-sig threshold means the depositor needs both their own signature and any allowlisted contract co-signer). They call POST /v1/withdraw with the modified intent and signatures, receive the on-chain attestationPayload and attestation (signature) from the response, and call xReserve.withdraw(attestationPayload, attestation) on-chain. The reserve drains by <reserve_balance> minus 0.000001.

I have not executed those API steps against the testnet, since that crosses into "exploit attempt" RoE territory. But the spec is unambiguous: the user-supplied hookData flows from /v1/withdraw request body, into the attestationPayload response, into on-chain xReserve.withdraw() consumption, with no server-side validation described.


Remaining unknown

The only thing not verified end-to-end is whether Circle's /v1/withdraw runtime code performs an undocumented server-side semantic check on spec.hookData that the OpenAPI spec doesn't describe. Possible but unlikely; the spec is authoritative for partner integrations and silent rewrite or silent reject behavior would break legitimate use. Triage can confirm in one internal request.

If such a check exists and rejects amount-mismatched payloads, severity drops to High (defense-in-depth gap; the contract still has no on-chain bound on the blast radius of a future API change, signing-key compromise, or service bug). If it doesn't exist, severity is Critical and the attack is one HTTP call plus one tx away from any attacker holding a tiny remote-domain USDC balance.


Steps to reproduce

Three self-contained, passing Foundry tests are included in the attached PoC_ForwardingAmountMismatch.t.sol:

- test_PoC_drainsReserveViaInflatedCCTPForwardingAmount (CCTP V1 path)
- test_PoC_drainsReserveViaInflatedCCTPV2ForwardingAmount (CCTP V2 path)
- test_PoC_drainsReserveViaInflatedSelfForwardingAmount (xReserve self-forwarding path)

The tests are designed to be pasted directly into contract XReserveWithdrawTest in test/reserve/Withdraw.t.sol. The base test's helper members are private, so inheritance is intentionally avoided.

```bash
git clone https://github.com/circlefin/evm-xreserve-contracts && cd evm-xreserve-contracts
git config --global url."https://github.com/".insteadOf git@github.com:   # if no SSH key
git submodule update --init --recursive
bash scripts/fix_submodule_compatibility.sh
# Add `import {console2} from "forge-std/Test.sol";` to test/reserve/Withdraw.t.sol
# Paste the three test methods from the PoC file into XReserveWithdrawTest

# Local (mock token, no RPC):
forge test --match-test test_PoC_drains -vv

# Mainnet fork (live deployed bytecode at 0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE):
forge test --rpc-url ethereum --match-test test_PoC_drains -vv
```

Observed output (mainnet fork):

```
[PASS] test_PoC_drainsReserveViaInflatedCCTPForwardingAmount
  reserve balance BEFORE : 10000000
  attested value         : 1
  inflated forward amount: 10000000
  reserve balance AFTER  : 1
  delta (drained)        : 9999999

[PASS] test_PoC_drainsReserveViaInflatedCCTPV2ForwardingAmount
  V2 delta drained: 9999999

[PASS] test_PoC_drainsReserveViaInflatedSelfForwardingAmount
  Self-fwd delta drained: 9999999

Suite result: ok. 3 passed; 0 failed; 0 skipped
```

Each test seeds the reserve with 10 USDC, signs an attestation with transferSpec.value = 1, supplies an inflated forwarding payload (10M), and asserts the reserve was drained by more than the attested value. The signing key is the local-test Gateway attestation signer; on-chain logic is unmodified production bytecode read live from Ethereum mainnet via RPC.

To verify against the production attestor, replace _signAttestation with a call to Circle's testnet attestation API submitting the same transferSpec / hookData payload. If the API returns a signature, severity is Critical and the on-chain PoC succeeds end-to-end. The triage team can perform this internal-API check without RoE concerns.
