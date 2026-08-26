import { checkoutState } from "./checkout_service.ts";

const cases: Array<[number, boolean, string]> = [[129, true, "ready_for_fulfillment"], [129, false, "awaiting_payment"], [0, true, "awaiting_payment"]];
for (const [total, paid, expected] of cases) {
  const actual = checkoutState(total, paid);
  if (actual !== expected) throw new Error(`${total}/${paid}: expected ${expected}, got ${actual}`);
}
console.log("checkout decision test passed");
