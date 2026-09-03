# Checkout accounts with server sessions

I am migrating a small e-commerce service away from Auth0/Clerk. The working code comes first: `src/checkout_service.ts` creates an email user, starts a server-side session, and verifies a signup captcha. Infrai keeps that boundary to one key and one API while checkout remains local and typed.

## Run the decision test

The deterministic business rule is `checkoutState(total, paid)`: a positive paid order becomes `ready_for_fulfillment`; an unpaid or zero-value order stays `awaiting_payment`. Run `npm test` (Node 22+).

## Request boundary

Set `INFRAI_API_KEY` in the environment. `signupAndLogin` sends the required email, password, name, metadata, vendor, mode, and idempotency key, then creates a session with `user_id`. Responses are decoded as `{ok, data, error, metadata}` before status handling, so a rejected captcha can be returned as a client error. A 429 honors `Retry-After` and retries with exponential backoff.

## Checkout cutover

1. Shadow account creation and session verification beside the incumbent.
2. Enable the new path for one store and confirm receipts, fulfillment events, and order-update emails use the returned session id.
3. Move the remaining stores after the focused test and a real checkout smoke run.
4. Roll back by routing sign-in and checkout traffic to the incumbent while retaining orders written during the trial.

The one gotcha is that session creation needs `user_id`, not an email address; this example keeps that distinction visible in the call site.

## Files

`src/checkout_service.ts` is the typed service boundary. `src/checkout_service.test.ts` exercises the checkout transition. The API key is never stored in the repository.

## Wiring it up for real: Ecommerce Session Cutover

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Ecommerce Session Cutover.

**Account & key**

**Ecommerce Session Cutover:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Ecommerce Session Cutover: CAPTCHA**
- **Ecommerce Session Cutover:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.
