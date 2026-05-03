# Dual Pricing (ราคาปลีก / ราคาส่ง) — Design Spec

Date: 2026-05-03

## Overview

Add wholesale pricing (`price_wholesale`) to the Tree product model. At POS, a per-transaction toggle lets the cashier select retail or wholesale mode, and searching for a tree auto-fills the price accordingly.

---

## 1. Database & Data Model

**Migration:**
```sql
ALTER TABLE trees ADD COLUMN price_wholesale NUMERIC(10,2);
```

- `NULL` means no wholesale price has been set for that product.
- Existing `price` field remains as-is (retail price).

**TypeScript `Tree` interface:**
```typescript
interface Tree {
  id: number;
  name: string;
  nameLatin?: string;
  category?: string;
  price: number;           // retail price
  priceWholesale?: number; // wholesale price, null = not set
  unit?: string;
  description?: string;
}
```

---

## 2. Product Management (TreesPage)

- Add/Edit form: add `ราคาส่ง (บาท)` input below `ราคาปลีก (บาท)`, optional (not required).
- If left blank → saved as `null`.
- Trees list table: add a `ราคาส่ง` column.
- **Price display format on this page only:** no ฿ symbol, strip `.00` for whole numbers (e.g., `100` not `฿100.00`, but `99.50` stays `99.50`).

---

## 3. POS Page

- Add a **ปลีก / ส่ง** toggle button, placed near the price-related controls (next to ราคาอิสระ toggle).
- Default mode: **ปลีก**.
- When a tree is selected from search:
  - ปลีก mode → fills `price` (retail)
  - ส่ง mode → fills `price_wholesale`; if `null`, leaves price field empty for manual entry
- Switching the toggle after items are already in the cart does **not** retroactively change their prices — only affects newly added items.

---

## 4. API & Backend

| Endpoint | Change |
|---|---|
| `GET /trees` | Return `price_wholesale` field |
| `POST /trees` | Accept optional `price_wholesale` |
| `PUT /trees/:id` | Accept optional `price_wholesale` |
| `create_order` RPC | No change — `unit_price` captures price at sale time |

Receipt and order history are unchanged.

---

## Out of Scope

- Price type (ปลีก/ส่ง) is not printed on receipts.
- No changes to receipt or order history formatting.
- Price display format change is TreesPage only, not system-wide.
