export function buildTicketQrPayload(eventId, ticketHash) {
  return `SPHERE|1|${eventId}|${String(ticketHash).toUpperCase()}`;
}

export function parseTicketQrPayload(rawValue) {
  const compact = String(rawValue || '').trim().split('|');
  if (compact.length === 4 && compact[0] === 'SPHERE' && compact[1] === '1') {
    return {
      eventId: compact[2],
      ticketHash: compact[3].toUpperCase(),
    };
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (
      parsed?.kind === 'sphere-ticket' &&
      parsed?.version === 1 &&
      typeof parsed.eventId === 'string' &&
      typeof parsed.ticketHash === 'string'
    ) {
      return {
        eventId: parsed.eventId,
        ticketHash: parsed.ticketHash.toUpperCase(),
      };
    }
  } catch {
    // Not a JSON payload, will be treated as a plain hash.
  }

  return null;
}

export function normalizeTicketHash(rawValue) {
  return String(rawValue || '').trim().toUpperCase();
}
