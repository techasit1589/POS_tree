# Edge Create Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route only `createOrder` through a Supabase Edge Function while keeping existing direct Supabase reads and all other writes unchanged.

**Architecture:** Keep the existing browser Supabase client for `trees`, `getOrders`, `updateOrder`, `deleteOrder`, and tree management during this trial. Add a Supabase Edge Function named `create-order` that validates a short-lived token issued after PIN login, then calls the existing `create_order` database RPC with the service role key. Do not tighten RLS in this first pass; measure correctness and latency before changing permissions.

**Tech Stack:** React/Vite frontend, Vercel Edge API for PIN verification, Supabase Edge Functions running Deno, `@supabase/supabase-js`, existing Postgres RPC `create_order`.

---

## Trial Notes From 2026-05-18

This plan was partially implemented, deployed, then rolled back. Keep these notes before trying again.

### What Worked

- The Edge Function deployed successfully with:

```powershell
supabase functions deploy create-order --project-ref bgpylqaiohifsabskdsg --no-verify-jwt
```

- TypeScript passed after the frontend changes:

```powershell
cd E:\claude\POS\pos-system\frontend
npx tsc --noEmit
```

- The CORS issue was resolved after redeploying with JWT verification disabled.

### Problems Found

1. Browser preflight failed with CORS before the function handler ran.

Observed browser error:

```text
Access to fetch at 'https://bgpylqaiohifsabskdsg.supabase.co/functions/v1/create-order'
from origin 'https://pos-tree.vercel.app' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check:
It does not have HTTP ok status.
```

Cause: Supabase Edge Functions verify Supabase JWTs by default. The browser `OPTIONS` preflight did not include a valid Supabase JWT, so Supabase rejected the request before our `OPTIONS` handler could return CORS headers.

Fix: deploy with JWT verification disabled because this trial uses the custom `x-pos-edge-token` HMAC token instead of Supabase Auth JWT:

```powershell
supabase functions deploy create-order --project-ref bgpylqaiohifsabskdsg --no-verify-jwt
```

Alternative fix: track this in `supabase/config.toml`:

```toml
project_id = "bgpylqaiohifsabskdsg"

[functions.create-order]
verify_jwt = false
```

Then deploy:

```powershell
supabase functions deploy create-order --project-ref bgpylqaiohifsabskdsg
```

If the function is deleted or abandoned, also delete `supabase/config.toml` if it only existed for this function.

2. Existing logged-in devices needed to enter PIN again.

Cause: the old login flow only created the `pin_ok` cookie. The Edge Function trial also required a new browser-side token stored in `sessionStorage` as `pos_edge_token`, and existing devices did not have it.

Result: even users with a valid `pin_ok` cookie could open the app, but `createOrder()` failed because no Edge token existed.

Possible fixes for a future attempt:

- Preferred simple fix: store the Edge token in `localStorage` with `pos_edge_token_expires_at` instead of `sessionStorage`, so it survives closing and reopening the browser.
- More seamless fix: add a lightweight `/api/edge-token` endpoint that checks the existing signed `pin_ok` cookie and returns a fresh Edge token. Then `createOrder()` can request a token automatically when missing.
- Conservative rollout fix: keep RPC fallback in production for one deploy cycle only, log/measure missing-token cases, then remove fallback after active devices have refreshed. This preserves sales flow but temporarily weakens the security benefit.

3. Local dev did not have PIN/token flow.

Cause: `npm run dev` runs Vite directly, not Vercel middleware and not `/api/verify-pin`.

Temporary fix used during the trial: allow `createOrder()` to fall back to direct RPC only when `import.meta.env.DEV` is true. If trying again, keep this dev-only fallback so local UI testing still works.

4. Build verification may fail on this machine with `spawn EPERM`.

Observed:

```text
failed to load config from E:\claude\POS\pos-system\frontend\vite.config.ts
Error: spawn EPERM
```

This was present before the Edge Function work and appears to be a local esbuild/Vite process-spawn issue, not a Supabase or TypeScript error. Use `npx tsc --noEmit` as the reliable local code check on this machine, and verify full build in Vercel/GitHub if available.

### Rollback Performed

The trial was rolled back to the old flow:

- `frontend/src/api/index.ts` `createOrder()` uses `supabase.rpc('create_order')` directly again.
- `frontend/api/verify-pin.ts` returns only `{ ok: true }` and `pin_ok` cookie again.
- `frontend/public/pin.html` no longer stores `pos_edge_token`.
- `frontend/.env.example` no longer includes `POS_EDGE_TOKEN_SECRET`.
- `supabase/functions/create-order/index.ts` was removed.
- `supabase/config.toml` was removed.
- The deployed Supabase `create-order` function was deleted.

