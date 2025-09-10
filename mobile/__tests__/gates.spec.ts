import { describe, it, expect } from 'vitest';
import { isSubmitDisabled } from '../src/logic/gates';

describe('isSubmitDisabled', () => {
  const base = { submitting: false, checkInTs: null as string | null, timelyNotes: '', ack: false };

  it('disables when not checked in', () => {
    const res = isSubmitDisabled({ ...base, checkInTs: null });
    expect(res).toBe(true);
  });

  it('enabled after check-in with no notes', () => {
    const res = isSubmitDisabled({ ...base, checkInTs: '2025-01-01T00:00:00Z' });
    expect(res).toBe(false);
  });

  it('disables when notes present but not acknowledged', () => {
    const res = isSubmitDisabled({ ...base, checkInTs: '2025-01-01T00:00:00Z', timelyNotes: 'urgent', ack: false });
    expect(res).toBe(true);
  });

  it('enabled when notes present and acknowledged', () => {
    const res = isSubmitDisabled({ ...base, checkInTs: '2025-01-01T00:00:00Z', timelyNotes: 'urgent', ack: true });
    expect(res).toBe(false);
  });

  it('disables while submitting', () => {
    const res = isSubmitDisabled({ ...base, submitting: true, checkInTs: '2025-01-01T00:00:00Z' });
    expect(res).toBe(true);
  });
});

