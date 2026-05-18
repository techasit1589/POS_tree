export const config = { runtime: 'edge' }

// ── Rate limiting (in-memory per Edge worker instance) ──────────────────────
// ป้องกัน brute-force: ล็อก IP หลังพิมพ์ผิด 5 ครั้งภายใน 15 นาที
const RATE_LIMIT = 5
const WINDOW_MS  = 15 * 60 * 1000

const attempts = new Map<string, { count: number; resetAt: number }>()

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = attempts.get(ip)

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true }
  }
  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  entry.count++
  return { allowed: true }
}

function clearRateLimit(ip: string) {
  attempts.delete(ip)
}

// ── HMAC-SHA256 cookie signing ───────────────────────────────────────────────
// ป้องกัน DevTools forgery: cookie value เป็น signature ที่ verify ได้เฉพาะฝั่ง server
async function signToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode('pin_ok'),
  )
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // 1. Rate limit check
  const ip = getClientIp(req)
  const rateCheck = checkRateLimit(ip)
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ ok: false, locked: true, retryAfter: rateCheck.retryAfter }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfter),
        },
      },
    )
  }

  // 2. Parse body
  let pin: string
  try {
    const body = await req.json()
    pin = String(body.pin ?? '')
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 3. Verify PIN
  const correct = process.env.APP_PIN
  const secret  = process.env.COOKIE_SECRET
  if (!correct || !secret) {
    // env ไม่ถูกตั้งบน Vercel — log ออกมาให้แอดมินเห็น แล้วคืน 500
    // ห้ามรวมเข้ากับ "PIN ผิด" เพราะแอดมินจะหาไม่เจอว่าทำไมล็อกอินไม่ได้
    console.error('[verify-pin] missing env vars: APP_PIN or COOKIE_SECRET')
    return new Response(JSON.stringify({ ok: false, error: 'config' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (pin !== correct) {
    return new Response(JSON.stringify({ ok: false }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 4. PIN ถูก — reset rate limit + ออก signed cookie
  clearRateLimit(ip)
  const token = await signToken(secret)

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `pin_ok=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`,
    },
  })
}