Check rollback state with:

```powershell
rg -n "POS_EDGE_TOKEN_SECRET|pos_edge_token|create-order|functions/v1|x-pos-edge-token|verify_jwt|Edge Function" E:\claude\POS\pos-system
cd E:\claude\POS\pos-system\frontend
npx tsc --noEmit
```

Expected:

```text
rg finds nothing
TypeScript exits with code 0
```

---

## Revised Recommendation For The Next Attempt

Do not reuse the first implementation exactly as-is. For the next attempt, add automatic token refresh from the existing `pin_ok` cookie so devices that already passed PIN do not get stuck.

Recommended revised flow:

```text
User passes PIN
  -> /api/verify-pin sets existing HttpOnly pin_ok cookie
  -> /api/verify-pin also returns edgeToken for immediate use

Later createOrder runs
  -> if edgeToken exists and is not expired, call Edge Function
  -> if edgeToken is missing or expired, call /api/edge-token
  -> /api/edge-token verifies pin_ok cookie with COOKIE_SECRET
  -> /api/edge-token returns fresh edgeToken
  -> createOrder retries Edge Function once
```

Files to add/modify in the revised attempt:

- Create: `frontend/api/edge-token.ts`
- Modify: `frontend/api/verify-pin.ts`
- Modify: `frontend/public/pin.html`
- Modify: `frontend/src/api/index.ts`
- Modify: `frontend/.env.example`
- Create: `supabase/functions/create-order/index.ts`
- Optional create: `supabase/config.toml`

Add this success criterion to the next attempt:

- A browser with an existing valid `pin_ok` cookie but no `pos_edge_token` can still create an order because `createOrder()` refreshes the Edge token automatically.

---

## Success Criteria

- Creating an order from the POS screen still returns the same `Order` shape used by the receipt preview.
- `trees` reads remain direct from Supabase and are not routed through Edge Functions.
- `createOrder` calls `https://<project>.supabase.co/functions/v1/create-order` instead of `supabase.rpc('create_order')`.
- Edge Function rejects missing, expired, or invalid tokens before calling the database.
- Existing devices with a valid `pin_ok` cookie can obtain an Edge token without manually visiting `/pin.html` again.
- Existing TypeScript check passes with `npx tsc --noEmit`.
- Manual create-order test succeeds against the connected Supabase project.
- No RLS changes are made in this first trial.

## Files

- Create: `supabase/functions/create-order/index.ts`
- Modify: `frontend/api/verify-pin.ts`
- Modify: `frontend/public/pin.html`
- Modify: `frontend/src/api/index.ts`
- Modify: `frontend/.env.example`
- Optional local-only: `frontend/.env` and Supabase project secrets

## Assumptions

- `VITE_SUPABASE_URL` points to project `bgpylqaiohifsabskdsg`.
- The database function `public.create_order(...)` already exists and returns the JSON shape currently consumed by `toOrder`.
- `SUPABASE_SERVICE_ROLE_KEY` is available to the Edge Function as a Supabase secret.
- Add one shared secret named `POS_EDGE_TOKEN_SECRET` to both Vercel/frontend API environment and Supabase Edge Function secrets. Use a long random value. Do not prefix it with `VITE_`.
- The token is only a practical gate for this POS flow. It is not a full user identity system.

---

### Task 1: Issue a Short-Lived Edge Token After PIN Login

**Files:**
- Modify: `frontend/api/verify-pin.ts`
- Modify: `frontend/public/pin.html`
- Modify: `frontend/.env.example`

- [ ] **Step 1: Add token helper functions to `frontend/api/verify-pin.ts`**

Add these helpers below the existing `signToken` function:

```ts
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
  return Date.now() + 12 * 60 * 60 * 1000
}
```

- [ ] **Step 2: Require `POS_EDGE_TOKEN_SECRET` when PIN is correct**

In `frontend/api/verify-pin.ts`, change the env block from:

```ts
const correct = process.env.APP_PIN
const secret  = process.env.COOKIE_SECRET
if (!correct || !secret) {
```

to:

```ts
const correct = process.env.APP_PIN
const secret  = process.env.COOKIE_SECRET
const edgeSecret = process.env.POS_EDGE_TOKEN_SECRET
if (!correct || !secret || !edgeSecret) {
```

Update the log message to:

```ts
console.error('[verify-pin] missing env vars: APP_PIN, COOKIE_SECRET, or POS_EDGE_TOKEN_SECRET')
```

- [ ] **Step 3: Return the edge token on successful PIN verification**

