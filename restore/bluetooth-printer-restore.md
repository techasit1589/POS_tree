# Bluetooth Printer Restore Notes

เอกสารนี้อธิบายว่า Bluetooth printer ของ POS เคยทำงานอย่างไร และต้องเปิดอะไรกลับบ้างถ้าวันหนึ่งต้องการใช้ฟีเจอร์นี้อีกครั้ง

## ภาพรวมการทำงาน

- `frontend/src/context/PrinterContext.tsx` เป็นชั้นควบคุมการเชื่อมต่อ Web Bluetooth, เลือก characteristic ที่เขียนได้, และส่งข้อมูล ESC/POS
- `frontend/src/components/Settings/SettingsPage.tsx` ใช้สำหรับเชื่อมต่อ/ตัดการเชื่อมต่อเครื่องพิมพ์, ตั้งขนาดกระดาษ, และตั้ง codepage ภาษาไทย
- `frontend/src/components/POS/POSPage.tsx` เคยเรียกพิมพ์ใบเสร็จหลังบันทึกออเดอร์
- `frontend/src/components/History/HistoryPage.tsx` เคยเรียกพิมพ์ย้อนหลังจากใบเสร็จที่บันทึกแล้ว
- `frontend/src/App.tsx` เคยห่อทั้งแอปด้วย `PrinterProvider` และมี entry point ไปหน้า settings

## สถานะปัจจุบัน

- UI สำหรับ Bluetooth printer ถูกถอดออกจาก flow หลักแล้ว
- `App` ไม่ได้แสดงแท็บ settings
- `POS` และ `History` ไม่เรียกใช้งาน printer context แล้ว
- ไฟล์ support บางส่วนยังอยู่ใน repo เพื่อให้เปิดกลับได้ง่าย

## ถ้าจะเปิดกลับ

1. คืน `PrinterProvider` และ `usePrinter` ใน `frontend/src/App.tsx`
2. เปิดแท็บหรือปุ่มเข้าหน้า `SettingsPage`
3. คืนปุ่ม/handler พิมพ์ Bluetooth ใน `POSPage` และ `HistoryPage`
4. ตรวจให้แน่ใจว่า `PrinterContext` ยังถูก import และไม่มี import ค้างที่ unused
5. รัน `npm run build` ใน `frontend/`

## ข้อควรระวัง

- ฟีเจอร์นี้พึ่ง Web Bluetooth ของ browser และมักใช้ได้ดีบน Chrome/Edge หรือ Bluefy บน iOS
- การทดสอบต้องใช้เครื่องพิมพ์จริงหรืออย่างน้อย browser ที่รองรับ Web Bluetooth
- ถ้าจะทำให้ปลอดภัยจริง ควรทบทวน flow การเข้าถึงข้อมูลและการพิมพ์ร่วมกับ PIN gate อีกครั้ง

