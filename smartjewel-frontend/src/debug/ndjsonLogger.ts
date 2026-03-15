export function debugLog(payload: Record<string, unknown>) {
  try {
    // Keep it dependency-free and safe; do not log secrets/PII
    // @ts-expect-error - window may exist in browser env
    const w = typeof window !== 'undefined' ? window : undefined;
    if (!w) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (w as any).__SMARTJEWEL_DEBUG_LOGS__ = (w as any).__SMARTJEWEL_DEBUG_LOGS__ || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (w as any).__SMARTJEWEL_DEBUG_LOGS__.push(payload);
  } catch {
    // ignore
  }
}

