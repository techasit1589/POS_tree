/**
 * PrinterContext — จัดการการเชื่อมต่อ Bluetooth Thermal Printer
 * ใช้ Web Bluetooth API (รองรับเฉพาะ Chrome / Edge)
 *
 * BLE Service UUIDs ที่รองรับ (เครื่องพิมพ์ BLE ทั่วไป):
 *   - 000018f0-0000-1000-8000-00805f9b34fb  (iposprinter, xprinter, จีนทั่วไป)
 *   - e7810a71-73ae-499d-8c15-faa9aef0c3f2  (บางรุ่น)
 */

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import type { CartItem, Order } from '../types';
import { buildReceipt, EscPos, type PaperSize } from '../utils/escpos';

// ── Known BLE printer service / characteristic UUIDs ──
const KNOWN_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

const KNOWN_CHARS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
];

// ── Types ──
export type PrinterStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface PrinterState {
  status: PrinterStatus;
  deviceName: string | null;
  paperSize: PaperSize;
  errorMessage: string | null;
}

interface PrinterContextValue extends PrinterState {
  connect: () => Promise<void>;
  disconnect: () => void;
  printOrder: (order: Order, items: CartItem[], shopSettings: {
    shopName: string;
    shopSubtitle?: string;
    thankYouMessage?: string;
  }) => Promise<void>;
  printTest: () => Promise<void>;
  setPaperSize: (size: PaperSize) => void;
  isWebBluetoothSupported: boolean;
}

// ── Context ──
const PrinterContext = createContext<PrinterContextValue | null>(null);

export function usePrinter(): PrinterContextValue {
  const ctx = useContext(PrinterContext);
  if (!ctx) throw new Error('usePrinter ต้องใช้ภายใน <PrinterProvider>');
  return ctx;
}

