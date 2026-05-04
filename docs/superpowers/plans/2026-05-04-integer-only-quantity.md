# Integer-Only Quantity Input Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quantity inputs across POS create flow และ History edit flow ต้องรับเฉพาะจำนวนเต็ม ≥ 1 เท่านั้น เพื่อให้ตรงกับธุรกิจจริง (unit ในระบบทั้งหมด — ต้น/กระถาง/กอ/ถุง — เป็น discrete count) และตัดปัญหา display/save mismatch ที่เคยเกิดเมื่อผู้ใช้พิมพ์ทศนิยม

**Architecture:** ฟิกที่ต้นทาง (input) ไม่ใช่ปลายทาง (save) — strip ทุก non-digit ทันทีที่พิมพ์ + ใส่ `inputMode="numeric"` ให้ iOS ขึ้น keypad ตัวเลขล้วน → ลบ `Math.round` ที่ save handler ออกได้ เพราะ input รับประกันเป็น integer แล้ว

**Tech Stack:** React 18 + TypeScript, Tailwind CSS + inline styles, Vite

**Out of scope:** ราคาทั้ง `price`, `priceWholesale`, `unitPrice` ยังคงรับทศนิยม (฿49.50 มีอยู่จริง) ไม่แก้ pricing inputs

---

## Background

ปัจจุบันมีบัคที่แก้ด้วย workaround ใน commit `c7283df`:
- ผู้ใช้พิมพ์ qty `1.5` → display โชว์ ฿150 แต่ save ปัดเป็น 2 → DB เก็บ ฿200
- Workaround: sync display ให้ใช้ `Math.round` เหมือน save (display = ฿200 ทันที)

แผนนี้แก้ที่ต้นเหตุแทน — ป้องกันไม่ให้ทศนิยมเข้ามาตั้งแต่แรก แล้วลบ workaround ออก

---

## File Map

| File | Change |
|---|---|
| `frontend/src/components/History/HistoryPage.tsx` | Edit modal qty input + ลบ `Math.round` + ลบ `editItemQty` helper |
| `frontend/src/components/POS/LineItemRow.tsx` | Desktop qty input |
| `frontend/src/components/POS/LineItemRow.tsx` | Mobile qty input (ใน `LineItemRowMobile`) |

---

## Task 1: Integer-only quantity in HistoryPage edit modal

**File:** `frontend/src/components/History/HistoryPage.tsx`

- [ ] **Step 1: Strip ทศนิยมที่ qty input ใน edit modal**

หา input ที่ใช้แก้ quantity (ราว line 800):
```tsx
<input type="number" value={item.quantity} onChange={(e) => updateEditItem(item.localId, 'quantity', e.target.value)}
  placeholder="จำนวน" min="1"
  className="w-16 shrink-0 px-2 py-1.5 ..." />
```

แทนด้วย:
```tsx
<input type="number" inputMode="numeric" pattern="[0-9]*" step="1"
  value={item.quantity}
  onChange={(e) => updateEditItem(item.localId, 'quantity', e.target.value.replace(/\D/g, ''))}
  placeholder="จำนวน" min="1"
  className="w-16 shrink-0 px-2 py-1.5 ..." />
```

ที่เพิ่ม:
- `inputMode="numeric"` — iOS Safari ขึ้น keypad ตัวเลขล้วน
- `pattern="[0-9]*"` — fallback สำหรับ iOS เก่า
- `step="1"` — spinner desktop ขยับทีละ 1
- `replace(/\D/g, '')` — กรอง non-digit (รวมจุด, เครื่องหมายลบ, paste ที่มีอักษร) ใน onChange

- [ ] **Step 2: ลบ `Math.round` ใน save handler**

ใน `handleSaveEdit` (ราว line 280):
```ts
items: editItems.map((i) => ({
  treeName: i.treeName.trim(),
  treeId: i.treeId,
  unitPrice: Number(i.unitPrice),
  quantity: Math.round(Number(i.quantity)),  // ← ลบ Math.round
})),
```

