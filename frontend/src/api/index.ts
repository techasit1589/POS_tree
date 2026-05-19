// API layer ใช้ Supabase แทน NestJS
// รักษา function signature เดิม → component ไม่ต้องแก้
import { supabase } from '../lib/supabase';
import type { Tree, Order, OrderItem } from '../types';

// ─── helpers: snake_case (DB) ↔ camelCase (frontend) ────────────────────

interface DbTree {
  id: number;
  name: string;
  category: string | null;
  price: string | number;
  price_wholesale: string | number | null;
  unit: string | null;
  is_active?: boolean;
}

interface DbOrderItem {
  id: number;
  tree_id: number | null;
  tree_name: string;
  unit_price: string | number;
  quantity: number;
  subtotal: string | number;
}

interface DbOrder {
  id: number;
  receipt_number: string;
  total_amount: string | number;
  customer_name: string | null;
  customer_phone: string | null;
  note: string | null;
  payment_method: string | null;
  status: string;
  created_at: string;
  items?: DbOrderItem[];
  order_items?: DbOrderItem[];
}

const num = (v: string | number | null | undefined) => v === null || v === undefined ? 0 : Number(v);

const toTree = (r: DbTree): Tree => ({
  id: r.id,
  name: r.name,
  category: r.category ?? undefined,
  price: num(r.price),
  priceWholesale: r.price_wholesale != null ? num(r.price_wholesale) : undefined,
  unit: r.unit ?? undefined,
});

const toOrderItem = (r: DbOrderItem): OrderItem => ({
  id: r.id,
  treeId: r.tree_id ?? undefined,
  treeName: r.tree_name,
  unitPrice: num(r.unit_price),
  quantity: r.quantity,
  subtotal: num(r.subtotal),
});

const toOrder = (r: DbOrder): Order => ({
  id: r.id,
  receiptNumber: r.receipt_number,
  totalAmount: num(r.total_amount),
  customerName: r.customer_name ?? undefined,
  customerPhone: r.customer_phone ?? undefined,
  note: r.note ?? undefined,
  paymentMethod: (r.payment_method as 'cash' | 'transfer') || 'cash',
  status: r.status,
  items: (r.items ?? r.order_items ?? []).map(toOrderItem),
  createdAt: r.created_at,
});

/** ห่อ error ให้มีรูป axios เพื่อให้ component เดิมอ่าน e.response.data.message ได้ */
function wrapError(message: string): Error {
  const err = new Error(message) as Error & {
    response: { data: { message: string } };
  };
  err.response = { data: { message } };
  return err;
}

function unwrapSupabaseError(e: { message?: string; details?: string; code?: string } | null): never {
  const msg = e?.message || e?.details || 'เกิดข้อผิดพลาด';
  if (e?.code === '23505') throw wrapError('ข้อมูลซ้ำในระบบ กรุณาลองใหม่');
  throw wrapError(msg);
}

function genReceiptNumber(): string {
  // บวกเวลาประเทศไทย (UTC+7) เข้าไปในวัตถุ Date เพื่อให้ได้ค่าวันที่ของไทยเสมอไม่ว่าจะรันใน timezone ใด
  const now = new Date();
  const d = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(d.getUTCFullYear()).slice(-2);
  const rnd = Math.floor(1000000 + Math.random() * 9000000);
  return `${dd}${mm}${yy}-${rnd}`;
}

// ─── Trees ───────────────────────────────────────────────────────────────

export async function searchTrees(q: string): Promise<Tree[]> {
  let query = supabase.from('trees').select('*').eq('is_active', true).limit(20);
  // strip PostgREST reserved chars ( , ( ) ) ที่จะทำให้ .or() filter parse ผิด
  const safe = q.trim().replace(/[,()]/g, ' ').trim();
  if (safe !== '') {
    const pattern = `%${safe}%`;
    query = query.or(`name.ilike.${pattern},category.ilike.${pattern}`);
  }
  const { data, error } = await query;
  if (error) unwrapSupabaseError(error);
  return (data as DbTree[]).map(toTree);
}

