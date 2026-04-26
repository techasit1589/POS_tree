// ============================================================================
// Export ข้อมูลจาก Postgres เดิม (ที่ใช้กับ NestJS) → SQL INSERT statements
// ใช้ paste ลงใน Supabase SQL Editor ได้ทันที
// ============================================================================
//
// วิธีรัน:
//   1. ตั้งให้ docker-compose up -d (postgres เก่ายังต้องรัน)
//   2. cd pos-system/supabase
//   3. node export-from-postgres.mjs > data.sql
//   4. เปิด data.sql ใน editor → copy ทั้งหมด → paste ใน Supabase SQL Editor → Run
//
// Optional: ตั้ง env DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME ถ้าเปลี่ยนค่า

import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'posuser',
  password: process.env.DB_PASS || 'pospassword',
  database: process.env.DB_NAME || 'pos_tree_db',
});

// ── helpers ────────────────────────────────────────────────────────────────
const sqlStr = (v) => v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const sqlNum = (v) => v === null || v === undefined ? 'NULL' : String(v);
const sqlBool = (v) => v ? 'TRUE' : 'FALSE';
const sqlTs = (v) => v ? `'${new Date(v).toISOString()}'` : 'NULL';

async function main() {
  await client.connect();
  console.error('-- Connected to Postgres');

  // ── trees ────────────────────────────────────────────────────────────────
  const { rows: trees } = await client.query(`
    SELECT id, name, "nameLatin", category, price, unit, description, "isActive", "createdAt", "updatedAt"
    FROM trees
    ORDER BY id
  `);
  console.error(`-- Found ${trees.length} trees`);

  console.log('-- ─── Trees ───────────────────────────────────────────────────');
  console.log('-- ลบข้อมูลเก่า (ถ้าอยาก fresh import) — uncomment ถ้าต้องการ');
  console.log('-- TRUNCATE TABLE order_items, orders, trees RESTART IDENTITY CASCADE;');
  console.log('');
  for (const t of trees) {
    console.log(
      `INSERT INTO trees (id, name, name_latin, category, price, unit, description, is_active, created_at, updated_at) VALUES (` +
      `${sqlNum(t.id)}, ${sqlStr(t.name)}, ${sqlStr(t.nameLatin)}, ${sqlStr(t.category)}, ` +
      `${sqlNum(t.price)}, ${sqlStr(t.unit)}, ${sqlStr(t.description)}, ${sqlBool(t.isActive)}, ` +
      `${sqlTs(t.createdAt)}, ${sqlTs(t.updatedAt)});`
    );
  }
  console.log('');

  // ── orders ───────────────────────────────────────────────────────────────
  const { rows: orders } = await client.query(`
    SELECT id, "receiptNumber", "totalAmount", "customerName", "customerPhone",
           note, "paymentMethod", status, "createdAt"
    FROM orders
    ORDER BY id
  `);
  console.error(`-- Found ${orders.length} orders`);

  console.log('-- ─── Orders ──────────────────────────────────────────────────');
  for (const o of orders) {
    console.log(
      `INSERT INTO orders (id, receipt_number, total_amount, customer_name, customer_phone, note, payment_method, status, created_at) VALUES (` +
      `${sqlNum(o.id)}, ${sqlStr(o.receiptNumber)}, ${sqlNum(o.totalAmount)}, ${sqlStr(o.customerName)}, ` +
      `${sqlStr(o.customerPhone)}, ${sqlStr(o.note)}, ${sqlStr(o.paymentMethod || 'cash')}, ` +
      `${sqlStr(o.status || 'completed')}, ${sqlTs(o.createdAt)});`
    );
  }
  console.log('');

  // ── order_items ──────────────────────────────────────────────────────────
  const { rows: items } = await client.query(`
    SELECT id, "orderId", "treeId", "treeName", "unitPrice", quantity, subtotal
    FROM order_items
    ORDER BY id
  `);
  console.error(`-- Found ${items.length} order_items`);

  console.log('-- ─── Order items ─────────────────────────────────────────────');
  for (const it of items) {
    console.log(
      `INSERT INTO order_items (id, order_id, tree_id, tree_name, unit_price, quantity, subtotal) VALUES (` +
      `${sqlNum(it.id)}, ${sqlNum(it.orderId)}, ${sqlNum(it.treeId)}, ${sqlStr(it.treeName)}, ` +
      `${sqlNum(it.unitPrice)}, ${sqlNum(it.quantity)}, ${sqlNum(it.subtotal)});`
    );
  }
  console.log('');

  // ── reset sequences ─────────────────────────────────────────────────────
  console.log('-- ─── Reset sequences ─────────────────────────────────────────');
  console.log(`SELECT setval('trees_id_seq',       (SELECT COALESCE(MAX(id), 0) FROM trees));`);
  console.log(`SELECT setval('orders_id_seq',      (SELECT COALESCE(MAX(id), 0) FROM orders));`);
  console.log(`SELECT setval('order_items_id_seq', (SELECT COALESCE(MAX(id), 0) FROM order_items));`);

  await client.end();
  console.error('-- Done');
}

main().catch((e) => { console.error(e); process.exit(1); });
