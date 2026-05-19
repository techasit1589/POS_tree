import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.1'

type UpdateOrderInput = {
  customerName?: string
  customerPhone?: string
  note?: string
  paymentMethod?: 'cash' | 'transfer'
  items?: Array<{
    treeName?: string
    treeId?: number
    unitPrice?: number
    quantity?: number
  }>
}

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

function normalizeItems(items: Array<{
  treeName?: string
  treeId?: number
  unitPrice?: number
  quantity?: number
}>): Array<{
  tree_id: number | null
  tree_name: string
  unit_price: number
  quantity: number
}> {
  return items
    .filter((item) => item.treeName && Number(item.quantity) > 0)
    .map((item) => ({
      tree_id: item.treeId ?? null,
      tree_name: String(item.treeName),
      unit_price: Number(item.unitPrice) || 0,
      quantity: Number(item.quantity) || 1,
    }))
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

  let body: { id?: number; input?: UpdateOrderInput }
  try {
    body = await req.json()
  } catch {
    return json({ message: 'Invalid JSON body' }, 400)
  }

  const id = body.id
  const input = body.input
  if (!id || !input) {
    return json({ message: 'Missing id or input' }, 400)
  }

  const items = input.items ? normalizeItems(input.items) : null
  if (items !== null && items.length === 0) {
    return json({ message: 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ' }, 400)
  }
  if (items !== null && items.some((item) => item.unit_price <= 0 || item.quantity <= 0)) {
    return json({ message: 'กรุณาใส่ราคาและจำนวนให้ถูกต้อง' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await supabase.rpc('update_order', {
    p_id: id,
    p_customer_name: input.customerName ?? null,
    p_customer_phone: input.customerPhone ?? null,
    p_note: input.note ?? null,
    p_payment_method: input.paymentMethod ?? null,
    p_items: items,
  })

  if (error) {
    const message = error.code === '23505'
      ? 'ข้อมูลซ้ำในระบบ กรุณาลองใหม่'
      : error.message || 'เกิดข้อผิดพลาด'
    return json({ message }, 400)
  }

  return json(data)
})
