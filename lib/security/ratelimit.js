// lib/security/ratelimit.js — Rate limiting via Upstash Redis
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const LIMITS = { messages_per_hour: 60, messages_per_day: 300, otp_per_hour: 3 };

async function redisCmd(...args) {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  const res = await fetch(`${REDIS_URL}/${args.join('/')}`, { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } });
  const data = await res.json();
  return data.result;
}

export async function checkRateLimit(phone) {
  if (!REDIS_URL) return { allowed: true };
  const now = Math.floor(Date.now() / 1000);
  const keyHour = `rl:msg:h:${phone}:${Math.floor(now / 3600)}`;
  const keyDay  = `rl:msg:d:${phone}:${Math.floor(now / 86400)}`;
  const [countHour, countDay] = await Promise.all([redisCmd('INCR', keyHour), redisCmd('INCR', keyDay)]);
  if (countHour === 1) await redisCmd('EXPIRE', keyHour, '3600');
  if (countDay  === 1) await redisCmd('EXPIRE', keyDay,  '86400');
  if (countHour > LIMITS.messages_per_hour) return { allowed: false, reason: 'hourly_limit' };
  if (countDay  > LIMITS.messages_per_day)  return { allowed: false, reason: 'daily_limit' };
  return { allowed: true };
}

export async function checkOTPRateLimit(phone) {
  if (!REDIS_URL) return { allowed: true };
  const key = `rl:otp:${phone}:${Math.floor(Date.now() / 3600000)}`;
  const count = await redisCmd('INCR', key);
  if (count === 1) await redisCmd('EXPIRE', key, '3600');
  return { allowed: count <= LIMITS.otp_per_hour };
}

export async function blockPhone(phone, hours = 24) {
  if (!REDIS_URL) return;
  await redisCmd('SET', `blocked:${phone}`, '1', 'EX', String(hours * 3600));
}

export async function isBlocked(phone) {
  if (!REDIS_URL) return false;
  return await redisCmd('GET', `blocked:${phone}`) === '1';
}