In `frontend/api/verify-pin.ts`, replace the successful response body:

```ts
return new Response(JSON.stringify({ ok: true }), {
```

with:

```ts
const edgeExpiresAt = edgeTokenExpiresAt()
const edgeToken = await signEdgeToken(edgeSecret, edgeExpiresAt)

return new Response(JSON.stringify({ ok: true, edgeToken, edgeExpiresAt }), {
```

Keep the existing `Set-Cookie` header unchanged.

- [ ] **Step 4: Store the token from `frontend/public/pin.html`**

In the `if (data.ok)` branch of `submit()`, replace:

```js
window.location.href = '/'
```

with:

```js
if (data.edgeToken && data.edgeExpiresAt) {
  sessionStorage.setItem('pos_edge_token', data.edgeToken)
  sessionStorage.setItem('pos_edge_token_expires_at', String(data.edgeExpiresAt))
}
window.location.href = '/'
```

- [ ] **Step 5: Document the new env var**

Add this to `frontend/.env.example`:

```dotenv
# Secret สำหรับ sign token ที่ frontend ส่งไป Supabase Edge Function หลังผ่าน PIN
# ต้องตั้งค่าเดียวกันใน Supabase secrets ด้วย ห้ามใช้ prefix VITE_
POS_EDGE_TOKEN_SECRET=replace-with-another-long-random-string
```

- [ ] **Step 6: Verify TypeScript**

Run:

```powershell
cd E:\claude\POS\pos-system\frontend
npx tsc --noEmit
```

Expected: exits with code 0.

---

### Task 2: Add the Supabase Edge Function

**Files:**
- Create: `supabase/functions/create-order/index.ts`

- [ ] **Step 1: Create `supabase/functions/create-order/index.ts`**

Use this complete function:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.1'

type CreateOrderInput = {
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

  const expected = await hmac(secret, `create-order:${expiresAt}`)
  return signature === expected
}

function genReceiptNumber(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  const rnd = Math.floor(1000000 + Math.random() * 9000000)
  return `${dd}${mm}${yy}-${rnd}`
}

