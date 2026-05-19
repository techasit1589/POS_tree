import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pos-edge-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

async function isValidToken(token: string | null, secret: string): Promise<boolean> {
  if (!token) return false
  const [rawExpiresAt, signature] = token.split('.')
  const expiresAt = Number(rawExpiresAt)
  if (!Number.isFinite(expiresAt) || !signature) return false
  if (Date.now() > expiresAt) return false

  const expected = await hmac(secret, `pos-session:${expiresAt}`)
  return signature === expected
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ message: 'Method Not Allowed' }, 405)
  }

  const tokenSecret = Deno.env.get('POS_EDGE_TOKEN_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!tokenSecret || !supabaseUrl || !serviceRoleKey) {
    return json({ message: 'Edge Function config is missing' }, 500)
  }

  const token = req.headers.get('x-pos-edge-token')
  if (!(await isValidToken(token, tokenSecret))) {
    return json({ message: 'Unauthorized' }, 401)
  }

  let body: { id?: number }
  try {
    body = await req.json()
  } catch {
    return json({ message: 'Invalid JSON body' }, 400)
  }

  const id = body.id
  if (!id) {
    return json({ message: 'Missing order id' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { error } = await supabase.from('orders').delete().eq('id', id)

  if (error) {
    return json({ message: error.message || 'เกิดข้อผิดพลาดในการลบออเดอร์' }, 400)
  }

  return json({ ok: true })
})
