export const config = { runtime: 'edge' }

async function verifyCookieToken(token: string, secret: string): Promise<boolean> {
  try {
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
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
    return token === expected
  } catch {
    return false
  }
}

async function signEdgeToken(secret: string, expiresAt: number): Promise<string> {
  const payload = `create-order:${expiresAt}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return `${expiresAt}.${signature}`
}

function edgeTokenExpiresAt(): number {
  return Date.now() + 12 * 60 * 60 * 1000 // 12 hours
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const cookie = req.headers.get('cookie') ?? ''
  const raw = cookie.split(';').find(c => c.trim().startsWith('pin_ok='))
  const token = raw ? raw.trim().slice('pin_ok='.length) : undefined

  const secret = process.env.COOKIE_SECRET
  const edgeSecret = process.env.POS_EDGE_TOKEN_SECRET

  if (!secret || !edgeSecret) {
    console.error('[edge-token] missing env vars: COOKIE_SECRET or POS_EDGE_TOKEN_SECRET')
    return new Response(JSON.stringify({ ok: false, error: 'config' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!token || !(await verifyCookieToken(token, secret))) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const edgeExpiresAt = edgeTokenExpiresAt()
  const edgeToken = await signEdgeToken(edgeSecret, edgeExpiresAt)

  return new Response(JSON.stringify({ ok: true, edgeToken, edgeExpiresAt }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
