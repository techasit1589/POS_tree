import { Bluetooth, BluetoothConnected, BluetoothOff, Printer, AlertTriangle, CheckCircle2, Loader2, Unplug, FlaskConical } from 'lucide-react';
import { usePrinter } from '../../context/PrinterContext';
import type { PaperSize } from '../../utils/escpos';

export default function SettingsPage() {
  const {
    status, deviceName, paperSize, codepage, errorMessage,
    isWebBluetoothSupported, connect, disconnect, printTest,
    setPaperSize, setCodepage,
  } = usePrinter();

  const CODEPAGE_OPTIONS = [
    { value: 0x14, label: '0x14 — TIS-620 มาตรฐาน', desc: 'XPrinter / iposprinter ส่วนใหญ่' },
    { value: 0xFF, label: '0xFF — Vendor-specific',  desc: 'XPrinter บางรุ่น' },
    { value: 0x1B, label: '0x1B — Thai alt',         desc: 'บางรุ่นที่ไม่ใช่มาตรฐาน' },
    { value: 0x15, label: '0x15 — CP 21',            desc: 'ลองถ้า 3 ตัวบนไม่ได้ผล' },
  ];

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  return (
    <div className="max-w-xl mx-auto space-y-6">

      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Printer size={22} className="text-forest-600" />
          ตั้งค่าเครื่องพิมพ์
        </h2>
        <p className="text-sm text-gray-500 mt-1">เชื่อมต่อเครื่องพิมพ์ความร้อน (Thermal) ผ่าน Bluetooth</p>
      </div>

      {!isWebBluetoothSupported && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="font-semibold text-amber-800 text-sm">บราวเซอร์ไม่รองรับ Bluetooth</p>
            <p className="text-xs text-amber-700">
              <strong>Android / Windows / Mac</strong> — ใช้ <strong>Google Chrome</strong> หรือ <strong>Microsoft Edge</strong>
            </p>
            <p className="text-xs text-amber-700">
              <strong>iPhone / iPad (iOS)</strong> — Safari ไม่รองรับ Web Bluetooth กรุณาเปิดแอป{' '}
              <strong><a href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055" target="_blank" rel="noopener noreferrer" className="underline">Bluefy</a></strong>{' '}
              แล้วเปิดเว็บนี้ในแอปนั้น
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <Bluetooth size={16} className="text-forest-600" />
            การเชื่อมต่อ Bluetooth
          </h3>
          <StatusBadge status={status} />
        </div>
        <div className="px-6 py-5 space-y-4">
          {isConnected && deviceName && (
            <div className="flex items-center gap-3 bg-forest-50 border border-forest-200 rounded-xl px-4 py-3">
              <BluetoothConnected size={18} className="text-forest-600" />
              <div>
                <p className="text-xs text-forest-600 font-medium">เชื่อมต่อแล้ว</p>
                <p className="text-sm font-bold text-forest-800">{deviceName}</p>
              </div>
            </div>
          )}
          {status === 'error' && errorMessage && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}
          <div className="flex gap-3">
            {!isConnected ? (
              <button onClick={connect} disabled={isConnecting || !isWebBluetoothSupported}
                className="flex-1 py-3 bg-forest-600 hover:bg-forest-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition">
                {isConnecting
                  ? <><Loader2 size={17} className="animate-spin" /> กำลังค้นหา...</>
                  : <><Bluetooth size={17} /> ค้นหาเครื่องพิมพ์</>}
              </button>
            ) : (
              <button onClick={disconnect}
                className="flex-1 py-3 bg-gray-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-gray-700 font-semibold rounded-xl border border-gray-200 flex items-center justify-center gap-2 transition">
                <Unplug size={17} /> ยกเลิกการเชื่อมต่อ
              </button>
            )}
            {isConnected && (
              <button onClick={printTest}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition"
                title="พิมพ์ทดสอบ">
                <FlaskConical size={17} /> ทดสอบ
              </button>
            )}
          </div>
          {!isConnected && !isConnecting && (
            <p className="text-xs text-gray-400 text-center">
              กดปุ่มด้านบนแล้วเลือกเครื่องพิมพ์จากรายการที่ปรากฏ<br />
              เครื่องพิมพ์ต้องเปิดอยู่และอยู่ในระยะ Bluetooth
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700">ขนาดกระดาษ</h3>
          <p className="text-xs text-gray-400 mt-0.5">เลือกให้ตรงกับม้วนกระดาษที่ใส่ในเครื่องพิมพ์</p>
        </div>
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            {(['58mm', '80mm'] as PaperSize[]).map((size) => (
              <button key={size} onClick={() => setPaperSize(size)}
                className={`py-4 rounded-xl border-2 font-semibold text-sm transition flex flex-col items-center gap-1 ${
                  paperSize === size ? 'border-forest-500 bg-forest-50 text-forest-700' : 'border-gray-200 text-gray-500 hover:border-forest-300'
                }`}>
                <PaperIcon width={size === '58mm' ? 20 : 28} />
                <span>{size}</span>
                <span className="text-xs font-normal opacity-70">
                  {size === '58mm' ? '32 ตัวอักษร/บรรทัด' : '48 ตัวอักษร/บรรทัด'}
                </span>
                {paperSize === size && <CheckCircle2 size={14} className="text-forest-500" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700">Codepage ภาษาไทย</h3>
          <p className="text-xs text-gray-400 mt-0.5">ถ้าภาษาไทยพิมพ์ออกมามั่ว ลองเปลี่ยนค่านี้แล้วกดทดสอบ</p>
        </div>
        <div className="px-6 py-5 space-y-2">
          {CODEPAGE_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setCodepage(opt.value)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition flex items-center justify-between gap-3 ${
                codepage === opt.value ? 'border-forest-500 bg-forest-50' : 'border-gray-200 hover:border-forest-300'
              }`}>
              <div>
                <p className={`text-sm font-semibold font-mono ${codepage === opt.value ? 'text-forest-700' : 'text-gray-700'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
              </div>
              {codepage === opt.value && <CheckCircle2 size={16} className="text-forest-500 shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-6 py-5 space-y-2">
        <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
          <BluetoothOff size={15} /> รองรับเครื่องพิมพ์ประเภทไหน?
        </p>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>เครื่องพิมพ์ความร้อน (Thermal) ที่รองรับ <strong>Bluetooth BLE</strong></li>
          <li>โปรโตคอล ESC/POS (ส่วนใหญ่ของเครื่องพิมพ์ POS ทั่วไป)</li>
          <li>ยี่ห้อที่รองรับ: Xprinter, iposprinter, GOOJPRT, Rongta</li>
          <li><strong>ไม่รองรับ</strong> Bluetooth Classic (SPP) — ต้องเชื่อมผ่าน OS แทน</li>
        </ul>
      </div>

    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    connected:    { color: 'bg-green-100 text-green-700', label: 'เชื่อมต่อแล้ว' },
    connecting:   { color: 'bg-blue-100 text-blue-600',  label: 'กำลังเชื่อมต่อ...' },
    disconnected: { color: 'bg-gray-100 text-gray-500',  label: 'ไม่ได้เชื่อมต่อ' },
    error:        { color: 'bg-red-100 text-red-600',    label: 'เกิดข้อผิดพลาด' },
  };
  const { color, label } = map[status] ?? map.disconnected;
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>{label}</span>;
}

function PaperIcon({ width }: { width: number }) {
  return (
    <svg width={width} height={32} viewBox={`0 0 ${width} 32`} fill="none" className="opacity-60">
      <rect x="1" y="1" width={width - 2} height={30} rx="2" stroke="currentColor" strokeWidth="1.5" />
      {[6, 10, 14, 18, 22].map((y) => (
        <line key={y} x1="4" y1={y} x2={width - 4} y2={y} stroke="currentColor" strokeWidth="1" />
      ))}
    </svg>
  );
}
