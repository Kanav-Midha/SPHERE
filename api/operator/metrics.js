import { createPublicServerClient, sendJson } from '../_lib/supabase.js';
import { redisHashGetAll, redisSetJson } from '../_lib/redis.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const operatorKey = String(req.query.operatorKey || '').trim().toUpperCase();
    if (!operatorKey) {
      return sendJson(res, 400, { error: 'operatorKey is required' });
    }

    const supabase = createPublicServerClient();
    const { data: operatorData, error: operatorError } = await supabase.rpc('verify_event_operator_key', {
      input_key: operatorKey,
    });

    const operatorEvent = (operatorData || [])[0];
    if (operatorError || !operatorEvent) {
      return sendJson(res, 400, { error: operatorError?.message || 'Invalid operator key' });
    }

    await redisSetJson(`sphere:operator:${operatorKey}`, {
      eventId: operatorEvent.event_id,
      title: operatorEvent.title,
      venue: operatorEvent.venue || '',
      eventDate: operatorEvent.event_date,
    }, 60 * 60 * 12).catch(() => null);

    const cached = await redisHashGetAll(`sphere:metrics:${operatorEvent.event_id}`).catch(() => ({}));
    const { data: metricsData } = await supabase.rpc('get_operator_scan_metrics', {
      input_key: operatorKey,
    });
    const live = (metricsData || [])[0] || {};

    const cachedTotal = Number(cached.total || 0);
    const cachedValid = Number(cached.valid || 0);
    const cachedInvalid = Number(cached.invalid || 0);
    const cachedAlreadyScanned = Number(cached.already_scanned || 0);
    const liveTotal = Number(live.total_scans || 0);
    const liveValid = Number(live.valid_scans || 0);
    const liveInvalid = Number(live.invalid_scans || 0);
    const liveAlreadyScanned = Number(live.already_scanned_scans || 0);

    return sendJson(res, 200, {
      event_id: operatorEvent.event_id,
      event_title: operatorEvent.title,
      total_scans: Math.max(cachedTotal, liveTotal),
      valid_scans: Math.max(cachedValid, liveValid),
      invalid_scans: Math.max(cachedInvalid, liveInvalid),
      already_scanned_scans: Math.max(cachedAlreadyScanned, liveAlreadyScanned),
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Metrics request failed',
    });
  }
}