แทนด้วย:
```ts
items: editItems.map((i) => ({
  treeName: i.treeName.trim(),
  treeId: i.treeId,
  unitPrice: Number(i.unitPrice),
  quantity: Number(i.quantity),
})),
```

- [ ] **Step 3: Simplify validation**

ใน `handleSaveEdit` (ราว line 268-272):
```ts
for (const it of editItems) {
  if (!it.treeName.trim())               return setEditError('กรุณากรอกชื่อต้นไม้ทุกรายการ');
  if (isNaN(Number(it.unitPrice)) || Number(it.unitPrice) <= 0) return setEditError('ราคาต้องเป็นตัวเลขมากกว่า 0');
  // ตรวจหลัง round เพราะค่าทศนิยม < 0.5 จะถูกปัดเป็น 0 ทำให้บันทึกจำนวน 0 ได้
  const qty = Math.round(Number(it.quantity));
  if (isNaN(qty) || qty < 1) return setEditError('จำนวนต้องเป็นจำนวนเต็มอย่างน้อย 1');
}
```

แทนด้วย (ลบ comment เกี่ยวกับ round, ลบตัวแปร qty):
```ts
for (const it of editItems) {
  if (!it.treeName.trim())               return setEditError('กรุณากรอกชื่อต้นไม้ทุกรายการ');
  if (isNaN(Number(it.unitPrice)) || Number(it.unitPrice) <= 0) return setEditError('ราคาต้องเป็นตัวเลขมากกว่า 0');
  if (!Number.isInteger(Number(it.quantity)) || Number(it.quantity) < 1) return setEditError('จำนวนต้องเป็นจำนวนเต็มอย่างน้อย 1');
}
```

- [ ] **Step 4: ลบ `editItemQty` helper และ inline ค่าตรงๆ**

ใน HistoryPage (ราว line 296-298):
```ts
// ใช้ qty หลัง round เพื่อให้ยอดที่โชว์ตรงกับที่บันทึกจริง (save ใช้ Math.round)
const editItemQty = (i: EditItem) => Math.max(0, Math.round(Number(i.quantity) || 0));
const editTotal = editItems.reduce((s, i) => s + (Number(i.unitPrice) || 0) * editItemQty(i), 0);
```

แทนด้วย:
```ts
const editTotal = editItems.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.quantity) || 0), 0);
```

ใน per-row subtotal display (ราว line 819):
```tsx
<span className="flex-1 text-sm font-medium text-forest-700 text-right">
  ฿{fmt((Number(item.unitPrice) || 0) * editItemQty(item))}
</span>
```

แทนด้วย:
```tsx
<span className="flex-1 text-sm font-medium text-forest-700 text-right">
  ฿{fmt((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0))}
</span>
```

- [ ] **Verify Task 1:** เปิด edit modal บนใบเสร็จเดิม → ลองพิมพ์ `1.5` ในช่องจำนวน → ต้องไม่ให้พิมพ์จุดเลย (ถูก strip ทันที) → กรอก qty=2 → ยอดรวมและ subtotal ต่อแถวตรงกับที่บันทึก → กด save → DB เก็บ qty=2

---

## Task 2: Integer-only quantity in POS LineItemRow (desktop)

**File:** `frontend/src/components/POS/LineItemRow.tsx`

- [ ] **Step 1: Strip ทศนิยมที่ qty input (desktop)**

หา qty input ใน `LineItemRow` (ราว line 140-146):
```tsx
<input
  type="number"
  min="0"
  value={item.qty}
  onChange={(e) => onUpdate(idx, { ...item, qty: e.target.value })}
  className="w-full border ..."
/>
```

แทนด้วย:
```tsx
<input
  type="number"
  inputMode="numeric"
  pattern="[0-9]*"
  step="1"
  min="0"
  value={item.qty}
  onChange={(e) => onUpdate(idx, { ...item, qty: e.target.value.replace(/\D/g, '') })}
  className="w-full border ..."
/>
```