export async function getAllTrees(): Promise<Tree[]> {
  const { data, error } = await supabase
    .from('trees')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) unwrapSupabaseError(error);
  return (data as DbTree[]).map(toTree);
}

export async function getPaginatedTrees(params: {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
}): Promise<{ trees: Tree[]; total: number }> {
  const { page, pageSize, search, category } = params;

  let query = supabase
    .from('trees')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (category && category !== 'ทั้งหมด') {
    query = query.eq('category', category);
  }

  if (search) {
    const q = search.trim();
    // strip reserved PostgREST chars just like in searchTrees
    const safe = q.replace(/[,()]/g, ' ').trim();
    if (safe !== '') {
      const pattern = `%${safe}%`;
      query = query.or(`name.ilike.${pattern},category.ilike.${pattern}`);
    }
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) unwrapSupabaseError(error);

  return {
    trees: (data as DbTree[]).map(toTree),
    total: count || 0,
  };
}

export async function createTree(input: Omit<Tree, 'id'>): Promise<Tree> {
  const { data: existing } = await supabase
    .from('trees').select('id, is_active').eq('name', input.name).maybeSingle();
  if (existing) {
    if (!existing.is_active) {
      const { data, error } = await supabase
        .from('trees')
        .update({
          category: input.category ?? null,
          price: input.price,
          price_wholesale: input.priceWholesale ?? null,
          unit: input.unit || 'ต้น',
          is_active: true,
        })
        .eq('id', existing.id)
        .select('*').single();
      if (error) unwrapSupabaseError(error);
      return toTree(data as DbTree);
    }
    throw wrapError(`มีต้นไม้ชื่อ "${input.name}" อยู่แล้ว`);
  }

  const { data, error } = await supabase
    .from('trees')
    .insert({
      name: input.name,
      category: input.category ?? null,
      price: input.price,
      price_wholesale: input.priceWholesale ?? null,
      unit: input.unit || 'ต้น',
    })
    .select('*').single();
  if (error) unwrapSupabaseError(error);
  return toTree(data as DbTree);
}

export async function updateTree(id: number, input: Omit<Partial<Tree>, 'priceWholesale'> & { priceWholesale?: number | null }): Promise<Tree> {
  const patch: Partial<DbTree> = {};
  if (input.name !== undefined)              patch.name = input.name;
  if (input.category !== undefined)          patch.category = input.category || null;
  if (input.price !== undefined)             patch.price = input.price;
  if ('priceWholesale' in input)             patch.price_wholesale = input.priceWholesale ?? null;
  if (input.unit !== undefined)              patch.unit = input.unit || null;

  const { data, error } = await supabase
    .from('trees').update(patch).eq('id', id).select('*').single();
  if (error) unwrapSupabaseError(error);
  return toTree(data as DbTree);
}

export async function deleteTree(id: number): Promise<void> {
  const { error } = await supabase.from('trees').update({ is_active: false }).eq('id', id);
  if (error) unwrapSupabaseError(error);
}

// ─── Orders ──────────────────────────────────────────────────────────────

interface CreateOrderInput {
  items: { treeName: string; treeId?: number; unitPrice: number; quantity: number }[];
  customerName?: string;
  customerPhone?: string;
  note?: string;
  paymentMethod?: 'cash' | 'transfer';
}

function getEdgeToken(): string | null {
  const token = localStorage.getItem('pos_edge_token');
  const expiresAt = Number(localStorage.getItem('pos_edge_token_expires_at'));
  if (!token || !Number.isFinite(expiresAt) || Date.now() >= expiresAt) return null;
  return token;
}

async function refreshEdgeToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/edge-token', { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.ok && data.edgeToken && data.edgeExpiresAt) {
      localStorage.setItem('pos_edge_token', data.edgeToken);
      localStorage.setItem('pos_edge_token_expires_at', String(data.edgeExpiresAt));
      return data.edgeToken;
    }
  } catch (e) {
    console.error('Failed to refresh edge token:', e);
  }
  return null;
}

function createOrderFunctionUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) throw wrapError('Missing Supabase env vars. ตั้ง VITE_SUPABASE_URL ใน .env / Vercel');
  return `${url.replace(/\/$/, '')}/functions/v1/create-order`;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  // หากเป็น Local Dev ให้ตกกลับไปใช้ Direct Database RPC อัตโนมัติ เพื่อให้ผู้พัฒนาสะดวก
  if (import.meta.env.DEV) {
    const items = input.items.map((i) => ({
      tree_id: i.treeId ?? null,
      tree_name: i.treeName,
      unit_price: i.unitPrice,
      quantity: i.quantity,
    }));

    const { data, error } = await supabase.rpc('create_order', {
      p_receipt_number: genReceiptNumber(),
      p_customer_name: input.customerName ?? null,
      p_customer_phone: input.customerPhone ?? null,
      p_note: input.note ?? null,
      p_payment_method: input.paymentMethod ?? 'cash',
      p_items: items,
    });
    if (error) unwrapSupabaseError(error);
    return toOrder(data as DbOrder);
  }

  // ใน Production: วิ่งผ่าน Edge Function
  let token = getEdgeToken();
  if (!token) {
    // ลองทำ Automatic Token Refresh
    token = await refreshEdgeToken();
  }

  if (!token) {
    throw wrapError('Session หมดอายุ กรุณาใส่ PIN ใหม่');
  }

  let res = await fetch(createOrderFunctionUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pos-edge-token': token,
    },
    body: JSON.stringify(input),
  });

  // ถ้ารหัสผลลัพธ์เป็น 401 (อาจเกิดจาก Token หมดอายุกลางคันหรือเซิร์ฟเวอร์เปลี่ยน Secret)
  // ให้ลองทำการ Refresh Token อีกครั้งนึง
  if (res.status === 401) {
    const refreshedToken = await refreshEdgeToken();
    if (refreshedToken) {
      res = await fetch(createOrderFunctionUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pos-edge-token': refreshedToken,
        },
        body: JSON.stringify(input),
      });
    }
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw wrapError(body?.message || 'เกิดข้อผิดพลาดในการบันทึกออเดอร์');
  }

  return toOrder(body as DbOrder);
}

export const ORDERS_LIMIT = 500;

export async function getOrders(params: {
  page: number;
  pageSize: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<Order[]> {
  const { page, pageSize, search, dateFrom, dateTo } = params;
  let query = supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });

  if (search) {
    const q = search.trim();
    const pattern = `%${q}%`;
    query = query.or(`customer_name.ilike.${pattern},customer_phone.ilike.${pattern},receipt_number.ilike.${pattern}`);
  }

  if (dateFrom) {
    query = query.gte('created_at', new Date(dateFrom + 'T00:00:00+07:00').toISOString());
  }
  if (dateTo) {
    query = query.lte('created_at', new Date(dateTo + 'T23:59:59.999+07:00').toISOString());
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error } = await query;
  if (error) unwrapSupabaseError(error);
  return (data as DbOrder[]).map(toOrder);
}

