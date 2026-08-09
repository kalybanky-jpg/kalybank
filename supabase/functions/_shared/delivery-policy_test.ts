import {
  areAllDeliveryChannelsTerminal,
  classifyDeliveryHttpStatus,
  isTerminalDeliveryDisposition,
} from "./delivery-policy.ts";

Deno.test("delivery policy retries only transient HTTP failures", () => {
  for (const status of [408, 429, 500, 502, 503]) {
    if (classifyDeliveryHttpStatus(status) !== "retryable_failure") {
      throw new Error(`${status} must remain retryable`);
    }
  }
});

Deno.test("delivery policy terminalizes permanent 4xx failures", () => {
  for (const status of [400, 401, 403, 404, 409, 410, 422]) {
    if (classifyDeliveryHttpStatus(status) !== "permanent_failure") {
      throw new Error(`${status} must be terminal`);
    }
  }
});

Deno.test("delivery policy accepts success and retries redirects", () => {
  if (classifyDeliveryHttpStatus(202) !== "delivered") {
    throw new Error("2xx must be delivered");
  }
  if (classifyDeliveryHttpStatus(307) !== "retryable_failure") {
    throw new Error("unexpected redirects must not become terminal failures");
  }
});

Deno.test("a permanent failure on one channel does not block the other", () => {
  const permanentEmail = isTerminalDeliveryDisposition(
    classifyDeliveryHttpStatus(422),
  );
  const deliveredPush = isTerminalDeliveryDisposition(
    classifyDeliveryHttpStatus(201),
  );
  if (!areAllDeliveryChannelsTerminal(permanentEmail, deliveredPush)) {
    throw new Error("two terminal channel outcomes must complete the job");
  }
  if (areAllDeliveryChannelsTerminal(false, deliveredPush)) {
    throw new Error("a retryable channel must keep the job incomplete");
  }
});
