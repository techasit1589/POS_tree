import { forwardRef } from 'react';
import type { LineItem } from './LineItemRow';
import type { Order } from '../../types';

export interface POSSettings {
  shopName: string;
  shopTagline: string;
  shopContact: string;
  thanksMsg: string;
  showLogo: boolean;
  layout: 'wide' | 'balanced' | 'narrow';
}

export const DEFAULT_POS_SETTINGS: POSSettings = {
  shopName: 'ร้านพีท-ภีมพันธุ์ไม้',
  shopTagline: 'ไม้ดอก · ไม้ประดับ · ต้นไม้ป่า',
  shopContact: 'ต.บางพึ่ง อ.บ้านหมี่ จ.ลพบุรี\n089-982-5167',
  thanksMsg: 'ขอบคุณที่อุดหนุน',
  showLogo: false,
  layout: 'balanced',
};

export function loadPOSSettings(): POSSettings {
  try {
    const raw = localStorage.getItem('posSettings');
    if (raw) return { ...DEFAULT_POS_SETTINGS, ...JSON.parse(raw) };
    // Migrate from old receiptSettings
    const old = localStorage.getItem('receiptSettings');
    if (old) {
      const o = JSON.parse(old);
      return {
        ...DEFAULT_POS_SETTINGS,
        shopName: o.shopName || DEFAULT_POS_SETTINGS.shopName,
        shopTagline: o.shopSubtitle || DEFAULT_POS_SETTINGS.shopTagline,
        thanksMsg: o.thankYouMessage || DEFAULT_POS_SETTINGS.thanksMsg,
      };
    }
  } catch { /* empty */ }
  return { ...DEFAULT_POS_SETTINGS };
}

export function savePOSSettings(s: POSSettings) {
  localStorage.setItem('posSettings', JSON.stringify(s));
}

interface Props {
  items: LineItem[];
  customerName: string;
  customerPhone: string;
  payment: 'cash' | 'transfer';
  note: string;
  discount?: number;
  settings: POSSettings;
  receiptNo: string;
  order?: Order | null;
}

