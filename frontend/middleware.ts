export const config = {
  matcher: ['/((?!api/verify-pin|pin\\.html|favicon\\.ico|assets/).*)'],
}

// verify ว่า cookie value ตรงกับ HMAC-SHA256 ของ secret จริง
async function verifyToken(token: string, secret: string): Promise<boolean> {
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

export default async function middleware(request: Request) {
  const cookie = request.headers.get('cookie') ?? ''
  const token  = cookie.split(';')
    .find(c => c.trim().startsWith('pin_ok='))
    ?.split('=')[1]
    ?.trim()

  const secret = process.env.COOKIE_SECRET
  if (secret && token && await verifyToken(token, secret)) {
    return // ผ่าน
  }

  return Response.redirect(new URL('/pin.html', request.url), 302)
}
