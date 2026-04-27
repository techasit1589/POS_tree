import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useSyncExternalStore } from 'react';

function useIsMobile() {
  const getSnapshot = () => window.innerWidth < 720;
  const subscribe = (cb: () => void) => {
    window.addEventListener('resize', cb);
    return () => window.removeEventListener('resize', cb);
  };
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
import { getAllTrees, createOrder, createTree } from '../../api';
import type { Tree, Order } from '../../types';
import LineItemRow, { LineItemRowMobile, emptyItem } from './LineItemRow';
import type { LineItem } from './LineItemRow';
import ReceiptPaper, { loadPOSSettings, savePOSSettings } from './ReceiptPaper';
import type { POSSettings } from './ReceiptPaper';
import { usePrinter } from '../../context/PrinterContext';
import type { CartItem } from '../../types';

// Generate receipt number preview: DDMMYY-NNNNN
function genReceiptNo(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  // เดิม 5 หลัก (1/90k ชน) → 7 หลัก (1/10M ชน): 200 บิล/วัน เจอชน ~0.2%
  const rnd = Math.floor(1000000 + Math.random() * 9000000);
  return `${dd}${mm}${yy}-${rnd}`;
}

function lineItemsToCart(items: LineItem[]): CartItem[] {
  return items
    .filter((i) => i.name && Number(i.qty) > 0)
    .map((i, idx) => ({
      id: String(idx),
      treeId: i.treeId,
      treeName: i.name,
      unitPrice: Number(i.price) || 0,
      quantity: Number(i.qty) || 1,
      unit: i.unit || 'ต้น',
    }));
}

export interface POSPageHandle {
  clear: () => void;
  submit: () => void;
  hasSavedOrder: () => boolean;
}

interface POSPageProps {
  onSavedOrderChange?: (saved: boolean) => void;
}

const POSPage = forwardRef<POSPageHandle, POSPageProps>(function POSPage({ onSavedOrderChange }, ref) {
  const [receiptNo, setReceiptNo] = useState(genReceiptNo);
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [payment, setPayment] = useState<'cash' | 'transfer'>('cash');
  const [note, setNote] = useState('');
  const [allTrees, setAllTrees] = useState<Tree[]>([]);
  const [settings, setSettings] = useState<POSSettings>(loadPOSSettings);
  const [draftSettings, setDraftSettings] = useState<POSSettings>(loadPOSSettings);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [saving, setSaving] = useState(false);
  const [savedOrder, setSavedOrder] = useState<Order | null>(null);

  // เพิ่มต้นไม้ใหม่
  const [showAddTree, setShowAddTree] = useState(false);
  const [addTreeForm, setAddTreeForm] = useState({ name: '', category: 'ไม้ผล', price: '', unit: 'ต้น' });
  const [addTreeSaving, setAddTreeSaving] = useState(false);
  const [addTreeError, setAddTreeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [btPrinting, setBtPrinting] = useState(false);
  const [btError, setBtError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { status: printerStatus, printOrder: btPrintOrder } = usePrinter();

  const isMobile = useIsMobile();

  // Load trees once
  useEffect(() => {
    getAllTrees().then(setAllTrees).catch(() => setAllTrees([]));
  }, []);

  // ESC to close settings modal
  useEffect(() => {
    if (!showSettingsModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowSettingsModal(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showSettingsModal]);

  const updateItem = useCallback((idx: number, next: LineItem) => {
    setItems((prev) => { const a = [...prev]; a[idx] = next; return a; });
  }, []);

  const removeItem = useCallback((idx: number) => {
    setItems((prev) => {
      const a = prev.filter((_, i) => i !== idx);
      return a.length ? a : [emptyItem()];
    });
  }, []);

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const handleAddTree = async () => {
    const price = parseFloat(addTreeForm.price);
    if (!addTreeForm.name.trim()) return setAddTreeError('กรุณาใส่ชื่อต้นไม้');
    if (isNaN(price) || price <= 0) return setAddTreeError('กรุณาใส่ราคาที่ถูกต้อง');
    setAddTreeSaving(true);
    setAddTreeError(null);
    try {
      const created = await createTree({
        name: addTreeForm.name.trim(),
        category: addTreeForm.category,
        price,
        unit: addTreeForm.unit,
      } as never);
      setAllTrees((prev) => [...prev, created]);
      setShowAddTree(false);
      setAddTreeForm({ name: '', category: 'ไม้ผล', price: '', unit: 'ต้น' });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setAddTreeError(typeof msg === 'string' ? msg : 'เกิดข้อผิดพลาด');
    } finally {
      setAddTreeSaving(false);
    }
  };

  const clear = () => {
    setShowErrors(false);
    setItems([emptyItem()]);
    setCustomerName('');
    setCustomerPhone('');
    setPayment('cash');
    setNote('');
    setSavedOrder(null);
    setError(null);
    setBtError(null);
    setReceiptNo(genReceiptNo());
    setMobileTab('form');
  };

  const submit = () => {
    const valid = items.filter((i) => i.name && Number(i.qty) > 0);
    if (valid.length === 0) { setShowErrors(true); setError('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'); return; }
    const missingPrice = valid.some((i) => !i.treeId && (!i.price || Number(i.price) <= 0));
    if (missingPrice) { setShowErrors(true); setError('กรุณาใส่ราคาสำหรับรายการที่ไม่มีในระบบ'); return; }
    setShowErrors(false);
    setError(null);
    setShowConfirm(true);
  };

  useImperativeHandle(ref, () => ({ clear, submit, hasSavedOrder: () => !!savedOrder }));

  useEffect(() => {
    onSavedOrderChange?.(!!savedOrder);
  }, [savedOrder, onSavedOrderChange]);

  // เคลียร์ error อัตโนมัติเมื่อเงื่อนไขผ่านแล้ว (ใช้ filter เดียวกับ submit)
  useEffect(() => {
    if (!showErrors) return;
    const valid = items.filter((i) => i.name && Number(i.qty) > 0);
    const hasItems = valid.length > 0;
    const missingPrice = valid.some((i) => !i.treeId && (!i.price || Number(i.price) <= 0));
    if (hasItems && !missingPrice) {
      setShowErrors(false);
      setError(null);
    }
  }, [items, showErrors]);

  const handleConfirm = async () => {
    setShowConfirm(false);
    setSaving(true);
    setError(null);
    try {
      const order = await createOrder({
        items: items
          .filter((i) => i.name && Number(i.qty) > 0)
          .map((i) => ({
            treeName: i.name,
            treeId: i.treeId,
            unitPrice: Number(i.price) || 0,
            quantity: Number(i.qty) || 1,
          })),
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        note: note.trim() || undefined,
        paymentMethod: payment,
      });
      setSavedOrder(order);
      setMobileTab('preview');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };


  const handleBtPrint = async () => {
    if (!savedOrder) return;
    setBtPrinting(true);
    setBtError(null);
    try {
      await btPrintOrder(savedOrder, lineItemsToCart(items), {
        shopName: settings.shopName,
        shopSubtitle: settings.shopTagline,
        thankYouMessage: settings.thanksMsg,
      });
    } catch (e: unknown) {
      setBtError((e as Error).message || 'พิมพ์ผ่าน Bluetooth ไม่สำเร็จ');
    } finally {
      setBtPrinting(false);
    }
  };

  const handleSaveImage = async () => {
    const element = receiptRef.current;
    if (!element) return;
    // รอให้ web fonts (Sarabun, IBM Plex Sans Thai) โหลดเสร็จก่อน capture
    // ไม่งั้น html2canvas จะใช้ system font แทนและตัวอักษรไทยบางตัวหาย
    await document.fonts.ready;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#F6F9EB',
      onclone: (_doc, el) => {
        // html2canvas ตัด overflow:hidden เข้มกว่า browser จริง
        // ทำให้สระบน/ล่างภาษาไทย (้ ่ ุ ู ฯลฯ) โดนตัดครึ่ง
        // แก้โดย override overflow ทุก element ใน clone ก่อน capture
        el.querySelectorAll<HTMLElement>('*').forEach((node) => {
          const s = node.style;
          if (s.overflow === 'hidden') s.overflow = 'visible';
          if (s.textOverflow === 'ellipsis') s.textOverflow = 'clip';
        });
      },
    });
    const filename = `receipt-${savedOrder?.receiptNumber || receiptNo}.png`;
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    if (navigator.share && navigator.canShare?.({ files: [new File([blob], filename, { type: 'image/png' })] })) {
      const file = new File([blob], filename, { type: 'image/png' });
      await navigator.share({ files: [file], title: 'ใบเสร็จ' });
    } else {
      const link = document.createElement('a');
      link.download = filename;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  const handleExportPDF = async () => {
    const element = receiptRef.current;
    if (!element) return;
    await document.fonts.ready;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html2pdf = ((await import('html2pdf.js')) as any).default;
    html2pdf().set({
      margin: 10,
      filename: `receipt-${savedOrder?.receiptNumber || receiptNo}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        onclone: (_doc: Document, el: HTMLElement) => {
          el.querySelectorAll<HTMLElement>('*').forEach((node) => {
            if (node.style.overflow === 'hidden') node.style.overflow = 'visible';
            if (node.style.textOverflow === 'ellipsis') node.style.textOverflow = 'clip';
          });
        },
      },
      jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' },
    }).from(element).save();
  };

  const openSettings = () => {
    setDraftSettings({ ...settings });
    setShowSettingsModal(true);
  };

  const saveSettings = () => {
    setSettings({ ...draftSettings });
    savePOSSettings(draftSettings);
    setShowSettingsModal(false);
  };

  const validItemCount = items.filter((i) => i.name && Number(i.qty) > 0).length;
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);

  // Shared receipt paper props
  const paperProps = {
    items,
    customerName,
    customerPhone,
    payment,
    note,
    settings,
    receiptNo,
    order: savedOrder,
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const s = {
    shell: {
      display: 'grid' as const,
      gridTemplateColumns: 'minmax(520px, 1fr) minmax(480px, 1fr)',
      minHeight: 'calc(100vh - 56px)',
      width: '100%',
      overflow: 'hidden' as const,
    } as React.CSSProperties,
    formPane: {
      padding: isMobile ? '20px 16px 110px' : '28px 32px 40px',
      overflowY: 'auto' as const,
      overflowX: 'hidden' as const,
      borderRight: '1px solid var(--rule-soft)',
      background: 'var(--cream-1)',
      minWidth: 0,
      pointerEvents: savedOrder ? 'none' as const : undefined,
      opacity: savedOrder ? 0.55 : 1,
      transition: 'opacity 0.2s',
    } as React.CSSProperties,
    section: { marginBottom: '32px' } as React.CSSProperties,
    sectionHead: { display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' } as React.CSSProperties,
    sectionNum: {
      fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--clay-d)',
      background: 'rgba(62,122,58,0.12)', border: '1px solid rgba(62,122,58,0.22)',
      padding: '4px 8px', borderRadius: '4px', marginTop: '2px',
      letterSpacing: '0.08em', fontWeight: 600,
    } as React.CSSProperties,
    sectionTitle: { fontSize: '17px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' } as React.CSSProperties,
    sectionSub: { fontSize: '12.5px', color: 'var(--ink-3)', marginTop: '2px' } as React.CSSProperties,
    fld: {
      appearance: 'none' as const,
      border: '1px solid var(--rule)',
      background: 'var(--cream-0)',
      padding: '10px 12px',
      borderRadius: '7px',
      fontFamily: 'var(--font-ui)',
      fontSize: '14px',
      color: 'var(--ink)',
      width: '100%',
      outline: 'none',
      transition: 'all 0.15s',
    } as React.CSSProperties,
    lbl: {
      fontSize: '11.5px', color: 'var(--ink-3)',
      textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 500,
      display: 'block', marginBottom: '6px',
    } as React.CSSProperties,
    previewPane: {
      overflowY: 'auto' as const,
      padding: '20px 32px 80px',
      position: 'relative' as const,
      background: 'radial-gradient(ellipse at 20% 10%, #8FAE6A 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, #557A3A 0%, transparent 55%), linear-gradient(135deg, #6F8F52 0%, #3E5F28 100%)',
    } as React.CSSProperties,
  };

  return (
    <>
      {/* Mobile tab switcher */}
      <div style={{
        display: isMobile ? 'flex' : 'none',
        background: 'var(--cream-0)', borderBottom: '1px solid var(--rule-soft)',
        padding: '8px 12px', gap: '6px',
        position: 'sticky', top: '56px', zIndex: 15,
      }}>
        {([['form', 'กรอกข้อมูล'], ['preview', 'ดูใบเสร็จ']] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: '8px',
              border: mobileTab === tab ? 'none' : '1px solid transparent',
              background: mobileTab === tab ? 'var(--clay)' : 'transparent',
              color: mobileTab === tab ? 'var(--cream-0)' : 'var(--ink-3)',
              fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              boxShadow: mobileTab === tab ? '0 2px 6px rgba(62,122,58,0.28)' : 'none',
            }}
          >
            {label}
            {tab === 'preview' && (
              <span style={{
                background: mobileTab === tab ? 'rgba(255,255,255,0.25)' : 'var(--cream-2)',
                color: mobileTab === tab ? 'inherit' : 'var(--ink-3)',
                padding: '1px 6px', borderRadius: '8px', fontSize: '11px',
                fontFamily: 'var(--font-mono)', marginLeft: '4px',
              }}>{validItemCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Main layout */}
      <div style={{ ...s.shell, gridTemplateColumns: isMobile ? '1fr' : s.shell.gridTemplateColumns }}>

        {/* ── Left: Form ── */}
        <div style={{ ...s.formPane, display: isMobile && mobileTab !== 'form' ? 'none' : undefined }}>

          {/* Locked notice */}
          {savedOrder && (
            <div style={{
              marginBottom: '20px', padding: '12px 14px',
              background: 'rgba(62,122,58,0.10)', border: '1px solid rgba(62,122,58,0.25)',
              borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px',
              fontSize: '13px', color: 'var(--clay-d)',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="4" y="7" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              ออกใบเสร็จแล้ว — กด <strong style={{ fontWeight: 600 }}>ออเดอร์ใหม่</strong> เพื่อเริ่มใหม่
            </div>
          )}

          {/* 01 Customer */}
          <div style={s.section}>
            <div style={s.sectionHead}>
              <div style={s.sectionNum}>01</div>
              <div>
                <div style={s.sectionTitle}>ข้อมูลลูกค้า</div>
                <div style={s.sectionSub}>กรอกเพื่อพิมพ์บนใบเสร็จ</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
              <label>
                <span style={s.lbl}>ชื่อลูกค้า <span style={{ fontWeight: 400, opacity: 0.6 }}>(ไม่บังคับ)</span></span>
                <input
                  style={s.fld}
                  placeholder="คุณ..."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--clay)'; e.target.style.boxShadow = '0 0 0 3px rgba(62,122,58,0.18)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--rule)'; e.target.style.boxShadow = 'none'; }}
                />
              </label>
              <label>
                <span style={s.lbl}>เบอร์โทร <span style={{ fontWeight: 400, opacity: 0.6 }}>(ไม่บังคับ)</span></span>
                <input
                  style={s.fld}
                  placeholder="08X-XXX-XXXX"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--clay)'; e.target.style.boxShadow = '0 0 0 3px rgba(62,122,58,0.18)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--rule)'; e.target.style.boxShadow = 'none'; }}
                />
              </label>
            </div>
          </div>

          {/* 02 Line Items */}
          <div style={s.section}>
            <div style={{ ...s.sectionHead, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={s.sectionNum}>02</div>
                <div>
                  <div style={s.sectionTitle}>รายการสินค้า</div>
                  <div style={s.sectionSub}>พิมพ์ชื่อเพื่อค้นหาจากสต็อก • Enter เพื่อเลือก</div>
                </div>
              </div>
              <button
                onClick={() => { setShowAddTree(true); setAddTreeError(null); setAddTreeForm({ name: '', category: 'ไม้ผล', price: '', unit: 'ต้น' }); }}
                style={{
                  appearance: 'none', border: '1px solid rgba(62,122,58,0.35)',
                  background: 'rgba(62,122,58,0.08)', color: 'var(--clay-d)',
                  padding: '6px 12px', borderRadius: '7px', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: '12.5px', fontWeight: 500,
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                เพิ่มต้นไม้ใหม่
              </button>
            </div>

            {/* Table (desktop) */}
            {!isMobile && (
              <div style={{ background: 'var(--cream-0)', border: '1px solid var(--rule-soft)', borderRadius: '10px', overflow: 'visible', marginBottom: '10px' }}>
                {/* Header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '28px 1fr 100px 110px 94px 28px',
                  alignItems: 'center', gap: '8px', padding: '10px 14px',
                  background: 'var(--cream-2)', borderBottom: '1px solid var(--rule-soft)',
                  fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: 'var(--ink-3)', fontWeight: 600, borderRadius: '10px 10px 0 0',
                }}>
                  <div>#</div><div>รายการ</div><div>จำนวน</div><div>ราคา/หน่วย</div><div style={{ textAlign: 'right' }}>รวม</div><div />
                </div>
                {items.map((it, i) => (
                  <LineItemRow
                    key={i}
                    item={it}
                    idx={i}
                    isLast={i === items.length - 1}
                    catalog={allTrees}
                    onUpdate={updateItem}
                    onRemove={removeItem}
                    showErrors={showErrors}
                  />
                ))}
              </div>
            )}

            {/* Card layout (mobile) */}
            {isMobile && (
              <div style={{ marginBottom: '10px' }}>
                {items.map((it, i) => (
                  <LineItemRowMobile
                    key={i}
                    item={it}
                    idx={i}
                    catalog={allTrees}
                    onUpdate={updateItem}
                    onRemove={removeItem}
                    showErrors={showErrors}
                  />
                ))}
              </div>
            )}

            <button
              onClick={addItem}
              style={{
                appearance: 'none', border: '1.5px dashed var(--rule)', background: 'transparent',
                color: 'var(--ink-3)', padding: '12px 14px', borderRadius: '8px',
                cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '13px',
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                width: '100%', justifyContent: 'center', transition: 'all 0.15s', fontWeight: 500,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--clay)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--clay-d)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(62,122,58,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--rule)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-3)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              เพิ่มรายการ
            </button>
          </div>

          {/* 03 Payment */}
          <div style={s.section}>
            <div style={s.sectionHead}>
              <div style={s.sectionNum}>03</div>
              <div>
                <div style={s.sectionTitle}>วิธีชำระเงิน</div>
                <div style={s.sectionSub}>เลือกหนึ่งวิธี</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {([
                { id: 'cash', label: 'เงินสด', icon: 'cash' },
                { id: 'transfer', label: 'โอนเงิน', icon: 'transfer' },
              ] as const).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPayment(p.id)}
                  style={{
                    appearance: 'none',
                    border: payment === p.id ? '1px solid var(--clay-d)' : '1px solid var(--rule)',
                    background: payment === p.id
                      ? 'linear-gradient(180deg, var(--clay) 0%, var(--clay-d) 100%)'
                      : 'var(--cream-0)',
                    color: payment === p.id ? 'var(--cream-0)' : 'var(--ink-2)',
                    padding: '16px 14px', borderRadius: '10px', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '8px', minHeight: '80px', transition: 'all 0.15s',
                    boxShadow: payment === p.id ? '0 3px 10px rgba(62,122,58,0.32)' : 'none',
                  }}
                >
                  <PayIcon kind={p.icon} />
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 04 Note */}
          <div style={s.section}>
            <div style={s.sectionHead}>
              <div style={s.sectionNum}>04</div>
              <div>
                <div style={s.sectionTitle}>หมายเหตุ</div>
                <div style={s.sectionSub}>ไม่บังคับ</div>
              </div>
            </div>
            <textarea
              rows={2}
              placeholder="เช่น ส่งวันเสาร์, ฝากไว้หน้าร้าน..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ ...s.fld, resize: 'vertical', minHeight: '64px', fontFamily: 'inherit' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--clay)'; e.target.style.boxShadow = '0 0 0 3px rgba(62,122,58,0.18)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--rule)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

        </div>

        {/* ── Right: Preview ── */}
        <div style={{ ...s.previewPane, display: isMobile && mobileTab !== 'preview' ? 'none' : undefined }}>
          {/* Preview bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 20px', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--cream-0)', letterSpacing: '0.02em' }}>
              <span>ตัวอย่างใบเสร็จ</span>
            </div>
            <button
              onClick={openSettings}
              style={{
                appearance: 'none', border: '1px solid rgba(251,245,232,0.4)',
                background: 'rgba(251,245,232,0.15)', backdropFilter: 'blur(8px)',
                color: 'var(--cream-0)', padding: '7px 12px', borderRadius: '7px',
                fontFamily: 'var(--font-ui)', fontSize: '12.5px', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '7px', transition: 'all 0.15s',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M2.8 11.2l1.4-1.4M9.8 4.2l1.4-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              ตั้งค่าใบเสร็จ
            </button>
          </div>

          {/* Receipt paper */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 40px' }}>
            <ReceiptPaper ref={receiptRef} {...paperProps} />
          </div>

          {/* Post-save print actions (desktop only — mobile uses bottom bar) */}
          {savedOrder && !isMobile && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center',
              background: 'rgba(251,245,232,0.12)', borderRadius: '12px', padding: '14px',
              backdropFilter: 'blur(8px)',
            }}>
              <ActionBtn
                onClick={handleBtPrint}
                disabled={printerStatus !== 'connected' || btPrinting}
                title={printerStatus !== 'connected' ? "ไปที่แท็บ 'เครื่องพิมพ์' เพื่อเชื่อมต่อ Bluetooth" : undefined}
                icon={<BtIcon active={printerStatus === 'connected'} />}
              >{btPrinting ? '...' : 'BT'}</ActionBtn>
              <ActionBtn onClick={handleExportPDF} icon={<PdfIcon />}>PDF</ActionBtn>
              <ActionBtn onClick={handleSaveImage} icon={<ImgIcon />}>บันทึกรูป</ActionBtn>
              <ActionBtn onClick={clear} ghost icon={<span style={{ fontSize: '11px', opacity: 0.7 }}>✦</span>}>ออเดอร์ใหม่</ActionBtn>
            </div>
          )}

          {btError && (
            <div style={{ color: 'var(--cream-0)', fontSize: '12px', textAlign: 'center', marginTop: '8px', opacity: 0.8 }}>{btError}</div>
          )}
        </div>
      </div>

      {/* ── Mobile bottom action bar ── */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
          background: 'var(--cream-0)', borderTop: '1px solid var(--rule-soft)',
          boxShadow: '0 -4px 20px rgba(28,46,26,0.10)',
          padding: '10px 16px 10px',
        }}>
          {!savedOrder ? (
            /* ก่อน save: ยอดรวม + ปุ่มออกใบเสร็จ */
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {validItemCount > 0 ? (
                  <>
                    <div style={{ fontSize: '11px', color: 'var(--ink-4)', lineHeight: 1.2 }}>ยอดรวม {validItemCount} รายการ</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--clay-d)', fontFamily: 'var(--font-mono)', lineHeight: 1.2 }}>
                      ฿{subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--ink-4)' }}>ยังไม่มีรายการ</div>
                )}
              </div>
              <button
                onClick={submit}
                disabled={saving}
                style={{
                  background: 'linear-gradient(180deg, var(--clay) 0%, var(--clay-d) 100%)',
                  color: 'var(--cream-0)', border: '1px solid var(--clay-d)',
                  padding: '13px 22px', borderRadius: '10px',
                  fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 2px 8px rgba(62,122,58,0.35)',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                ออกใบเสร็จ
              </button>
            </div>
          ) : (
            /* หลัง save: ปุ่ม print */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {btError && <div style={{ fontSize: '11px', color: '#B6452F' }}>{btError}</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <ActionBtn
                  onClick={handleBtPrint}
                  disabled={printerStatus !== 'connected' || btPrinting}
                  icon={<BtIcon active={printerStatus === 'connected'} />}
                >{btPrinting ? '...' : 'BT'}</ActionBtn>
                <ActionBtn onClick={handleExportPDF} icon={<PdfIcon />}>PDF</ActionBtn>
                <ActionBtn onClick={handleSaveImage} icon={<ImgIcon />}>บันทึกรูป</ActionBtn>
              </div>
              <button
                onClick={clear}
                style={{
                  width: '100%', padding: '10px', borderRadius: '8px',
                  border: '1px solid var(--rule)', background: 'transparent',
                  color: 'var(--ink-3)', fontFamily: 'var(--font-ui)', fontSize: '13px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                <span style={{ fontSize: '11px' }}>✦</span> ออเดอร์ใหม่
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Confirm Modal ── */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(28,46,26,0.45)',
          backdropFilter: 'blur(4px)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }} onClick={() => setShowConfirm(false)}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '400px',
            boxShadow: '0 24px 60px rgba(28,46,26,0.35)',
            animation: 'rsPop 0.18s cubic-bezier(0.2,0.8,0.2,1)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '28px 24px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧾</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>ยืนยันออกใบเสร็จ?</div>
              <div style={{ fontSize: '13px', color: 'var(--ink-3)', marginBottom: '16px' }}>กรุณาตรวจสอบรายการก่อนยืนยัน</div>
              <div style={{ background: 'var(--cream-1)', borderRadius: '8px', padding: '12px 14px', textAlign: 'left' }}>
                {customerName && <SummaryRow label="ลูกค้า" value={customerName} />}
                <SummaryRow label="รายการสินค้า" value={`${validItemCount} รายการ`} />
                <SummaryRow label="ยอดรวม" value={`฿${subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`} bold />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', padding: '0 24px 24px' }}>
              <ModalBtn onClick={() => setShowConfirm(false)}>ยกเลิก</ModalBtn>
              <ModalBtn primary onClick={handleConfirm} disabled={saving}>
                {saving ? 'กำลังบันทึก...' : '✓ ยืนยัน'}
              </ModalBtn>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt Settings Modal ── */}
      {showSettingsModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(28,46,26,0.45)',
          backdropFilter: 'blur(4px)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }} onClick={() => setShowSettingsModal(false)}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '440px',
            maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(28,46,26,0.35)',
          }} onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 14px', borderBottom: '1px solid var(--rule-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px', color: 'var(--clay-d)' }}>
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M2.8 11.2l1.4-1.4M9.8 4.2l1.4-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                ตั้งค่าใบเสร็จ
              </div>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: '6px', borderRadius: '6px', display: 'inline-flex' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <SettingsField label="ชื่อร้าน">
                <input value={draftSettings.shopName} onChange={(e) => setDraftSettings((d) => ({ ...d, shopName: e.target.value }))} style={modalInputStyle} />
              </SettingsField>
              <SettingsField label="คำอธิบายร้าน">
                <textarea rows={2} value={draftSettings.shopTagline} onChange={(e) => setDraftSettings((d) => ({ ...d, shopTagline: e.target.value }))} style={{ ...modalInputStyle, resize: 'vertical', minHeight: '56px' }} />
              </SettingsField>
              <SettingsField label="ข้อมูลติดต่อ">
                <textarea rows={2} value={draftSettings.shopContact} onChange={(e) => setDraftSettings((d) => ({ ...d, shopContact: e.target.value }))} style={{ ...modalInputStyle, resize: 'vertical', minHeight: '56px' }} />
              </SettingsField>
              <SettingsField label="ข้อความขอบคุณ">
                <textarea rows={3} value={draftSettings.thanksMsg} onChange={(e) => setDraftSettings((d) => ({ ...d, thanksMsg: e.target.value }))} style={{ ...modalInputStyle, resize: 'vertical', minHeight: '72px' }} />
              </SettingsField>
              <div style={{ height: '1px', background: 'var(--rule-soft)', margin: '2px 0' }} />
              {/* Logo toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--ink)' }}>แสดงโลโก้บนใบเสร็จ</span>
                <button
                  onClick={() => setDraftSettings((d) => ({ ...d, showLogo: !d.showLogo }))}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <div style={{
                    width: '32px', height: '18px', borderRadius: '9px',
                    background: draftSettings.showLogo ? 'var(--clay)' : 'var(--rule)',
                    position: 'relative', transition: 'background 0.15s',
                  }}>
                    <div style={{
                      position: 'absolute', top: '2px', left: '2px', width: '14px', height: '14px',
                      borderRadius: '50%', background: '#fff',
                      transition: 'transform 0.15s',
                      transform: draftSettings.showLogo ? 'translateX(14px)' : 'none',
                    }} />
                  </div>
                </button>
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ display: 'flex', gap: '8px', padding: '14px 20px 18px', borderTop: '1px solid var(--rule-soft)', background: 'var(--cream-1)' }}>
              <ModalBtn onClick={() => setShowSettingsModal(false)}>ยกเลิก</ModalBtn>
              <ModalBtn primary onClick={saveSettings}>✓ บันทึก</ModalBtn>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Tree Modal ── */}
      {showAddTree && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(28,46,26,0.45)',
          backdropFilter: 'blur(4px)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }} onClick={() => setShowAddTree(false)}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '400px',
            boxShadow: '0 24px 60px rgba(28,46,26,0.35)',
            animation: 'rsPop 0.18s cubic-bezier(0.2,0.8,0.2,1)',
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 14px', borderBottom: '1px solid var(--rule-soft)' }}>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--clay-d)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                เพิ่มต้นไม้ใหม่
              </div>
              <button onClick={() => setShowAddTree(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: '4px', display: 'inline-flex' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--ink-2)', fontWeight: 500, display: 'block', marginBottom: '5px' }}>ชื่อต้นไม้ *</label>
                <input
                  autoFocus
                  value={addTreeForm.name}
                  onChange={(e) => setAddTreeForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddTree(); }}
                  placeholder="เช่น มะม่วง, กุหลาบ"
                  style={{ ...modalInputStyle, width: '100%' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--ink-2)', fontWeight: 500, display: 'block', marginBottom: '5px' }}>หมวดหมู่</label>
                  <select
                    value={addTreeForm.category}
                    onChange={(e) => setAddTreeForm((f) => ({ ...f, category: e.target.value }))}
                    style={{ ...modalInputStyle, width: '100%' }}
                  >
                    {['ไม้ผล','ไม้ประดับ','ไม้ยืนต้น','ไม้ไผ่','ไม้สมุนไพร','อื่นๆ'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--ink-2)', fontWeight: 500, display: 'block', marginBottom: '5px' }}>หน่วย</label>
                  <select
                    value={addTreeForm.unit}
                    onChange={(e) => setAddTreeForm((f) => ({ ...f, unit: e.target.value }))}
                    style={{ ...modalInputStyle, width: '100%' }}
                  >
                    {['ต้น','กระถาง','กอ','ถุง'].map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--ink-2)', fontWeight: 500, display: 'block', marginBottom: '5px' }}>ราคา (บาท) *</label>
                <input
                  type="number"
                  value={addTreeForm.price}
                  onChange={(e) => setAddTreeForm((f) => ({ ...f, price: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddTree(); }}
                  placeholder="0"
                  min="0"
                  style={{ ...modalInputStyle, width: '100%' }}
                />
              </div>
              {addTreeError && (
                <div style={{ fontSize: '13px', color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '7px', padding: '9px 12px' }}>
                  {addTreeError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: '8px', padding: '12px 20px 18px', borderTop: '1px solid var(--rule-soft)' }}>
              <ModalBtn onClick={() => setShowAddTree(false)}>ยกเลิก</ModalBtn>
              <ModalBtn primary onClick={handleAddTree} disabled={addTreeSaving}>
                {addTreeSaving ? 'กำลังบันทึก...' : '+ เพิ่มต้นไม้'}
              </ModalBtn>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes rsPop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </>
  );
});

// ── Small helper components ──────────────────────────────────────────────────

function PayIcon({ kind }: { kind: 'cash' | 'transfer' }) {
  if (kind === 'cash') return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="5" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="11" cy="11" r="2.6" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M3 8h13l-3-3M19 14H6l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
      <span style={{ color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ color: 'var(--ink)', fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );
}

function ModalBtn({ onClick, children, primary, disabled }: { onClick?: () => void; children: React.ReactNode; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, appearance: 'none', fontFamily: 'var(--font-ui)',
        border: primary ? '1px solid var(--clay-d)' : '1px solid var(--rule)',
        background: primary ? 'linear-gradient(180deg, var(--clay) 0%, var(--clay-d) 100%)' : '#fff',
        color: primary ? '#fff' : 'var(--ink)',
        fontSize: '13.5px', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        fontWeight: 500, transition: 'all 0.15s',
        boxShadow: primary ? '0 1px 0 rgba(255,255,255,0.2) inset, 0 2px 6px rgba(62,122,58,0.32)' : 'none',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

const BtIcon = ({ active }: { active?: boolean }) => (
  <svg width="13" height="14" viewBox="0 0 12 16" fill="none">
    <path d="M3 4l6 4-6 4M9 4l-6 4 6 4"
      stroke={active ? 'var(--clay)' : 'currentColor'}
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const PdfIcon = () => (
  <svg width="13" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M8 1H3a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M8 1v5h4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M5 9h4M5 7h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const ImgIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="4.5" cy="5.5" r="1" fill="currentColor"/>
    <path d="M1 9.5l3-3 2.5 2.5 2-2 3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function ActionBtn({
  onClick, children, disabled, title, icon, ghost,
}: {
  onClick: () => void; children: React.ReactNode;
  disabled?: boolean; title?: string; icon?: React.ReactNode; ghost?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        appearance: 'none',
        border: ghost ? '1px solid rgba(251,245,232,0.35)' : '1px solid rgba(251,245,232,0.55)',
        background: ghost ? 'transparent' : 'rgba(251,245,232,0.92)',
        color: ghost ? 'rgba(251,245,232,0.75)' : 'var(--ink-2)',
        padding: '8px 14px', borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
        backdropFilter: 'blur(6px)',
        opacity: disabled ? 0.38 : 1,
        boxShadow: ghost ? 'none' : '0 1px 0 rgba(255,255,255,0.6) inset',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function SettingsField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '12px', color: 'var(--ink-2)', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

const modalInputStyle: React.CSSProperties = {
  appearance: 'none', border: '1px solid var(--rule)', borderRadius: '7px',
  padding: '9px 11px', fontFamily: 'var(--font-ui)', fontSize: '13.5px',
  color: 'var(--ink)', background: '#fff', outline: 'none', width: '100%',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

export default POSPage;