// ── Provider ──
export function PrinterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PrinterState>({
    status: 'disconnected',
    deviceName: null,
    paperSize: (localStorage.getItem('bt_paper_size') as PaperSize) || '58mm',
    errorMessage: null,
  });

  // useRef เพื่อให้ characteristic/device ยังคงอยู่ข้ามทุก render
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);

  const isWebBluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  const setStatus = useCallback((patch: Partial<PrinterState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Connect ──
  const connect = useCallback(async () => {
    if (!isWebBluetoothSupported) {
      setStatus({ status: 'error', errorMessage: 'บราวเซอร์นี้ไม่รองรับ Web Bluetooth — ใช้ Chrome/Edge หรือ Bluefy (iOS)' });
      return;
    }

    setStatus({ status: 'connecting', errorMessage: null });

    try {
      const device: BluetoothDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_SERVICES,
      });

      deviceRef.current = device;

      device.addEventListener('gattserverdisconnected', () => {
        characteristicRef.current = null;
        setStatus({ status: 'disconnected', deviceName: null });
      });

      const server = await device.gatt!.connect();

      // ลอง service UUIDs ที่รู้จักทีละอัน
      let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

      for (const serviceUuid of KNOWN_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          for (const charUuid of KNOWN_CHARS) {
            try {
              characteristic = await service.getCharacteristic(charUuid);
              break;
            } catch { /* ลอง UUID ถัดไป */ }
          }
          if (characteristic) break;
        } catch { /* ลอง service ถัดไป */ }
      }

      if (!characteristic) {
        // Fallback: list ทั้งหมดแล้วเลือก characteristic ที่ write ได้
        const services = await server.getPrimaryServices();
        outer: for (const svc of services) {
          const chars = await svc.getCharacteristics();
          for (const ch of chars) {
            if (ch.properties.write || ch.properties.writeWithoutResponse) {
              characteristic = ch;
              break outer;
            }
          }
        }
      }

      if (!characteristic) {
        throw new Error('ไม่พบ Characteristic สำหรับพิมพ์ กรุณาตรวจสอบว่าเป็นเครื่องพิมพ์ BLE ESC/POS');
      }

      characteristicRef.current = characteristic;
      setStatus({ status: 'connected', deviceName: device.name || 'Bluetooth Printer' });

    } catch (err: unknown) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('User cancelled') || msg.includes('chosen by the user')) {
        setStatus({ status: 'disconnected', errorMessage: null });
      } else {
        setStatus({ status: 'error', errorMessage: msg });
      }
    }
  }, [isWebBluetoothSupported, setStatus]);

  // ── Disconnect ──
  const disconnect = useCallback(() => {
    deviceRef.current?.gatt?.disconnect();
    deviceRef.current = null;
    characteristicRef.current = null;
    setStatus({ status: 'disconnected', deviceName: null, errorMessage: null });
  }, [setStatus]);

  // ── Send bytes (chunked) ──
  const sendBytes = useCallback(async (data: Uint8Array) => {
    const char = characteristicRef.current;
    if (!char) throw new Error('ยังไม่ได้เชื่อมต่อเครื่องพิมพ์');

    // 128 bytes ต่อ chunk — ปลอดภัยสำหรับ BLE MTU บน iOS (Bluefy) และ Android
    // (default BLE MTU = 23 bytes, negotiate ได้สูงสุด ~512 แต่ iOS มักไม่ negotiate อัตโนมัติ)
    const CHUNK = 128;
    const useWithoutResponse = char.properties.writeWithoutResponse;

    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      if (useWithoutResponse) {
        await char.writeValueWithoutResponse(chunk);
        // writeWithoutResponse ไม่รอ ACK → ต้องให้ delay เพียงพอ
        // writeValue รอ ACK เองอยู่แล้ว ไม่ต้อง delay มาก
        if (i + CHUNK < data.length) await sleep(50);
      } else {
        await char.writeValue(chunk);
        if (i + CHUNK < data.length) await sleep(10);
      }
    }
  }, []);

  // ── Print Order ──
  const printOrder = useCallback(async (
    order: Order,
    items: CartItem[],
    shopSettings: { shopName: string; shopSubtitle?: string; thankYouMessage?: string },
  ) => {
    const createdAt = new Date(order.createdAt);
    const dateStr = createdAt.toLocaleDateString('th-TH');
    const timeStr = createdAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    const bytes = buildReceipt({
      shopName: shopSettings.shopName,
      shopSubtitle: shopSettings.shopSubtitle,
      thankYouMessage: shopSettings.thankYouMessage,
      receiptNumber: order.receiptNumber,
      customerName: order.customerName || undefined,
      dateStr,
      timeStr,
      items: items.map((i) => ({
        name: i.treeName,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        subtotal: i.unitPrice * i.quantity,
      })),
      total: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
      note: order.note || undefined,
      paperSize: state.paperSize,
    });

    await sendBytes(bytes);
  }, [sendBytes, state.paperSize]);

  // ── Test Print ──
  const printTest = useCallback(async () => {
    const doc = new EscPos()
      .init()
      .center()
      .boldOn()
      .println('=== TEST PRINT ===')
      .boldOff()
      .println('เครื่องพิมพ์ทำงานปกติ')
      .println(`กระดาษ: ${state.paperSize}`)
      .println(`อุปกรณ์: ${state.deviceName || '-'}`)
      .lf().lf().lf()
      .cut();

    await sendBytes(doc.build());
  }, [sendBytes, state.paperSize, state.deviceName]);

  // ── Paper Size ──
  const setPaperSize = useCallback((size: PaperSize) => {
    localStorage.setItem('bt_paper_size', size);
    setStatus({ paperSize: size });
  }, [setStatus]);

  return (
    <PrinterContext.Provider value={{
      ...state,
      connect,
      disconnect,
      printOrder,
      printTest,
      setPaperSize,
      isWebBluetoothSupported,
    }}>
      {children}
    </PrinterContext.Provider>
  );
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
