import { forwardRef } from 'react';
import type { CartItem, Order } from '../../types';

export interface ReceiptSettings {
  shopName: string;
  shopSubtitle: string;
  thankYouMessage: string;
}

export const DEFAULT_SETTINGS: ReceiptSettings = {
  shopName: 'ร้านต้นไม้',
  shopSubtitle: 'จำหน่ายต้นไม้และพันธุ์ไม้ทุกชนิด',
  thankYouMessage: 'ขอบคุณที่ใช้บริการ 🌿',
};

interface Props {
  items: CartItem[];
  order?: Order;
  customerName?: string;
  settings?: ReceiptSettings;
}

const Receipt = forwardRef<HTMLDivElement, Props>(({
  items, order, customerName, settings = DEFAULT_SETTINGS,
}, ref) => {
  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  return (
    <div ref={ref} id="receipt-print-area" className="bg-white border border-gray-200 rounded-xl p-6 text-sm shadow-sm">
      {/* Header */}
      <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
        <div className="text-2xl mb-1">🌳</div>
        <h2 className="text-lg font-bold text-forest-800">{settings.shopName}</h2>
        {settings.shopSubtitle && (
          <p className="text-gray-400 text-xs mt-0.5 whitespace-pre-line">{settings.shopSubtitle}</p>
        )}
        <p className="text-gray-500 text-xs mt-1">ใบเสร็จรับเงิน</p>
        {(customerName || order?.customerName) && (
          <p className="text-sm font-semibold text-gray-700 mt-2">
            👤 {customerName || order?.customerName}
          </p>
        )}
        {order && (
          <p className="text-xs font-mono text-gray-600 mt-1">เลขที่: {order.receiptNumber}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">{dateStr} เวลา {timeStr} น.</p>
      </div>

      {/* Items */}
      <div className="mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-1 font-semibold text-gray-600">รายการ</th>
              <th className="text-center py-1 font-semibold text-gray-600">จำนวน</th>
              <th className="text-right py-1 font-semibold text-gray-600">ราคา/หน่วย</th>
              <th className="text-right py-1 font-semibold text-gray-600">รวม</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id || idx} className="border-b border-gray-100">
                <td className="py-1.5 text-gray-800">{item.treeName}</td>
                <td className="py-1.5 text-center text-gray-600">{item.quantity} {item.unit || 'ต้น'}</td>
                <td className="py-1.5 text-right text-gray-600">฿{Number(item.unitPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                <td className="py-1.5 text-right font-medium text-gray-800">
                  ฿{(item.unitPrice * item.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div className="border-t-2 border-gray-800 pt-3">
        <div className="flex justify-between items-center">
          <span className="font-bold text-gray-700">รวมทั้งสิ้น</span>
          <span className="text-xl font-bold text-forest-700">
            ฿{total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-dashed border-gray-300 text-center text-xs text-gray-400">
        <p className="whitespace-pre-line">{settings.thankYouMessage}</p>
        <p>กรุณาเก็บใบเสร็จไว้เป็นหลักฐาน</p>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';
export default Receipt;
