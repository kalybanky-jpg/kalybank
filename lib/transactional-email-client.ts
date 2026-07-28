export async function dispatchTransactionalEmails(): Promise<void> {
  try {
    await fetch('/api/transactional-email/dispatch', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
  } catch {
    // The workflow state is already committed. The outbox remains available
    // for a later retry when the provider or network becomes available.
  }
}
