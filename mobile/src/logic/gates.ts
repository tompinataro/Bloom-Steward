export function isSubmitDisabled(opts: {
  submitting: boolean;
  checkInTs: string | null;
  requiresAck: boolean;
  ack: boolean;
}): boolean {
  const { submitting, checkInTs, requiresAck, ack } = opts;
  return submitting || !checkInTs || (requiresAck && !ack);
}
