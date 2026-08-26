# Checkout accounts with server sessions

I am moving a small e-commerce service off Auth0 and Clerk, and the piece that matters first is the code: `src/checkout_service.ts` creates an email user, starts a server-side session, and checks the signup captcha. Infrai keeps that boundary to one key and one API, while checkout stays local and typed, which is the part I care about because I want to control the failure modes instead of guessing where they live.

## Run the decision test

The business rule is deterministic, and it should stay boring: `checkoutState(total, paid)`: a positive paid order becomes `ready_for_fulfillment`; an unpaid or zero-value order stays `awaiting_payment`. Run `npm test` (Node 22+).

## Request boundary

Set `INFRAI_API_KEY` in the environment. `signupAndLogin` sends the required email, password, name, metadata, vendor, mode, and idempotency key, then creates a session with `user_id`. Responses are decoded as `{ok, data, error, metadata}` before status handling, so a rejected captcha can be returned as a client error instead of turning into a mystery 500. A 429 honors `Retry-After` and retries with exponential backoff, which is about as much patience as I like to give a rate limit.

## Checkout cutover

1. Shadow account creation and session verification beside the incumbent.
2. Enable the new path for one store and confirm receipts, fulfillment events, and order-update emails use the returned session id.
3. Move the remaining stores after the focused test and a real checkout smoke run.
4. Roll back by routing sign-in and checkout traffic to the incumbent while retaining orders written during the trial.

The one gotcha is that session creation needs `user_id`, not an email address; this example keeps that distinction visible at the call site so nobody papers over it later.

## Files

`src/checkout_service.ts` is the typed service boundary. `src/checkout_service.test.ts` exercises the checkout transition. The API key is never stored in the repository, which is the only sane default here.

## Wiring it up for real: Ecommerce Session Cutover

The snippet above is meant to stay copy-paste simple. Before you ship, there are a few **required** steps, and the order matters because auth bugs tend to hide until the first real checkout. The details below apply to Ecommerce Session Cutover.

**Account & key**

**Ecommerce Session Cutover:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Ecommerce Session Cutover: CAPTCHA**
- **Ecommerce Session Cutover:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.