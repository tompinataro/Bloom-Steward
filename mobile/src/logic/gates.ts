export function isSubmitDisabled(opts: {
  submitting: boolean;
  checkInTs: string | null;
  timelyNotes: string;
  ack: boolean;
}): boolean {
  const { submitting, checkInTs, timelyNotes, ack } = opts;
  const hasNotes = (timelyNotes?.trim()?.length || 0) > 0;
  return submitting || !checkInTs || (hasNotes && !ack);
}