const LeafLogo = () => (
  <svg viewBox="0 0 64 64" width="52" height="52" fill="none">
    <circle cx="32" cy="32" r="30" stroke="#5C6B3F" strokeWidth="1.5"/>
    <path d="M32 48 C32 30, 20 22, 14 22 C14 32, 20 46, 32 48Z" fill="#5C6B3F" opacity="0.85"/>
    <path d="M32 48 C32 30, 44 22, 50 22 C50 32, 44 46, 32 48Z" fill="#7A8A55" opacity="0.7"/>
    <path d="M32 48 V18" stroke="#3E4A2A" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const ReceiptPaper = forwardRef<HTMLDivElement, Props>(function ReceiptPaper(
  { items, customerName, customerPhone, payment, note, discount = 0, settings, receiptNo, order },
  ref,
) {
  const validItems = items.filter((i) => i.name && Number(i.qty) > 0);
  const subtotal = validItems.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  const total = Math.max(0, subtotal - discount);

  const now = order?.createdAt ? new Date(order.createdAt) : new Date();
  const d = now;
  const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const thYear = (d.getFullYear() + 543) % 100;
  const dateStr = `${d.getDate()} ${thMonths[d.getMonth()]} ${thYear}`;
  const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

  const payLabel = payment === 'cash' ? 'เงินสด' : 'โอนเงิน';
  const isNarrow = settings.layout === 'narrow';
  const fmt = (n: number) => Number.isInteger(n)
    ? n.toLocaleString('th-TH')
    : n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const paperStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: isNarrow ? '380px' : '520px',
    background: 'var(--paper)',
    padding: isNarrow ? '36px 28px 32px' : '48px 44px 40px',
    boxShadow: '0 1px 2px rgba(28,46,26,0.12), 0 14px 44px rgba(28,46,26,0.25), 0 34px 70px rgba(28,46,26,0.16)',
    position: 'relative',
    fontFamily: 'var(--font-receipt)',
    color: 'var(--ink)',
    overflow: 'visible',
    borderRadius: '2px',
  };

  return (
    <div ref={ref} id="receipt-print-area" style={paperStyle}>
      {/* Perforation top */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: '8px',
        backgroundImage: 'radial-gradient(circle at 6px 4px, #EEF2E4 2.5px, transparent 3px)',
        backgroundSize: '12px 8px', backgroundRepeat: 'repeat-x', backgroundPosition: '0 -4px',
      }} />
      {/* Perforation bottom */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '8px',
        backgroundImage: 'radial-gradient(circle at 6px 4px, #EEF2E4 2.5px, transparent 3px)',
        backgroundSize: '12px 8px', backgroundRepeat: 'repeat-x', backgroundPosition: '0 4px',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '10px', marginBottom: '22px' }}>
        {settings.showLogo && <LeafLogo />}
        <div>
          <div style={{ fontSize: isNarrow ? '19px' : '22px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.15 }}>
            {settings.shopName}
          </div>
          {settings.shopTagline && (
            <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', marginTop: '3px' }}>{settings.shopTagline}</div>
          )}
          {settings.shopContact && (
            <div style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: '4px', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em', whiteSpace: 'pre-line' }}>
              {settings.shopContact}
            </div>
          )}
        </div>
      </div>

      {/* Divider stamp */}
      <div style={{ position: 'relative', margin: '20px -4px 20px', textAlign: 'center', borderTop: '1px dashed var(--rule)' }}>
        <span style={{
          position: 'relative', top: '-10px', background: 'var(--paper)', padding: '0 12px',
          fontSize: '10.5px', letterSpacing: '0.25em', color: 'var(--clay-d)',
          textTransform: 'uppercase', fontWeight: 700, fontFamily: 'var(--font-mono)',
        }}>
          ใบเสร็จรับเงิน / RECEIPT
        </span>
      </div>

      {/* Meta grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 14px',
        marginBottom: '22px', padding: '10px 0',
        borderTop: '1px solid var(--rule-soft)', borderBottom: '1px solid var(--rule-soft)',
      }}>
        <MetaCell label="เลขที่" value={order?.receiptNumber || receiptNo} mono />
        <MetaCell label="วันที่" value={dateStr} />
        <MetaCell label="เวลา" value={timeStr} mono />
        <div style={{ gridColumn: '1 / -1', marginTop: '4px', paddingTop: '8px', borderTop: '1px dashed var(--rule-soft)' }}>
          <div style={{ fontSize: '10px', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1px' }}>ลูกค้า</div>
          <div style={{ fontSize: '13px', color: 'var(--ink)' }}>
            {customerName || <span style={{ color: 'var(--ink-4)', fontStyle: 'italic' }}>—</span>}
            {customerPhone && <span style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}> · {customerPhone}</span>}
          </div>
        </div>
      </div>

      {/* Items table */}
      <div style={{ marginBottom: '16px' }}>
        {validItems.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '12.5px', color: 'var(--ink-3)' }}>ยังไม่มีรายการ — เริ่มพิมพ์ชื่อสินค้าที่ฟอร์มด้านซ้าย</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', columnGap: '10px' }}>
            {/* Header */}
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--clay-d)', fontWeight: 700, padding: '7px 0 6px', borderBottom: '1.5px solid var(--ink-2)' }}>รายการ</div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--clay-d)', fontWeight: 700, padding: '7px 0 6px', borderBottom: '1.5px solid var(--ink-2)', textAlign: 'right' }}>จำนวน</div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--clay-d)', fontWeight: 700, padding: '7px 0 6px', borderBottom: '1.5px solid var(--ink-2)', textAlign: 'right' }}>ราคา</div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--clay-d)', fontWeight: 700, padding: '7px 0 6px', borderBottom: '1.5px solid var(--ink-2)', textAlign: 'right' }}>รวม</div>

            {/* Data rows */}
            {validItems.map((it, i) => {
              const lineTotal = (Number(it.qty) || 0) * (Number(it.price) || 0);
              const borderStyle = '1px dotted var(--rule-soft)';
              return [
                <div key={`n-${i}`} style={{ color: 'var(--ink)', fontSize: '12.5px', lineHeight: 1.3, padding: '7px 0', borderBottom: borderStyle, overflowWrap: 'break-word', wordBreak: 'normal', minWidth: 0 }}>{it.name}</div>,
                <div key={`q-${i}`} style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12.5px', padding: '7px 0', borderBottom: borderStyle }}>{it.qty}</div>,
                <div key={`p-${i}`} style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12.5px', padding: '7px 0', borderBottom: borderStyle }}>{fmt(Number(it.price))}</div>,
                <div key={`t-${i}`} style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12.5px', padding: '7px 0', borderBottom: borderStyle }}>{fmt(lineTotal)}</div>,
              ];
            })}

          </div>
        )}
      </div>

      {/* Totals */}
      <div style={{ borderTop: '1.5px solid var(--ink-2)', paddingTop: '10px', marginTop: '8px' }}>
        <TotRow label={`ยอดรวม (${validItems.length} รายการ)`} value={`฿${fmt(subtotal)}`} />
        {discount > 0 && <TotRow label="ส่วนลด" value={`−฿${fmt(discount)}`} color="#B6452F" />}
        <div style={{
          display: 'flex', justifyContent: 'space-between', padding: '10px 0 5px',
          borderTop: '1px dashed var(--rule)', marginTop: '6px',
          fontSize: '18px', fontWeight: 700, color: 'var(--clay-d)',
        }}>
          <span>ยอดสุทธิ</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>฿{fmt(total)}</span>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', padding: '8px 0 5px',
          marginTop: '8px', borderTop: '1px dotted var(--rule-soft)',
          fontSize: '12px', color: 'var(--ink-3)',
        }}>
          <span>ชำระโดย</span>
          <span>{payLabel}</span>
        </div>
      </div>

      {/* Note */}
      {note && (
        <div style={{
          marginTop: '16px', padding: '10px 12px',
          background: 'rgba(179,138,46,0.12)', borderLeft: '3px solid var(--mustard)',
          borderRadius: '0 4px 4px 0',
        }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mustard)', marginBottom: '2px', fontWeight: 700 }}>หมายเหตุ</div>
          <div style={{ fontSize: '12.5px', color: 'var(--ink-2)' }}>{note}</div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: '1px dashed var(--rule)', textAlign: 'center' }}>
        {settings.thanksMsg && (
          <div style={{ fontSize: '13px', color: 'var(--ink-2)', letterSpacing: '0.08em', marginBottom: '4px', whiteSpace: 'pre-wrap' }}>
            — {settings.thanksMsg} —
          </div>
        )}
        <div style={{ fontSize: '10.5px', color: 'var(--ink-3)', marginBottom: '22px' }}>โปรดเก็บใบเสร็จไว้เป็นหลักฐาน</div>
      </div>

      {/* Paper grain overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.4,
        backgroundImage:
          'radial-gradient(circle at 20% 30%, rgba(62,122,58,0.1) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(138,154,91,0.1) 0%, transparent 40%)',
        mixBlendMode: 'multiply',
      }} />
    </div>
  );
});

function MetaCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1px' }}>{label}</div>
      <div style={{ fontSize: '12px', color: 'var(--ink)', fontFamily: mono ? 'var(--font-mono)' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

function TotRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '5px 0',
      fontSize: '13px', color: color || 'var(--ink-2)',
    }}>
      <span>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  );
}

export default ReceiptPaper;
