-- ============================================================================
-- POS Tree Shop — Supabase Schema
-- ============================================================================
-- รัน SQL นี้ใน Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- หรือ psql ก็ได้

-- ─── Tables ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trees (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  name_latin    TEXT,
  category      TEXT,
  price         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  unit          TEXT DEFAULT 'ต้น',
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trees_is_active_idx ON trees(is_active);
CREATE INDEX IF NOT EXISTS trees_name_idx ON trees(name);
CREATE INDEX IF NOT EXISTS trees_category_idx ON trees(category);

CREATE TABLE IF NOT EXISTS orders (
  id              BIGSERIAL PRIMARY KEY,
  receipt_number  TEXT NOT NULL UNIQUE,
  total_amount    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  customer_name   TEXT,
  customer_phone  TEXT,
  note            TEXT,
  payment_method  TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer')),
  status          TEXT NOT NULL DEFAULT 'completed',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_receipt_number_idx ON orders(receipt_number);

CREATE TABLE IF NOT EXISTS order_items (
  id          BIGSERIAL PRIMARY KEY,
  order_id    BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tree_id     BIGINT REFERENCES trees(id) ON DELETE SET NULL,
  tree_name   TEXT NOT NULL,
  unit_price  NUMERIC(10, 2) NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  subtotal    NUMERIC(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);

-- ─── updated_at auto-update trigger สำหรับ trees ─────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trees_set_updated_at ON trees;
CREATE TRIGGER trees_set_updated_at
  BEFORE UPDATE ON trees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────
-- POS เล็ก ๆ 1-2 คน: PIN gate ผ่าน Vercel middleware
-- Supabase ระดับ RLS อนุญาต anon key ทำ CRUD ได้ (เพราะ anon key อยู่ใน frontend อยู่แล้ว)
-- ถ้าอยากเข้มขึ้นในอนาคต ค่อยเปลี่ยนเป็น signed JWT

ALTER TABLE trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Allow anon (และ authenticated) ทำทุกอย่าง
DROP POLICY IF EXISTS trees_all_anon ON trees;
CREATE POLICY trees_all_anon ON trees
  FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS orders_all_anon ON orders;
CREATE POLICY orders_all_anon ON orders
  FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS order_items_all_anon ON order_items;
CREATE POLICY order_items_all_anon ON order_items
  FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

-- ─── Helper: สร้าง order + items เป็น transaction เดียว ──────────────────
-- เรียกผ่าน supabase.rpc('create_order', { ... })
-- ป้องกันออเดอร์ค้างถ้า insert items fail

CREATE OR REPLACE FUNCTION create_order(
  p_receipt_number TEXT,
  p_customer_name  TEXT,
  p_customer_phone TEXT,
  p_note           TEXT,
  p_payment_method TEXT,
  p_items          JSONB  -- [{tree_id, tree_name, unit_price, quantity}]
) RETURNS JSONB AS $$
DECLARE
  v_order_id    BIGINT;
  v_total       NUMERIC(10, 2) := 0;
  v_item        JSONB;
  v_result      JSONB;
BEGIN
  -- คำนวณยอดรวม
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total := v_total + (v_item->>'unit_price')::NUMERIC * (v_item->>'quantity')::INTEGER;
  END LOOP;

  -- สร้าง order
  INSERT INTO orders (receipt_number, total_amount, customer_name, customer_phone, note, payment_method)
  VALUES (p_receipt_number, v_total, p_customer_name, p_customer_phone, p_note, COALESCE(p_payment_method, 'cash'))
  RETURNING id INTO v_order_id;

  -- เพิ่ม items
  INSERT INTO order_items (order_id, tree_id, tree_name, unit_price, quantity, subtotal)
  SELECT
    v_order_id,
    NULLIF((it->>'tree_id'), '')::BIGINT,
    it->>'tree_name',
    (it->>'unit_price')::NUMERIC,
    (it->>'quantity')::INTEGER,
    (it->>'unit_price')::NUMERIC * (it->>'quantity')::INTEGER
  FROM jsonb_array_elements(p_items) AS it;

  -- คืนค่า order พร้อม items
  SELECT jsonb_build_object(
    'id', o.id,
    'receipt_number', o.receipt_number,
    'total_amount', o.total_amount,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'note', o.note,
    'payment_method', o.payment_method,
    'status', o.status,
    'created_at', o.created_at,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'tree_id', i.tree_id,
        'tree_name', i.tree_name,
        'unit_price', i.unit_price,
        'quantity', i.quantity,
        'subtotal', i.subtotal
      ) ORDER BY i.id) FROM order_items i WHERE i.order_id = o.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM orders o WHERE o.id = v_order_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ─── Helper: update order + items เป็น transaction เดียว ─────────────────

CREATE OR REPLACE FUNCTION update_order(
  p_id             BIGINT,
  p_customer_name  TEXT,
  p_customer_phone TEXT,
  p_note           TEXT,
  p_payment_method TEXT,
  p_items          JSONB  -- nullable; ถ้าไม่ส่ง items มาจะไม่แตะ
) RETURNS JSONB AS $$
DECLARE
  v_total   NUMERIC(10, 2);
  v_result  JSONB;
BEGIN
  -- update fields ที่ส่งมา (NULL = ไม่แตะ)
  UPDATE orders SET
    customer_name  = COALESCE(p_customer_name,  customer_name),
    customer_phone = COALESCE(p_customer_phone, customer_phone),
    note           = COALESCE(p_note,           note),
    payment_method = COALESCE(p_payment_method, payment_method)
  WHERE id = p_id;

  -- ถ้าส่ง items มา → ลบของเก่า + insert ของใหม่ + คำนวณ total ใหม่
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    DELETE FROM order_items WHERE order_id = p_id;

    INSERT INTO order_items (order_id, tree_id, tree_name, unit_price, quantity, subtotal)
    SELECT
      p_id,
      NULLIF((it->>'tree_id'), '')::BIGINT,
      it->>'tree_name',
      (it->>'unit_price')::NUMERIC,
      (it->>'quantity')::INTEGER,
      (it->>'unit_price')::NUMERIC * (it->>'quantity')::INTEGER
    FROM jsonb_array_elements(p_items) AS it;

    SELECT SUM(subtotal) INTO v_total FROM order_items WHERE order_id = p_id;
    UPDATE orders SET total_amount = v_total WHERE id = p_id;
  END IF;

  -- คืน order พร้อม items
  SELECT jsonb_build_object(
    'id', o.id,
    'receipt_number', o.receipt_number,
    'total_amount', o.total_amount,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'note', o.note,
    'payment_method', o.payment_method,
    'status', o.status,
    'created_at', o.created_at,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'tree_id', i.tree_id,
        'tree_name', i.tree_name,
        'unit_price', i.unit_price,
        'quantity', i.quantity,
        'subtotal', i.subtotal
      ) ORDER BY i.id) FROM order_items i WHERE i.order_id = o.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM orders o WHERE o.id = p_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
