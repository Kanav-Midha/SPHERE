export interface TicketQrPayload {
  kind: 'sphere-ticket';
  version: 1;
  eventId: string;
  ticketHash: string;
}

export function buildTicketQrPayload(eventId: string, ticketHash: string): string {
  return `SPHERE|1|${eventId}|${ticketHash.toUpperCase()}`;
}

export function parseTicketQrPayload(value: string): TicketQrPayload | null {
  const compact = value.trim().split('|');
  if (compact.length === 4 && compact[0] === 'SPHERE' && compact[1] === '1') {
    return {
      kind: 'sphere-ticket',
      version: 1,
      eventId: compact[2],
      ticketHash: compact[3].toUpperCase(),
    };
  }

  try {
    const parsed = JSON.parse(value) as Partial<TicketQrPayload>;
    if (
      parsed.kind === 'sphere-ticket' &&
      parsed.version === 1 &&
      typeof parsed.eventId === 'string' &&
      typeof parsed.ticketHash === 'string'
    ) {
      return {
        kind: 'sphere-ticket',
        version: 1,
        eventId: parsed.eventId,
        ticketHash: parsed.ticketHash.toUpperCase(),
      };
    }
  } catch {
    // Ignore non-JSON QR payloads and allow hash fallback.
  }

  return null;
}

export function normalizeTicketHash(value: string): string {
  return value.trim().toUpperCase();
}
