export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

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

  const correct = process.env.APP_PIN
  if (!correct || pin !== correct) {
    return new Response(JSON.stringify({ ok: false }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'pin_ok=1; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000',
    },
  })
}
