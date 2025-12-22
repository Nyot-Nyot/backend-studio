// Minimal emailService stub used by ScenarioService
export const generateSMTPTrace = (to: string) => {
  return [{ at: Date.now(), note: `queued to ${to}` }];
};

export const scheduleStatusUpdate = (messageId: string, cb: (id: string, status: string) => Promise<void> | void) => {
  // Simulate a delivery timeline: queued -> sent
  setTimeout(async () => {
    await Promise.resolve(cb(messageId, 'sent'));
  }, 50);
};