export async function getOrdersOverallSummary(params: {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ totalSales: number; totalCount: number }> {
  const { search, dateFrom, dateTo } = params;
  const { data, error } = await supabase.rpc('get_orders_overall_summary', {
    p_search: search || null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
  });
  if (error) unwrapSupabaseError(error);

  const summary = data as { total_sales: number; total_count: string | number };
  return {
    totalSales: Number(summary?.total_sales) || 0,
    totalCount: Number(summary?.total_count) || 0,
  };
}

interface GroupedSummaryItem {
  label: string;
  total: number;
  count: number;
}

export async function getOrdersGroupedSummary(params: {
  type: 'day' | 'month' | 'year';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<GroupedSummaryItem[]> {
  const { type, search, dateFrom, dateTo } = params;
  const { data, error } = await supabase.rpc('get_orders_grouped_summary', {
    p_type: type,
    p_search: search || null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
  });
  if (error) unwrapSupabaseError(error);

  return (data as any[]).map((item) => ({
    label: String(item.label),
    total: Number(item.total) || 0,
    count: Number(item.count) || 0,
  }));
}

interface UpdateOrderInput {
  customerName?: string;
  customerPhone?: string;
  note?: string;
  paymentMethod?: 'cash' | 'transfer';
  items?: { treeName: string; treeId?: number; unitPrice: number; quantity: number }[];
}

function updateOrderFunctionUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) throw wrapError('Missing Supabase env vars. ตั้ง VITE_SUPABASE_URL ใน .env / Vercel');
  return `${url.replace(/\/$/, '')}/functions/v1/update-order`;
}

function deleteOrderFunctionUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) throw wrapError('Missing Supabase env vars. ตั้ง VITE_SUPABASE_URL ใน .env / Vercel');
  return `${url.replace(/\/$/, '')}/functions/v1/delete-order`;
}

export async function updateOrder(id: number, input: UpdateOrderInput): Promise<Order> {
  // หากเป็น Local Dev ให้ตกกลับไปใช้ Direct Database RPC อัตโนมัติ เพื่อให้ผู้พัฒนาสะดวก
  if (import.meta.env.DEV) {
    const items = input.items?.map((i) => ({
      tree_id: i.treeId ?? null,
      tree_name: i.treeName,
      unit_price: i.unitPrice,
      quantity: i.quantity,
    })) ?? null;

    const { data, error } = await supabase.rpc('update_order', {
      p_id: id,
      p_customer_name: input.customerName ?? null,
      p_customer_phone: input.customerPhone ?? null,
      p_note: input.note ?? null,
      p_payment_method: input.paymentMethod ?? null,
      p_items: items,
    });
    if (error) unwrapSupabaseError(error);
    return toOrder(data as DbOrder);
  }

  // ใน Production: วิ่งผ่าน Edge Function
  let token = getEdgeToken();
  if (!token) {
    token = await refreshEdgeToken();
  }

  if (!token) {
    throw wrapError('Session หมดอายุ กรุณาใส่ PIN ใหม่');
  }

  let res = await fetch(updateOrderFunctionUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pos-edge-token': token,
    },
    body: JSON.stringify({ id, input }),
  });

  if (res.status === 401) {
    const refreshedToken = await refreshEdgeToken();
    if (refreshedToken) {
      res = await fetch(updateOrderFunctionUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pos-edge-token': refreshedToken,
        },
        body: JSON.stringify({ id, input }),
      });
    }
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw wrapError(body?.message || 'เกิดข้อผิดพลาดในการแก้ไขออเดอร์');
  }

  return toOrder(body as DbOrder);
}

export async function deleteOrder(id: number): Promise<void> {
  // หากเป็น Local Dev ให้ตกกลับไปใช้ Direct Delete ตารางตรง ๆ
  if (import.meta.env.DEV) {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) unwrapSupabaseError(error);
    return;
  }

  // ใน Production: วิ่งผ่าน Edge Function
  let token = getEdgeToken();
  if (!token) {
    token = await refreshEdgeToken();
  }

  if (!token) {
    throw wrapError('Session หมดอายุ กรุณาใส่ PIN ใหม่');
  }

  let res = await fetch(deleteOrderFunctionUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pos-edge-token': token,
    },
    body: JSON.stringify({ id }),
  });

  if (res.status === 401) {
    const refreshedToken = await refreshEdgeToken();
    if (refreshedToken) {
      res = await fetch(deleteOrderFunctionUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pos-edge-token': refreshedToken,
        },
        body: JSON.stringify({ id }),
      });
    }
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw wrapError(body?.message || 'เกิดข้อผิดพลาดในการลบออเดอร์');
  }
}