function normalizeItems(input: CreateOrderInput): Array<{
  tree_id: number | null
  tree_name: string
  unit_price: number
  quantity: number
}> {
  const items = input.items ?? []
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

  let input: CreateOrderInput
  try {
    input = await req.json()
  } catch {
    return json({ message: 'Invalid JSON body' }, 400)
  }

  const items = normalizeItems(input)
  if (items.length === 0) {
    return json({ message: 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ' }, 400)
  }

  if (items.some((item) => item.unit_price <= 0 || item.quantity <= 0)) {
    return json({ message: 'กรุณาใส่ราคาและจำนวนให้ถูกต้อง' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await supabase.rpc('create_order', {
    p_receipt_number: genReceiptNumber(),
    p_customer_name: input.customerName ?? null,
    p_customer_phone: input.customerPhone ?? null,
    p_note: input.note ?? null,
    p_payment_method: input.paymentMethod ?? 'cash',
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
```

- [ ] **Step 2: Run local syntax check if Deno is installed**

Run:

```powershell
deno check E:\claude\POS\pos-system\supabase\functions\create-order\index.ts
```

Expected: no TypeScript errors.

If `deno` is not installed, skip this local check and rely on Supabase deploy validation.

---

### Task 3: Route Frontend `createOrder` to the Edge Function

**Files:**
- Modify: `frontend/src/api/index.ts`

- [ ] **Step 1: Add an Edge Function URL helper**

In `frontend/src/api/index.ts`, add this helper near `genReceiptNumber()`:

```ts
function getEdgeToken(): string | null {
  const token = sessionStorage.getItem('pos_edge_token');
  const expiresAt = Number(sessionStorage.getItem('pos_edge_token_expires_at'));
  if (!token || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  return token;
}

function createOrderFunctionUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) throw wrapError('Missing Supabase env vars. ตั้ง VITE_SUPABASE_URL ใน .env / Vercel');
  return `${url.replace(/\/$/, '')}/functions/v1/create-order`;
}
```

Keep `genReceiptNumber()` in place for now even though `createOrder` will stop using it. Do not remove it in this task; it may still be useful for preview logic and removing it is unrelated.

- [ ] **Step 2: Replace only the body of `createOrder`**

Replace the current `createOrder` implementation with:

```ts
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const token = getEdgeToken();
  if (!token) {
    throw wrapError('Session หมดอายุ กรุณาใส่ PIN ใหม่');
  }

  const res = await fetch(createOrderFunctionUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pos-edge-token': token,
    },
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw wrapError(body?.message || 'เกิดข้อผิดพลาด');
  }

  return toOrder(body as DbOrder);
}
```

- [ ] **Step 3: Verify TypeScript**

Run:

```powershell
cd E:\claude\POS\pos-system\frontend
npx tsc --noEmit
```

Expected: exits with code 0.

---

### Task 4: Configure Secrets and Deploy the Function

**Files:**
- No committed file changes unless the project already tracks Supabase config.

- [ ] **Step 1: Confirm Supabase CLI is available**

Run:

```powershell
supabase --version
supabase functions --help
```

Expected: both commands print help/version information.

- [ ] **Step 2: Set the Edge token secret in Supabase**

Use the same value as `POS_EDGE_TOKEN_SECRET` in the Vercel/frontend API environment:

```powershell
supabase secrets set POS_EDGE_TOKEN_SECRET="<same-long-secret-used-by-frontend-api>" --project-ref bgpylqaiohifsabskdsg
```

Expected: command succeeds.

- [ ] **Step 3: Deploy the Edge Function**

Run:

```powershell
supabase functions deploy create-order --project-ref bgpylqaiohifsabskdsg
```

Expected: deploy succeeds and returns the function name/ref.

- [ ] **Step 4: Set Vercel/frontend API env**

In the Vercel project settings, add:

```dotenv
POS_EDGE_TOKEN_SECRET=<same-long-secret-used-in-supabase>
```

For local testing, add the same key to `frontend/.env`. Do not commit `frontend/.env`.

---

### Task 5: Manual Verification

**Files:**
- No code changes.

- [ ] **Step 1: Verify PIN returns a token locally or in preview**

Open `/pin.html`, enter the correct PIN, and confirm the browser session storage contains:

```text
pos_edge_token
pos_edge_token_expires_at
```

Expected: both values exist after successful PIN.

- [ ] **Step 2: Verify invalid Edge Function requests are rejected**

Run:

```powershell
$body = @{
  items = @(@{
    treeName = "Test"
    unitPrice = 1
    quantity = 1
  })
  paymentMethod = "cash"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri "https://bgpylqaiohifsabskdsg.supabase.co/functions/v1/create-order" `
  -ContentType "application/json" `
  -Body $body
```

Expected: HTTP 401 with message `Unauthorized`.

- [ ] **Step 3: Verify POS create order works through the UI**

Open the app, pass PIN, create a small real order, and confirm:

```text
Receipt preview appears
Receipt number is populated
Total amount matches the confirmation modal
History page shows the new order
```

- [ ] **Step 4: Check Supabase data counts**

Use the Supabase MCP tool or SQL editor:

```sql
select
  (select count(*) from orders) as orders_count,
  (select count(*) from order_items) as order_items_count;
```

Expected: counts increased according to the manual test order.

- [ ] **Step 5: Measure rough latency**

In browser DevTools Network tab, record the duration of:

```text
POST /functions/v1/create-order
```

Expected: write down the observed duration in the final handoff. If it is noticeably slower than the old direct RPC path, do not migrate additional endpoints yet.

---

### Task 6: Final Safety Check and Handoff

**Files:**
- Review all modified files.

- [ ] **Step 1: Confirm no RLS changes were made**

Run:

```powershell
git diff -- supabase/schema.sql
```

Expected: no new RLS changes for this task.

- [ ] **Step 2: Review changed files**

Run:

```powershell
git diff -- frontend/api/verify-pin.ts frontend/public/pin.html frontend/src/api/index.ts frontend/.env.example supabase/functions/create-order/index.ts
```

Expected: diff only contains token issuing, token storage, the new Edge Function, and `createOrder` routing.

- [ ] **Step 3: Run TypeScript one last time**

Run:

```powershell
cd E:\claude\POS\pos-system\frontend
npx tsc --noEmit
```

Expected: exits with code 0.

- [ ] **Step 4: Commit if requested**

Only commit if the user wants a commit:

```powershell
git add frontend/api/verify-pin.ts frontend/public/pin.html frontend/src/api/index.ts frontend/.env.example supabase/functions/create-order/index.ts
git commit -m "feat: route create order through edge function"
```

Do not push unless the user explicitly asks to push.

---

## Follow-Up After This Trial

If latency and behavior are acceptable, create a second plan to tighten Supabase permissions:

- Keep anon `SELECT` for `trees`.
- Move `updateOrder`, `deleteOrder`, and tree writes behind Edge Functions or another server path.
- Replace permissive `FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE)` policies with narrower policies.
- Add `SET search_path = public` or explicit schema references to database functions to address Supabase advisor warnings.

Do not combine those RLS changes with this first `create-order` trial.
