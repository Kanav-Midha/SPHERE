import { createPublicServerClient, sendJson } from '../_lib/supabase.js';
import { redisGetJson, redisHashIncrement, redisSetJson } from '../_lib/redis.js';
import { normalizeTicketHash, parseTicketQrPayload } from '../_lib/tickets.js';

async function resolveOperatorEvent(supabase, operatorKey) {
  const cacheKey = `sphere:operator:${operatorKey.toUpperCase()}`;
  const cached = await redisGetJson(cacheKey).catch(() => null);
  if (cached) return cached;

  const { data, error } = await supabase.rpc('verify_event_operator_key', {
    input_key: operatorKey,
  });

  const eventData = (data || [])[0];
  if (error || !eventData) {
    throw new Error(error?.message || 'Invalid operator key');
  }

  const normalized = {
    eventId: eventData.event_id,
    title: eventData.title,
    venue: eventData.venue || '',
    eventDate: eventData.event_date,
  };

  await redisSetJson(cacheKey, normalized, 60 * 60 * 12).catch(() => null);
  return normalized;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const operatorKey = String(body.operatorKey || '').trim().toUpperCase();
    const rawCode = String(body.code || '').trim();

    if (!operatorKey || !rawCode) {
      return sendJson(res, 400, { error: 'operatorKey and code are required' });
    }

    const supabase = createPublicServerClient();
    const operatorEvent = await resolveOperatorEvent(supabase, operatorKey);

    const parsedPayload = parseTicketQrPayload(rawCode);
    const ticketHash = normalizeTicketHash(parsedPayload?.ticketHash || rawCode);

    if (parsedPayload?.eventId && parsedPayload.eventId !== operatorEvent.eventId) {
      await redisHashIncrement(`sphere:metrics:${operatorEvent.eventId}`, 'total', 1).catch(() => null);
      await redisHashIncrement(`sphere:metrics:${operatorEvent.eventId}`, 'invalid', 1).catch(() => null);
      return sendJson(res, 200, {
        scan_status: 'invalid',
        event_id: operatorEvent.eventId,
        event_title: operatorEvent.title,
        ticket_hash: ticketHash,
        message: 'QR belongs to a different event.',
      });
    }

    const cachedTicket = await redisGetJson(`sphere:ticket:${ticketHash}`).catch(() => null);
    if (cachedTicket?.eventId && cachedTicket.eventId !== operatorEvent.eventId) {
      await redisHashIncrement(`sphere:metrics:${operatorEvent.eventId}`, 'total', 1).catch(() => null);
      await redisHashIncrement(`sphere:metrics:${operatorEvent.eventId}`, 'invalid', 1).catch(() => null);
      return sendJson(res, 200, {
        scan_status: 'invalid',
        event_id: operatorEvent.eventId,
        event_title: operatorEvent.title,
        ticket_hash: ticketHash,
        message: 'Ticket hash exists but is not valid for this event.',
      });
    }

    const { data, error } = await supabase.rpc('process_event_scan', {
      input_key: operatorKey,
      input_hash: ticketHash,
    });

    const result = (data || [])[0];
    if (error || !result) {
      return sendJson(res, 400, { error: error?.message || 'Scan validation failed' });
    }

    const status = result.scan_status || 'invalid';
    const metricsKey = `sphere:metrics:${operatorEvent.eventId}`;
    await redisHashIncrement(metricsKey, 'total', 1).catch(() => null);
    await redisHashIncrement(metricsKey, status, 1).catch(() => null);

    if (cachedTicket) {
      await redisSetJson(
        `sphere:ticket:${ticketHash}`,
        {
          ...cachedTicket,
          status: status === 'valid' ? 'used' : cachedTicket.status,
          lastScanStatus: status,
          scannedAt: result.scanned_at,
        },
        60 * 60 * 24 * 30
      ).catch(() => null);
    }

    return sendJson(res, 200, {
      ...result,
      ticket_hash: ticketHash,
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Scan request failed',
    });
  }
}
