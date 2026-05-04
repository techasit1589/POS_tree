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

// receipt number: DDMMYY-NNNNNNN (random 7 หลัก)
function genReceiptNumber(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const rnd = Math.floor(1000000 + Math.random() * 9000000);
  return `${dd}${mm}${yy}-${rnd}`;
}

// ─── Trees ───────────────────────────────────────────────────────────────

export async function searchTrees(q: string): Promise<Tree[]> {
  const query = supabase.from('trees').select('*').eq('is_active', true).limit(20);
  // strip PostgREST reserved chars ( , ( ) ) ที่จะทำให้ .or() filter parse ผิด
  const safe = q.trim().replace(/[,()]/g, ' ').trim();
  if (safe !== '') {
    const pattern = `%${safe}%`;
    query.or(`name.ilike.${pattern},category.ilike.${pattern}`);
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

export async function createOrder(input: CreateOrderInput): Promise<Order> {
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

export async function getOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) unwrapSupabaseError(error);
  return (data as DbOrder[]).map(toOrder);
}

interface UpdateOrderInput {
  customerName?: string;
  customerPhone?: string;
  note?: string;
  paymentMethod?: 'cash' | 'transfer';
  items?: { treeName: string; treeId?: number; unitPrice: number; quantity: number }[];
}

export async function updateOrder(id: number, input: UpdateOrderInput): Promise<Order> {
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

export async function deleteOrder(id: number): Promise<void> {
  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) unwrapSupabaseError(error);
}
