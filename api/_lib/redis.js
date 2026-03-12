const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

function assertRedisConfigured() {
  if (!redisUrl || !redisToken) {
    throw new Error('Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
  }
}

function encodeArg(value) {
  return encodeURIComponent(String(value));
}

export async function redisCommand(command, ...args) {
  assertRedisConfigured();

  const response = await fetch(
    `${redisUrl}/${[command, ...args.map(encodeArg)].join('/')}`,
    {
      headers: {
        Authorization: `Bearer ${redisToken}`,
      },
    }
  );

  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw new Error(payload.error || `Redis command failed: ${command}`);
  }

  return payload.result;
}

export async function redisSetJson(key, value, ttlSeconds) {
  if (ttlSeconds) {
    await redisCommand('set', key, JSON.stringify(value), 'EX', ttlSeconds);
    return;
  }
  await redisCommand('set', key, JSON.stringify(value));
}

export async function redisGetJson(key) {
  const result = await redisCommand('get', key);
  if (!result) return null;
  return JSON.parse(result);
}

export async function redisHashGetAll(key) {
  const result = await redisCommand('hgetall', key);
  if (!Array.isArray(result)) return {};

  const output = {};
  for (let index = 0; index < result.length; index += 2) {
    output[result[index]] = result[index + 1];
  }
  return output;
}

export async function redisHashIncrement(key, field, amount) {
  return redisCommand('hincrby', key, field, amount);
}
