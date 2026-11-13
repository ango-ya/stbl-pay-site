---
title: Refunds from merchant servers
sidebar_label: Refunds from merchant servers
---

# Refunds from merchant servers

This is a draft specification for preview review. It does not announce production availability. Availability will be updated after advance sharing with JPYC EX.

## Registration and approval

Generate a P-256 key inside the merchant server, using Node.js `generateKeyPairSync('ec', { namedCurve: 'prime256v1' })`, for example. Keep the private key in the merchant's secret store or KMS/HSM. Never send it to STBL Pay. Register the uncompressed public key `0x04 || X || Y` in the store detail's merchant server refunds section (Setup for online stores, Settings for in-person QR stores). The owner approves a delegation with a passkey, binding the public key, refund-only permission, per-refund cap, wallet, epoch and chainId. There are at most 10 non-revoked members per store, including pending members. An omitted cap means unlimited; `"0"` disables refunds. The `stblpay_machine_` key followed by 43 base64url characters is displayed only at issuance or rotation. Payment API keys cannot be substituted.

Each refund requires both the machine signature and STBL Pay’s co-signature. STBL Pay can refuse to co-sign after its checks, but cannot transfer funds without the machine signature.

## API flow

Attach an [HTTP signature](/refunds/signing) to each request. `amountJpy` is a decimal string in yen, with up to six decimal places. Avoid floating-point conversion.

1. Check `GET /payment_intents/{paymentIntentId}/refundable` for executable amount and blockers.
2. Send `{"amountJpy":"100"}` to `POST /payment_intents/{paymentIntentId}/refunds/prepare`.
3. Sign the returned `challenge` and `rpId`. Send `stagedOpId` and `assertion` to `POST /payment_intents/{paymentIntentId}/refunds/submit`.
4. Save the accepted `refundId`. Query `GET /refunds/{refundId}` or `GET /payment_intents/{paymentIntentId}/refunds`. Acceptance is not completion and carries no transaction hash.

The recipient is fixed to the original payer and is omitted from prepare. The owner and all machines share one serial operation slot per merchant wallet, including operations from other stores and redemption. Other stores' resources return 404. Accepted refunds within the same store are readable; unconsumed preparations are visible and cancelable only by their machine.

## Recovery

- Lost prepare response: inspect `ownStaged`, which can refer to another payment prepared by the same machine. Cancel it with `DELETE /staged_operations/{stagedOpId}` before preparing again.
- Lost submit response: resend the same stagedOpId and assertion with a fresh HTTP nonce, timestamp and signature. Do not prepare a new refund.
- Missing Webhook: reconcile by query. `refund.confirmed` means completion; `refund.failed` means failure. The original payment stays `settled`.
- HTTP419 `auth/clock_skew`: adjust the clock offset using `details.serverTime` (epoch milliseconds) in the response and retry once with a fresh nonce, timestamp and HTTP signature. Investigate persistent clock errors.

## Funds and revocation

`refundableNowJpy` is constrained by the ledger, on-chain backing and wallet balance. `executableJpy` is the minimum of that amount and `delegationCapJpy`, or `"0"` when blocked. Unavailable observations are not estimated. See [refund funds](/refunds/funding). Store and payment restrictions are backend checks; the contract does not identify stores or payments.

Revocation, cap replacement and API key rotation prevent new acceptance. **They do not guarantee cancellation of already accepted operations.** On-chain revocation of old delegations is follow-up work (#677). Delegation does not permit redemption, arbitrary recipients, wallet upgrades or human staff access. A disabled store rejects new prepare/submit requests while allowing queries, cancellation of the machine's own preparation, and owner revocation/key rotation.
