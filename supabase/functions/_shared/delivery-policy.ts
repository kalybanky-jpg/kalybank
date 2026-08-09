export type DeliveryDisposition =
  | "delivered"
  | "permanent_failure"
  | "retryable_failure";

export function classifyDeliveryHttpStatus(
  status: number,
): DeliveryDisposition {
  if (status >= 200 && status < 300) return "delivered";
  if (status === 408 || status === 429 || status >= 500) {
    return "retryable_failure";
  }
  if (status >= 400 && status < 500) return "permanent_failure";
  return "retryable_failure";
}

export function isTerminalDeliveryDisposition(
  disposition: DeliveryDisposition,
) {
  return disposition !== "retryable_failure";
}

export function areAllDeliveryChannelsTerminal(
  emailTerminal: boolean,
  pushTerminal: boolean,
) {
  return emailTerminal && pushTerminal;
}
