const crypto = require("crypto");

// The contract every PaymentProvider must implement:
//
//   charge({ amount, currency, requestedResult }) -> Promise<{
//     status: "success" | "failed",
//     providerReference: string,
//     failureReason: string | null,
//   }>
//
// This is the one seam meant to change when a real gateway is integrated.
// A future RazorpayPaymentProvider would implement this exact same function
// signature — calling Razorpay's actual API instead of returning a canned
// result — and payment.service.js would only need its one `require(...)`
// line changed to point at it. Nothing about the Payment model, the state
// machine, the controller, the routes, or the Kafka/Socket.IO wiring would
// need to change. That's the point of programming against an abstraction
// instead of coupling the whole payment flow to one specific provider.
//
// `requestedResult` exists only because this is a *simulator*, not a real
// gateway: there is no external system to actually ask, so the caller
// supplies which branch of the simulation to exercise (mirroring how real
// payment gateways offer test-mode cards/tokens that deterministically
// succeed or fail, for exactly this reason — testing both outcomes without
// moving real money). It is not the client dictating financial truth: the
// value is constrained to exactly two legal outcomes, still flows through
// payment.service.js's ownership/state-machine/idempotency checks before
// ever reaching here, and a real provider integration would ignore this
// field entirely in favor of its own API's actual response.
async function charge({ requestedResult }) {
  const providerReference = `SIM-${crypto.randomUUID()}`;

  if (requestedResult === "failure") {
    return {
      status: "failed",
      providerReference,
      failureReason: "Simulated payment provider declined the payment",
    };
  }

  return {
    status: "success",
    providerReference,
    failureReason: null,
  };
}

module.exports = { charge };
