# POS Tree Shop

ระบบขายหน้าร้านสำหรับร้านต้นไม้/ไม้ประดับที่ใช้ React, Vite และ Supabase

## ภาพรวม

โปรเจคนี้แบ่งการใช้งานหลักเป็น 3 ส่วน:

- `POS` สำหรับออกใบเสร็จและบันทึกออเดอร์
- `Trees` สำหรับจัดการรายการต้นไม้/สินค้าและราคา
- `History` สำหรับดูประวัติใบเสร็จ แก้ไข ลบ และพิมพ์ซ้ำ

ฝั่งข้อมูลใช้ Supabase เป็น backend และเก็บโครงสร้างหลักไว้ใน `supabase/schema.sql`

## โครงสร้างโปรเจค

- `frontend/` - แอป React + Vite
- `supabase/` - schema และสคริปต์ที่เกี่ยวกับฐานข้อมูล
- `restore/` - เอกสารกู้คืน/แนวทางย้อนหลัง
- `docs/` - เอกสารแผนงานและสเปกภายใน

## ความต้องการ

- Node.js 18 ขึ้นไป
- npm
- Supabase project

## ตั้งค่าโปรเจค

1. เข้าโฟลเดอร์ frontend

   ```bash
   cd frontend
   ```

2. ติดตั้ง dependency

   ```bash
   npm install
   ```

3. สร้างไฟล์ `.env`

   คัดลอกจาก `frontend/.env.example` แล้วใส่ค่าจริง:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   APP_PIN=xxxxxx
   COOKIE_SECRET=replace-with-a-long-random-string
   ```

4. สร้างฐานข้อมูลใน Supabase

   เปิด `supabase/schema.sql` ใน Supabase SQL Editor แล้วรันไฟล์นี้

   ถ้าต้องการข้อมูลตัวอย่างหรือข้อมูลเริ่มต้น ให้ตรวจ `supabase/data.sql` เพิ่มเติมก่อนรัน

## รันโปรเจค

```bash
cd frontend
npm run dev
```

เปิดตาม URL ที่ Vite แสดงขึ้นมา

## สร้างไฟล์ production

```bash
cd frontend
npm run build
```

ถ้าต้องการพรีวิว build:

```bash
npm run preview
```

## วิธีปรับจำนวนใบเสร็จที่โหลดครั้งแรก

ค่าเริ่มต้นของหน้าประวัติใบเสร็จจะโหลดข้อมูลล่าสุดตาม `ORDERS_LIMIT`

1. เปิดไฟล์ `frontend/src/api/index.ts`
2. หาโค้ดนี้:

   ```typescript
   export const ORDERS_LIMIT = 500;
   ```

3. เปลี่ยนเลขตามขนาดร้าน

ค่าที่แนะนำ:

- `100` - ร้านที่เพิ่งเริ่ม
- `300` - ร้านที่ใช้มาสักพัก
- `500` - ร้านที่มีข้อมูลเยอะ

พฤติกรรมของหน้าประวัติ:

- ถ้าจำนวนใบเสร็จน้อยกว่าค่า limit ระบบจะแสดงยอดขายรวมและจำนวนใบเสร็จทั้งหมด
- ถ้าจำนวนใบเสร็จมากกว่าค่า limit ระบบจะแสดงยอดขายจากใบล่าสุดจำนวน X ใบ และมีปุ่มให้โหลดใบเสร็จทั้งหมด

หมายเหตุ: ยิ่งตั้ง limit สูง การโหลดครั้งแรกจะช้าขึ้นเล็กน้อย แต่กับร้านทั่วไปมักไม่รู้สึกต่างมาก

## หมายเหตุการใช้งาน

- แอปนี้พึ่งพา Supabase โดยตรง ดังนั้น `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ต้องถูกต้องเสมอ
- ถ้าใช้ PIN gate บน Vercel ให้ตั้ง `APP_PIN` และ `COOKIE_SECRET` ให้ตรงกับ environment ที่ deploy
- โครงสร้าง SQL หลักอยู่ใน `supabase/schema.sql`