- [ ] **Verify Task 2:** เปิดหน้า POS บน desktop → พิมพ์ qty `2.5` → ตัวจุดต้องไม่ติด → spinner กดทีละ 1 → calculate subtotal ทำงานถูก

---

## Task 3: Integer-only quantity in POS LineItemRow (mobile)

**File:** `frontend/src/components/POS/LineItemRow.tsx` (function `LineItemRowMobile`)

- [ ] **Step 1: Strip ทศนิยมที่ qty input (mobile)**

หา qty input ใน `LineItemRowMobile` (ราว line 269):
```tsx
<input type="number" min="0" value={item.qty} onChange={(e) => onUpdate(idx, { ...item, qty: e.target.value })}
  className="w-[72px] border border-[var(--rule)] bg-white p-2 rounded-[7px] font-[var(--font-mono)] text-[16px] outline-none text-center" />
```

แทนด้วย:
```tsx
<input type="number" inputMode="numeric" pattern="[0-9]*" step="1" min="0" value={item.qty}
  onChange={(e) => onUpdate(idx, { ...item, qty: e.target.value.replace(/\D/g, '') })}
  className="w-[72px] border border-[var(--rule)] bg-white p-2 rounded-[7px] font-[var(--font-mono)] text-[16px] outline-none text-center" />
```

- [ ] **Verify Task 3:** เปิดหน้า POS บนมือถือจริง (หรือ DevTools mobile mode) → tap ช่องจำนวน → keyboard ที่ขึ้นต้องเป็น numeric pad ไม่ใช่ full keyboard

---

## Task 4: ตรวจ POSPage save handler

**File:** `frontend/src/components/POS/POSPage.tsx`

- [ ] **Step 1: ดูว่ามี Math.round ที่ qty ตอน createOrder หรือไม่**

Grep `Math.round` ใน POSPage — ถ้ามีและ wrap `qty` แสดงว่ามี logic เหมือน HistoryPage edit ลบออก เพราะ input รับประกัน integer แล้ว

ถ้าไม่มี → skip (เป็นเพราะ POSPage validate qty เข้มอยู่แล้วหรือ implicit number coercion)

- [ ] **Verify Task 4:** ขายของผ่าน POS หนึ่งบิล → ตรวจ DB ว่า `quantity` เก็บเป็น integer

---

## Risks & Rollback

**Risks:**
- ผู้ใช้คุ้นชินกับการ paste qty จาก clipboard — ถ้า paste `1.5` จะกลายเป็น `15` (จุดถูก strip) อาจทำให้สับสน
  - Mitigation: ในธุรกิจขายต้นไม้ไม่น่ามี use case paste qty จากที่อื่น

**Rollback:** Revert 1-3 commits ที่เกิดจากแผนนี้ — เพราะแก้แค่ input behavior ไม่กระทบ DB schema หรือ API contract

**Dependency on existing fix:** แผนนี้มาทับ commit `c7283df` (sync display+save) — เมื่อทำเสร็จ commit นั้นกลายเป็น dead code (lib `editItemQty` ถูกลบใน Task 1 Step 4) ซึ่งถูกต้องตาม plan

---

## Success Criteria

- [ ] HistoryPage edit modal: พิมพ์จุดในช่อง qty ไม่ติด, paste `1.5` → กลายเป็น `15`
- [ ] POSPage create flow ทั้ง desktop + mobile: เหมือนกัน
- [ ] iOS keyboard ขึ้น numeric pad เมื่อ focus ช่อง qty
- [ ] ลบ `Math.round` และ `editItemQty` ออกได้โดยไม่มีบัคใหม่
- [ ] Type-check ผ่าน
- [ ] ทดสอบขายของจริง 1 บิล + แก้ใบเสร็จย้อนหลัง 1 ใบ → DB เก็บ qty เป็น integer
