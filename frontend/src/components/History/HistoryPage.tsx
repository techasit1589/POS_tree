import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  History, ChevronDown, ChevronUp, RefreshCw, Search,
  Calendar, User, X, Pencil, Trash2, Plus, Check, AlertCircle,
  FileDown, ImageDown, Receipt as ReceiptIcon,
} from 'lucide-react';
import { getOrders, updateOrder, deleteOrder, getAllTrees, getOrdersOverallSummary, getOrdersGroupedSummary } from '../../api';
import ConfirmModal from '../shared/ConfirmModal';
import type { Order, OrderItem, Tree } from '../../types';
import ReceiptPaper, { loadPOSSettings } from '../POS/ReceiptPaper';
import type { LineItem } from '../POS/LineItemRow';

// ── helpers ──────────────────────────────────────────────────────────
type SummaryTab = 'day' | 'month' | 'year';

function fmt(n: number) {
  const v = Number(n);
  // ถ้าเป็นจำนวนเต็มไม่ต้องแสดงทศนิยม, ถ้ามีเศษค่อยแสดง 2 ตำแหน่ง
  return Number.isInteger(v)
    ? v.toLocaleString('th-TH')
    : v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toLocalDateStr(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function dateKey(iso: string, tab: SummaryTab) {
  const d = new Date(iso);
  if (tab === 'day')   return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  if (tab === 'month') return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
  return d.toLocaleDateString('th-TH', { year: 'numeric' });
}
/** แปลง Date → "YYYY-MM-DD" ในเขตเวลา local (ไม่ใช่ UTC)
 *  ใช้แทน d.toISOString().slice(0,10) ซึ่งจะให้วันที่ UTC — ทำให้ตี 1-7 โมงเช้าไทยได้วันที่ผิด */
function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
/** ดึง local date "YYYY-MM-DD" จาก ISO string ที่มาจาก backend */
function localDateFromIso(iso: string) { return isoDate(new Date(iso)); }

/** แปลง OrderItem → LineItem สำหรับ ReceiptPaper */
function toLineItems(items: OrderItem[]): LineItem[] {
  return items.map((i) => ({
    name: i.treeName,
    qty: i.quantity,
    price: Number(i.unitPrice),
    unit: 'ต้น',
    category: '',
    treeId: i.treeId,
  }));
}

// ── edit item row type ────────────────────────────────────────────────
interface EditItem {
  localId: string;
  treeId?: number;
  treeName: string;
  unitPrice: string;
  quantity: string;
}
function toEditItems(items: OrderItem[]): EditItem[] {
  return items.map((i, idx) => ({
    localId: String(idx),
    treeId: i.treeId,
    treeName: i.treeName,
    unitPrice: String(Number(i.unitPrice)),
    quantity: String(i.quantity),
  }));
}
function genLocalId() { return Math.random().toString(36).slice(2, 7); }

// ── autocomplete row for edit modal ──────────────────────────────────
interface EditItemRowProps {
  item: EditItem;
  catalog: Tree[];
  priceMode: 'retail' | 'wholesale';
  onUpdate: (localId: string, field: keyof Omit<EditItem, 'localId'>, val: string) => void;
  onPick: (localId: string, tree: Tree) => void;
  onRemove: (localId: string) => void;
}
function EditItemRow({ item, catalog, priceMode, onUpdate, onPick, onRemove }: EditItemRowProps) {
  const [query, setQuery] = useState(item.treeName);
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(item.treeName); }, [item.treeName]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setShowSuggest(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return catalog.filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)).slice(0, 6);
  }, [query, catalog]);

  const pick = (tree: Tree) => {
    onPick(item.localId, tree);
    setQuery(tree.name);
    setShowSuggest(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!showSuggest || !matches.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % matches.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + matches.length) % matches.length); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(matches[activeIdx]); }
    else if (e.key === 'Escape') setShowSuggest(false);
  };

  const qty = Math.max(0, Math.round(Number(item.quantity) || 0));

  return (
    <div className="flex flex-col gap-1.5 py-2 border-b border-gray-100 last:border-0">
      {/* Row 1: ชื่อ + autocomplete + ลบ */}
      <div className="flex gap-2 items-center" ref={wrapRef}>
        <div className="flex-1 min-w-0 relative">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggest(true);
              setActiveIdx(0);
              onUpdate(item.localId, 'treeName', e.target.value);
            }}
            onFocus={() => { if (query.trim()) setShowSuggest(true); }}
            onKeyDown={handleKey}
            placeholder="ชื่อต้นไม้ *"
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {showSuggest && matches.length > 0 && (
            <div className="absolute top-[calc(100%+2px)] left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden max-h-[200px] overflow-y-auto">
              {matches.map((m, i) => (
                <div
                  key={m.id}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                  className={`px-3 py-2 cursor-pointer border-b border-gray-50 flex justify-between items-center ${i === activeIdx ? 'bg-green-50' : ''}`}
                >
                  <span className="text-sm text-gray-800">{m.name}</span>
                  <span className="text-xs font-medium text-forest-700">
                    ฿{Number(priceMode === 'wholesale' ? (m.priceWholesale ?? m.price) : m.price).toLocaleString('th-TH')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => onRemove(item.localId)} className="p-1 text-red-400 hover:text-red-600 shrink-0">
          <X size={14} />
        </button>
      </div>
      {/* Row 2: จำนวน + ราคา + รวม */}
      <div className="flex gap-2 items-center">
        <div className="flex flex-col items-center shrink-0">
          <span className="text-xs text-gray-400 mb-0.5">จำนวน</span>
          <input type="number" inputMode="numeric" pattern="[0-9]*" min="1" step="1" value={item.quantity}
            onChange={(e) => onUpdate(item.localId, 'quantity', e.target.value.replace(/\..*/, ''))}
            placeholder="จำนวน"
            className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
        </div>
        <div className="relative shrink-0">
          <span className="text-xs text-gray-400 mb-0.5 block">ราคา</span>
          <span className="absolute left-2.5 bottom-[9px] text-gray-400 text-xs">฿</span>
          <input type="number" inputMode="decimal" value={item.unitPrice}
            onChange={(e) => onUpdate(item.localId, 'unitPrice', e.target.value)}
            placeholder="ราคา"
            className="w-24 pl-6 pr-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
        </div>
        <span className="flex-1 text-sm font-medium text-forest-700 text-right">
          ฿{fmt((Number(item.unitPrice) || 0) * qty)}
        </span>
      </div>
    </div>
  );
}

/** Cream glass button — matches POS action button style */
function HistBtn({ onClick, icon, children, disabled, title, variant = 'default', extraStyle }: {
  onClick: () => void; icon?: React.ReactNode; children: React.ReactNode;
  disabled?: boolean; title?: string; variant?: 'pdf' | 'image' | 'default'; extraStyle?: React.CSSProperties;
}) {
  let background = disabled ? 'rgba(200,210,190,0.4)' : 'rgba(251,245,232,0.92)';
  let border = '1px solid rgba(191,207,166,0.7)';
  let color = disabled ? 'var(--ink-4)' : 'var(--ink-2)';
  let boxShadow = disabled ? 'none' : '0 1px 0 rgba(255,255,255,0.6) inset';

  if (variant === 'pdf') {
    background = disabled ? 'rgba(205,93,87,0.4)' : 'linear-gradient(180deg, #CD5D57 0%, #B34741 100%)';
    border = '1px solid #9A3833';
    color = '#ffffff';
    boxShadow = disabled ? 'none' : '0 2px 8px rgba(205,93,87,0.3)';
  } else if (variant === 'image') {
    background = disabled ? 'rgba(70,130,180,0.4)' : 'linear-gradient(180deg, #4682B4 0%, #36648B 100%)';
    border = '1px solid #2B4F6E';
    color = '#ffffff';
    boxShadow = disabled ? 'none' : '0 2px 8px rgba(70,130,180,0.3)';
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={disabled ? '' : 'hover:brightness-105 active:scale-[0.98] transition-all'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '9px 15px', borderRadius: '8px',
        background,
        border,
        color,
        fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow,
        backdropFilter: 'blur(6px)',
        transition: 'opacity 0.15s, transform 0.1s, filter 0.1s',
        opacity: disabled ? 0.6 : 1,
        whiteSpace: 'nowrap',
        ...extraStyle,
      }}
    >
      {icon}{children}
    </button>
  );
}

const SUMMARY_PAGE_SIZE = 5;
const ORDERS_PAGE_SIZE  = 10;

function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }
  return (
    <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-gray-50">
      <button onClick={() => onChange(page - 1)} disabled={page === 1}
        className="px-2.5 py-1.5 text-sm rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30">‹</button>
      {pages.map((p, i) =>
        p === '...'
          ? <span key={`e${i}`} className="px-1 text-sm text-gray-400">…</span>
          : <button key={p} onClick={() => onChange(p as number)}
              className={`w-8 h-8 text-sm rounded-lg transition ${p === page ? 'bg-forest-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
      )}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
        className="px-2.5 py-1.5 text-sm rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30">›</button>
    </div>
  );
}

// ── component ────────────────────────────────────────────────────────
export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  // filters
  const [search, setSearch]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [summaryTab, setSummaryTab] = useState<SummaryTab>('day');

  // edit modal state
  const [editOrder, setEditOrder]         = useState<Order | null>(null);
  const [editCustomer, setEditCustomer]   = useState('');
  const [editPhone, setEditPhone]         = useState('');
  const [editNote, setEditNote]           = useState('');
  const [editPayment, setEditPayment]     = useState<'cash' | 'transfer'>('cash');
  const [editItems, setEditItems]         = useState<EditItem[]>([]);
  const [editSaving, setEditSaving]       = useState(false);
  const [editError, setEditError]         = useState<string | null>(null);
  const [catalog, setCatalog]             = useState<Tree[]>([]);
  const [editPriceMode, setEditPriceMode] = useState<'retail' | 'wholesale'>(
    () => (localStorage.getItem('pos_price_mode') as 'retail' | 'wholesale') || 'retail'
  );

  // ── delete confirm ──
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // ── receipt print modal ──
  const [printTarget, setPrintTarget]     = useState<Order | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [exportError, setExportError]     = useState<string | null>(null);
  const receiptRef                        = useRef<HTMLDivElement>(null);
  // อ่านใหม่ทุกครั้งที่เปิด print modal — เผื่อผู้ใช้ไปแก้ settings ในแท็บอื่นแล้วกลับมา
  const posSettings                        = useMemo(() => loadPOSSettings(), [printTarget]);

  const [hasSearched, setHasSearched] = useState(false);
  const [summaryPage, setSummaryPage] = useState(1);
  const [ordersPage, setOrdersPage]   = useState(1);
  
  // server-side summary states
  const [totalCount, setTotalCount] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [summaryGroups, setSummaryGroups] = useState<{ label: string; total: number; count: number }[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchPage = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrders({
        page,
        pageSize: ORDERS_PAGE_SIZE,
        search,
        dateFrom,
        dateTo
      });
      setOrders(data);
    } catch {
      setError('ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อ backend');
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo]);

  const triggerSearchWithFilters = useCallback(async (
    currentSearch: string,
    currentDateFrom: string,
    currentDateTo: string
  ) => {
    setHasSearched(true);
    setSummaryPage(1);
    
    setLoadingSummary(true);
    setError(null);
    try {
      const [overall, grouped] = await Promise.all([
        getOrdersOverallSummary({ search: currentSearch, dateFrom: currentDateFrom, dateTo: currentDateTo }),
        getOrdersGroupedSummary({ type: summaryTab, search: currentSearch, dateFrom: currentDateFrom, dateTo: currentDateTo })
      ]);
      setTotalSales(overall.totalSales);
      setTotalCount(overall.totalCount);
      setSummaryGroups(grouped);
    } catch {
      setError('ไม่สามารถโหลดข้อมูลสรุปได้');
    } finally {
      setLoadingSummary(false);
    }

    // โหลดรายการใบเสร็จหน้า 1
    const fetchPageWithFilters = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getOrders({
          page: 1,
          pageSize: ORDERS_PAGE_SIZE,
          search: currentSearch,
          dateFrom: currentDateFrom,
          dateTo: currentDateTo
        });
        setOrders(data);
      } catch {
        setError('ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อ backend');
      } finally {
        setLoading(false);
      }
    };

    setOrdersPage((prev) => {
      if (prev === 1) {
        fetchPageWithFilters();
      }
      return 1;
    });
  }, [summaryTab]);

  const load = () => {
    triggerSearchWithFilters(search, dateFrom, dateTo);
  };

  const handleSummaryTabChange = async (tab: SummaryTab) => {
    setSummaryTab(tab);
    setSummaryPage(1);
    if (hasSearched) {
      setLoadingSummary(true);
      try {
        const data = await getOrdersGroupedSummary({
          type: tab,
          search,
          dateFrom,
          dateTo
        });
        setSummaryGroups(data);
      } catch (e) {
        console.error('Failed to fetch grouped summary:', e);
      } finally {
        setLoadingSummary(false);
      }
    }
  };

  // โหลดหน้าใหม่เมื่อ ordersPage เปลี่ยนแปลง
  useEffect(() => {
    if (hasSearched) {
      fetchPage(ordersPage);
    }
  }, [ordersPage, fetchPage, hasSearched]);

  // โหลดข้อมูลอัตโนมัติตอนเปิดหน้าจอขึ้นมาครั้งแรก
  useEffect(() => {
    load();
  }, []);

  // กด Esc เพื่อปิด modal ที่เปิดอยู่ (priority: print > edit > delete confirm)
  useEffect(() => {
    if (!printTarget && !editOrder && !deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (printTarget) { setPrintTarget(null); setExportError(null); }
      else if (editOrder) { setEditOrder(null); setEditError(null); }
      else if (deleteTarget) { setDeleteTarget(null); setDeleteError(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [printTarget, editOrder, deleteTarget]);

  // ค้นหาเมื่อกด Enter ในช่อง search
  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      triggerSearchWithFilters(search, dateFrom, dateTo);
    }
  };

  const pagedSummaryGroups = summaryGroups.slice((summaryPage - 1) * SUMMARY_PAGE_SIZE, summaryPage * SUMMARY_PAGE_SIZE);

  const hasFilter  = search || dateFrom || dateTo;
  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setHasSearched(false);
    setOrders([]);
    setTotalCount(0);
    setTotalSales(0);
    setSummaryGroups([]);
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const allOrders = await getOrders({
        page: 1,
        pageSize: 1000000,
        search,
        dateFrom,
        dateTo
      });

      // RFC 4180: ห่อทุกฟิลด์ด้วย " และ escape " ภายในเป็น "" เพื่อกัน comma/quote ในชื่อลูกค้าหรือสินค้า
      const csvField = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
      const rows: string[] = [
        ['วันที่', 'เลขที่ใบเสร็จ', 'ชื่อลูกค้า', 'เบอร์โทร', 'วิธีชำระ', 'รายการ', 'ยอดรวม'].map(csvField).join(','),
      ];
      allOrders.forEach((o) => {
        const items = o.items.map((i) => `${i.treeName} x${i.quantity}`).join(' / ');
        const method = o.paymentMethod === 'transfer' ? 'โอน' : 'เงินสด';
        rows.push([
          toLocalDateStr(o.createdAt),
          o.receiptNumber,
          o.customerName || '',
          o.customerPhone || '',
          method,
          items,
          Number(o.totalAmount).toFixed(2),
        ].map(csvField).join(','));
      });
      const bom = '﻿'; // UTF-8 BOM for Excel Thai support
      const blob = new Blob([bom + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_${isoDate(new Date())}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('ไม่สามารถดึงข้อมูลสำหรับส่งออก Excel ได้');
    } finally {
      setExporting(false);
    }
  };

  const setToday = () => {
    const t = isoDate(new Date());
    setDateFrom(t);
    setDateTo(t);
    triggerSearchWithFilters(search, t, t);
  };
  const setThisMonth = () => {
    const n = new Date();
    const from = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`;
    const to = isoDate(new Date(n.getFullYear(), n.getMonth()+1, 0));
    setDateFrom(from);
    setDateTo(to);
    triggerSearchWithFilters(search, from, to);
  };
  const setThisYear = () => {
    const y = new Date().getFullYear();
    const from = `${y}-01-01`;
    const to = `${y}-12-31`;
    setDateFrom(from);
    setDateTo(to);
    triggerSearchWithFilters(search, from, to);
  };

  // ── delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleteSaving(true);
    try {
      await deleteOrder(deleteTarget.id);
      setOrders((prev) => prev.filter((o) => o.id !== deleteTarget.id));
      if (expanded === deleteTarget.id) setExpanded(null);
      setTotalCount((c) => Math.max(0, c - 1));
      setTotalSales((s) => Math.max(0, s - Number(deleteTarget.totalAmount)));
      const grouped = await getOrdersGroupedSummary({ type: summaryTab, search, dateFrom, dateTo });
      setSummaryGroups(grouped);
      setDeleteTarget(null);
    } catch {
      setDeleteError('ลบไม่สำเร็จ กรุณาลองใหม่');
      // ไม่ปิด modal ให้ user เห็น error และลองใหม่ได้
    } finally {
      setDeleteSaving(false);
    }
  };

  // ── open edit modal ──
  const openEdit = (order: Order) => {
    setEditOrder(order);
    setEditCustomer(order.customerName || '');
    setEditPhone(order.customerPhone || '');
    setEditNote(order.note || '');
    setEditPayment((order.paymentMethod as 'cash' | 'transfer') || 'cash');
    setEditItems(toEditItems(order.items || []));
    setEditError(null);
    if (catalog.length === 0) getAllTrees().then(setCatalog).catch(() => {});
  };
  const closeEdit = () => { setEditOrder(null); setEditError(null); };

  const updateEditItem = (localId: string, field: keyof Omit<EditItem,'localId'>, val: string) =>
    setEditItems((prev) => prev.map((i) => i.localId === localId ? { ...i, [field]: val } : i));
  const pickEditTree = (localId: string, tree: Tree) => {
    const price = editPriceMode === 'wholesale' ? (tree.priceWholesale ?? tree.price) : tree.price;
    setEditItems((prev) => prev.map((i) => i.localId === localId
      ? { ...i, treeName: tree.name, treeId: tree.id, unitPrice: String(price) }
      : i
    ));
  };
  const removeEditItem = (localId: string) =>
    setEditItems((prev) => prev.filter((i) => i.localId !== localId));
  const addEditItem = () =>
    setEditItems((prev) => [...prev, { localId: genLocalId(), treeName: '', unitPrice: '', quantity: '1' }]);

  const handleSaveEdit = async () => {
    if (!editOrder) return;
    for (const it of editItems) {
      if (!it.treeName.trim())               return setEditError('กรุณากรอกชื่อต้นไม้ทุกรายการ');
      if (isNaN(Number(it.unitPrice)) || Number(it.unitPrice) <= 0) return setEditError('ราคาต้องเป็นตัวเลขมากกว่า 0');
      // ตรวจหลัง round เพราะค่าทศนิยม < 0.5 จะถูกปัดเป็น 0 ทำให้บันทึกจำนวน 0 ได้
      const qty = Math.round(Number(it.quantity));
      if (isNaN(qty) || qty < 1) return setEditError('จำนวนต้องเป็นจำนวนเต็มอย่างน้อย 1');
    }
    setEditSaving(true); setEditError(null);
    try {
      const updated = await updateOrder(editOrder.id, {
        customerName: editCustomer.trim() || undefined,
        customerPhone: editPhone.trim() || undefined,
        note: editNote.trim() || undefined,
        paymentMethod: editPayment,
        items: editItems.map((i) => ({
          treeName: i.treeName.trim(),
          treeId: i.treeId,
          unitPrice: Number(i.unitPrice),
          quantity: Math.round(Number(i.quantity)),
        })),
      });
      setOrders((prev) => prev.map((o) => o.id === updated.id ? updated : o));
      const diff = Number(updated.totalAmount) - Number(editOrder.totalAmount);
      setTotalSales((s) => s + diff);
      const grouped = await getOrdersGroupedSummary({ type: summaryTab, search, dateFrom, dateTo });
      setSummaryGroups(grouped);
      closeEdit();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEditError(typeof msg === 'string' ? msg : 'เกิดข้อผิดพลาด');
    } finally { setEditSaving(false); }
  };

  // ใช้ qty หลัง round เพื่อให้ยอดที่โชว์ตรงกับที่บันทึกจริง (save ใช้ Math.round)
  const editItemQty = (i: EditItem) => Math.max(0, Math.round(Number(i.quantity) || 0));
  const editTotal = editItems.reduce((s, i) => s + (Number(i.unitPrice) || 0) * editItemQty(i), 0);

  // ── receipt print modal handlers ──
  const openPrint = (order: Order) => {
    setPrintTarget(order);
  };
  const closePrint = () => { setPrintTarget(null); setExportError(null); };


  // ── shared onclone: แก้ overflow:hidden ที่ทำให้ตัวอักษรไทยขาดครึ่งใน html2canvas ──
  const fixOverflowClone = (_doc: Document, el: HTMLElement) => {
    el.querySelectorAll<HTMLElement>('*').forEach((node) => {
      if (node.style.overflow === 'hidden')       node.style.overflow = 'visible';
      if (node.style.textOverflow === 'ellipsis') node.style.textOverflow = 'clip';
    });
  };

  const handleExportPDF = useCallback(async () => {
    const element = receiptRef.current;
    if (!element || !printTarget) return;
    setExportError(null);
    setPdfGenerating(true);
    try {
      await document.fonts.ready;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html2pdf = ((await import('html2pdf.js')) as any).default;
      await html2pdf().set({
        margin: 10,
        filename: `receipt-${printTarget.receiptNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, onclone: fixOverflowClone },
        jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' },
      }).from(element).save();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'สร้าง PDF ไม่สำเร็จ');
    } finally {
      setPdfGenerating(false);
    }
  }, [printTarget]);

  const handleSaveImage = useCallback(async () => {
    const element = receiptRef.current;
    if (!element || !printTarget) return;
    setExportError(null);
    setImageGenerating(true);
    try {
      await document.fonts.ready;
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#F6F9EB',
        onclone: fixOverflowClone,
      });
      const filename = `receipt-${printTarget.receiptNumber}.png`;
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
    } catch (e) {
      // ผู้ใช้กดยกเลิกใน share sheet → ไม่ใช่ error
      if (e instanceof Error && e.name === 'AbortError') return;
      setExportError(e instanceof Error ? e.message : 'บันทึกรูปไม่สำเร็จ');
    } finally {
      setImageGenerating(false);
    }
  }, [printTarget]);


  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2">
          <History size={22} className="text-forest-600" /> ประวัติการขาย
        </h2>
        <div className="flex items-center gap-3">
          {hasSearched && totalCount > 0 && (
            <button
              onClick={exportCSV}
              disabled={exporting}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium rounded-lg transition disabled:opacity-50"
            >
              <FileDown size={16} /> {exporting ? 'กำลังประมวลผล...' : 'ดึงข้อมูลใส่ Excel'}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKey}
              placeholder="ค้นหาชื่อลูกค้า หรือเลขที่ใบเสร็จ... (Enter)"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-forest-400" />
          </div>
          <button onClick={load}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-forest-600 hover:bg-forest-700 text-white text-base font-medium rounded-lg transition shrink-0">
            <Search size={16} /> ค้นหา
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400 shrink-0" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 min-w-0 px-2 py-2.5 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-forest-400" />
          <span className="text-gray-400 text-base shrink-0">ถึง</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 min-w-0 px-2 py-2.5 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-forest-400" />
          {hasFilter && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-base text-red-400 hover:text-red-600 shrink-0">
              <X size={16} /> ล้าง
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-gray-400 self-center">ดูด่วน:</span>
          {[['วันนี้', setToday], ['เดือนนี้', setThisMonth], ['ปีนี้', setThisYear]].map(([label, fn]) => (
            <button key={label as string} onClick={fn as () => void}
              className="px-4 py-1.5 bg-forest-50 text-forest-700 rounded-full text-sm font-medium hover:bg-forest-100 transition">
              {label as string}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">
            จำนวนใบเสร็จ{hasFilter ? ' (ที่กรอง)' : 'ทั้งหมด'}
          </p>
          {loadingSummary ? (
            <div className="h-9 bg-gray-100 rounded-lg animate-pulse w-24 mt-1"></div>
          ) : (
            <p className="text-3xl font-bold text-forest-700 mt-1">
              {totalCount.toLocaleString('th-TH')}
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">
            ยอดขายรวม{hasFilter ? ' (ที่กรอง)' : ''}
          </p>
          {loadingSummary ? (
            <div className="h-9 bg-gray-100 rounded-lg animate-pulse w-32 mt-1"></div>
          ) : (
            <p className="text-3xl font-bold text-forest-700 mt-1">
              ฿{fmt(totalSales)}
            </p>
          )}
        </div>
      </div>

      {/* Summary table */}
      {hasSearched && totalCount > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-1 px-4 pt-3 border-b border-gray-100">
            <span className="text-sm text-gray-500 mr-2">สรุปตาม:</span>
            {(['day','month','year'] as SummaryTab[]).map((k) => (
              <button key={k} onClick={() => handleSummaryTabChange(k)}
                className={`px-4 py-2.5 text-base font-medium border-b-2 transition-colors ${
                  summaryTab === k ? 'border-forest-600 text-forest-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {k === 'day' ? 'รายวัน' : k === 'month' ? 'รายเดือน' : 'รายปี'}
              </button>
            ))}
          </div>
          <table className="w-full text-base">
            <thead className="bg-gray-50 text-sm text-gray-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">ช่วงเวลา</th>
                <th className="text-center px-4 py-2.5">จำนวนบิล</th>
                <th className="text-right px-4 py-2.5">ยอดรวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagedSummaryGroups.map((g) => (
                <tr key={g.label} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-700">{g.label}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{g.count} บิล</td>
                  <td className="px-4 py-3 text-right font-semibold text-forest-700">฿{fmt(g.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={summaryPage} total={summaryGroups.length} pageSize={SUMMARY_PAGE_SIZE} onChange={setSummaryPage} />
        </div>
      )}

      {/* Orders list */}
      <div>
        <p className="text-base font-semibold text-gray-600 mb-2 flex items-center gap-2">
          รายการใบเสร็จ {hasFilter ? '(ที่กรอง)' : ''} 
          {loadingSummary ? (
            <span className="inline-block h-5 bg-gray-200 rounded animate-pulse w-8"></span>
          ) : (
            <span>({totalCount})</span>
          )}
        </p>
        {!hasSearched ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Search size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">กดปุ่ม "ค้นหา" หรือกด Enter เพื่อดูประวัติ</p>
            <p className="text-sm mt-1">หรือเลือกช่วงเวลาจากปุ่มดูด่วนด้านบน</p>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm animate-pulse flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-5 bg-gray-100 rounded w-24 shrink-0"></div>
                  <div className="h-4 bg-gray-100 rounded w-32"></div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-7 bg-gray-100 rounded w-28"></div>
                  <div className="flex-1"></div>
                  <div className="flex items-center gap-1 hidden sm:flex">
                    <div className="h-8 bg-gray-100 rounded-lg w-24"></div>
                    <div className="h-8 bg-gray-100 rounded-lg w-20"></div>
                    <div className="h-8 bg-gray-100 rounded-lg w-20"></div>
                  </div>
                  <div className="h-8 bg-gray-100 rounded-lg w-16 sm:hidden"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 text-sm bg-red-50 rounded-xl border border-red-200 p-6">{error}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
            <History size={48} className="mx-auto mb-3 opacity-30" />
            <p>ไม่พบรายการ</p>
          </div>
        ) : (
          <>
          <div className="space-y-2">
            {orders.map((order) => (
              <div key={order.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                {/* แถว 1: เลขที่ + ชื่อลูกค้า */}
                <button
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                  className="w-full px-4 pt-3 pb-1 flex items-center gap-2 hover:bg-gray-50 transition text-left min-w-0"
                >
                  <span className="font-mono text-base font-semibold text-gray-500 shrink-0">{order.receiptNumber}</span>
                  {order.customerName && (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <User size={13} className="text-gray-300 shrink-0" />
                      <span className="text-sm text-gray-600 truncate">{order.customerName}</span>
                    </div>
                  )}
                </button>

                {/* แถว 2: ราคา + ปุ่ม */}
                <div className="px-4 pb-3 flex items-center gap-2">
                  <button
                    onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                    className="flex items-center gap-1.5 hover:opacity-70 transition"
                  >
                    <span className="font-bold text-lg text-forest-700">฿{fmt(Number(order.totalAmount))}</span>
                    {expanded === order.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </button>
                  <span className="text-xs text-gray-300 hidden sm:inline">{toLocalDateStr(order.createdAt)}</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => openPrint(order)}
                      className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-forest-600 hover:bg-forest-50 rounded-lg text-sm font-medium"
                      title="พิมพ์ / บันทึกใบเสร็จ"
                    >
                      <ReceiptIcon size={15} />
                      <span>ใบเสร็จ</span>
                    </button>
                    <button
                      onClick={() => openEdit(order)}
                      className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-blue-500 hover:bg-blue-50 rounded-lg text-sm font-medium"
                      title="แก้ไข"
                    >
                      <Pencil size={15} />
                      <span>แก้ไข</span>
                    </button>
                    <button
                      onClick={() => setDeleteTarget(order)}
                      className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium"
                      title="ลบ"
                    >
                      <Trash2 size={15} />
                      <span>ลบ</span>
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded === order.id && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <p className="text-sm text-gray-400 mt-2 mb-1 sm:hidden">{toLocalDateStr(order.createdAt)}</p>
                    <table className="w-full text-base mt-2">
                      <thead>
                        <tr className="text-sm text-gray-400 border-b">
                          <th className="text-left py-1.5">รายการ</th>
                          <th className="text-center py-1.5">จำนวน</th>
                          <th className="text-right py-1.5">ราคา/หน่วย</th>
                          <th className="text-right py-1.5">รวม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items?.map((item) => (
                          <tr key={item.id} className="border-b border-gray-50">
                            <td className="py-2 text-gray-700">{item.treeName}</td>
                            <td className="py-2 text-center text-gray-500">{item.quantity}</td>
                            <td className="py-2 text-right text-gray-500">฿{fmt(Number(item.unitPrice))}</td>
                            <td className="py-2 text-right font-medium text-gray-700">฿{fmt(Number(item.subtotal))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(order.customerPhone) && (
                      <p className="mt-2 text-sm text-gray-500">
                        📞 {order.customerPhone}
                      </p>
                    )}
                    {order.note && <p className="mt-2 text-sm text-gray-400 italic">หมายเหตุ: {order.note}</p>}

                    {/* Quick print buttons in expanded row */}
                    <div className="mt-3 pt-3 border-t border-dashed border-gray-100 flex gap-2 flex-wrap">
                      <button onClick={() => openPrint(order)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-forest-50 text-forest-700 rounded-lg text-sm font-medium hover:bg-forest-100 transition">
                        <ReceiptIcon size={15} /> ดู / พิมพ์ใบเสร็จ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Pagination page={ordersPage} total={totalCount} pageSize={ORDERS_PAGE_SIZE} onChange={setOrdersPage} />
          </>
        )}
      </div>

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <ConfirmModal
          title="ลบใบเสร็จ"
          message={`ต้องการลบใบเสร็จ "${deleteTarget.receiptNumber}" ออกจากระบบ?\nการลบจะไม่สามารถกู้คืนได้`}
          confirmLabel="ลบ"
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
          error={deleteError}
          loading={deleteSaving}
        />
      )}

      {/* ── Receipt Print Modal ── */}
      {printTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(28,46,26,0.72)' }}
          onClick={closePrint}
        >
          <div
            style={{
              background: 'var(--cream-0)',
              borderRadius: '16px',
              boxShadow: '0 24px 80px rgba(28,46,26,0.4)',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              borderBottom: '1px solid var(--rule-soft)',
              padding: '14px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>ใบเสร็จย้อนหลัง</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-4)', marginTop: '1px' }}>{printTarget.receiptNumber}</div>
              </div>
              <button onClick={closePrint} style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Receipt preview — scrollable */}
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '24px 20px 32px',
              background: 'var(--cream-1)',
              display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
            }}>
              <ReceiptPaper
                ref={receiptRef}
                items={toLineItems(printTarget.items || [])}
                customerName={printTarget.customerName || ''}
                customerPhone={printTarget.customerPhone || ''}
                payment={(printTarget.paymentMethod as 'cash' | 'transfer') || 'cash'}
                note={printTarget.note || ''}
                discount={0}
                settings={posSettings}
                receiptNo={printTarget.receiptNumber}
                order={printTarget}
              />
            </div>

            {/* Action buttons */}
            <div style={{
              borderTop: '1px solid var(--rule-soft)',
              padding: '14px 18px', flexShrink: 0,
            }}>
              {exportError && (
                <div style={{ fontSize: '12px', color: '#B6452F', marginBottom: '10px' }}>
                  {exportError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <HistBtn
                  onClick={handleExportPDF}
                  disabled={pdfGenerating || imageGenerating}
                  variant="pdf"
                  icon={<FileDown size={14} />}
                  extraStyle={{ flex: 1, justifyContent: 'center' }}
                >{pdfGenerating ? '...' : 'บันทึก PDF'}</HistBtn>
                <HistBtn
                  onClick={handleSaveImage}
                  disabled={pdfGenerating || imageGenerating}
                  variant="image"
                  icon={<ImageDown size={14} />}
                  extraStyle={{ flex: 1, justifyContent: 'center' }}
                >{imageGenerating ? '...' : 'บันทึกรูป'}</HistBtn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Pencil size={16} className="text-blue-500" /> แก้ไขใบเสร็จ
                </h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{editOrder.receiptNumber}</p>
              </div>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">ชื่อลูกค้า</label>
                <input value={editCustomer} onChange={(e) => setEditCustomer(e.target.value)}
                  placeholder="ชื่อลูกค้า"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">รายการสินค้า</label>
                  {/* ปลีก/ส่ง toggle */}
                  <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                    {(['retail', 'wholesale'] as const).map((mode) => (
                      <button key={mode} type="button"
                        onClick={() => { setEditPriceMode(mode); localStorage.setItem('pos_price_mode', mode); }}
                        className={`px-3 py-1 text-sm transition-all ${
                          editPriceMode === mode
                            ? 'bg-forest-600 text-white font-semibold'
                            : 'bg-transparent text-gray-500 hover:bg-gray-50'
                        }`}>
                        {mode === 'retail' ? 'ปลีก' : 'ส่ง'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {editItems.map((item) => (
                    <EditItemRow
                      key={item.localId}
                      item={item}
                      catalog={catalog}
                      priceMode={editPriceMode}
                      onUpdate={updateEditItem}
                      onPick={pickEditTree}
                      onRemove={removeEditItem}
                    />
                  ))}
                  {editItems.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">ไม่มีรายการ — กดเพิ่มรายการด้านล่าง</p>
                  )}
                </div>
                <button onClick={addEditItem}
                  className="mt-2 w-full flex items-center justify-center gap-1 text-sm bg-green-500 hover:bg-green-600 text-white font-medium px-3 py-2 rounded-lg">
                  <Plus size={14} /> เพิ่มรายการ
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">เบอร์โทร</label>
                  <input value={editPhone} onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="08X-XXX-XXXX" type="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">หมายเหตุ</label>
                  <input value={editNote} onChange={(e) => setEditNote(e.target.value)}
                    placeholder="หมายเหตุ"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">ชำระโดย</label>
                  <div className="flex gap-2">
                    {(['cash', 'transfer'] as const).map((m) => (
                      <button key={m} type="button"
                        onClick={() => setEditPayment(m)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                          editPayment === m
                            ? 'bg-forest-600 text-white border-forest-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-forest-400'
                        }`}>
                        {m === 'cash' ? 'เงินสด' : 'โอนเงิน'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200">
                <span className="text-sm text-gray-500">ยอดรวมใหม่</span>
                <span className="text-xl font-bold text-forest-700">฿{fmt(editTotal)}</span>
              </div>

              {editError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                  <AlertCircle size={15} /> {editError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={closeEdit}
                className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200 font-medium">
                ยกเลิก
              </button>
              <button onClick={handleSaveEdit} disabled={editSaving || editItems.length === 0}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
                <Check size={15} /> {editSaving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
