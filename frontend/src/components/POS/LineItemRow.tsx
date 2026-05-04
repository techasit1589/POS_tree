import { useState, useEffect, useRef, useMemo } from 'react';
import type { Tree } from '../../types';

export interface LineItem {
  name: string;
  qty: number | string;
  price: number | string;
  unit: string;
  category: string;
  treeId?: number;
}

export function emptyItem(): LineItem {
  return { name: '', qty: 1, price: '', unit: '', category: '' };
}

interface Props {
  item: LineItem;
  idx: number;
  isLast: boolean;
  catalog: Tree[];
  onUpdate: (idx: number, item: LineItem) => void;
  onRemove: (idx: number) => void;
  showErrors?: boolean;
  autoFillPrice?: boolean;
  priceMode?: 'retail' | 'wholesale';
}

export default function LineItemRow({ item, idx, isLast, catalog, onUpdate, onRemove, showErrors, autoFillPrice = true, priceMode = 'retail' }: Props) {
  const [query, setQuery] = useState(item.name);
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(item.name); }, [item.name]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSuggest(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return catalog
      .filter((p) => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, catalog]);

  const pick = (tree: Tree) => {
    const filledPrice = priceMode === 'wholesale' ? (tree.priceWholesale ?? '') : tree.price;
    onUpdate(idx, {
      ...item,
      name: tree.name,
      price: autoFillPrice ? filledPrice : item.price,
      unit: tree.unit || 'ต้น',
      category: tree.category || '',
      treeId: tree.id,
    });
    setQuery(tree.name);
    setShowSuggest(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!showSuggest || !matches.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => (i + 1) % matches.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => (i - 1 + matches.length) % matches.length); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(matches[activeIdx]); }
    else if (e.key === 'Escape') { setShowSuggest(false); }
  };

  const subtotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
  const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isCustom = !!item.name && !item.treeId;
  const nameErr = !!showErrors && !item.name;
  const qtyErr = !!showErrors && !!item.name && (!item.qty || Number(item.qty) <= 0);
  const priceErr = !!showErrors && !!item.name && (!item.price || Number(item.price) === 0);

  return (
    <div className={`lineitem-row grid grid-cols-[28px_1fr_100px_110px_94px_28px] items-center gap-2 px-3.5 py-2.5 relative ${!isLast ? 'border-b border-[var(--rule-soft)]' : ''}`}>
      {/* # */}
      <div className="font-[var(--font-mono)] text-[var(--ink-4)] text-[14px]">{idx + 1}</div>

      {/* Name + autocomplete */}
      <div className="relative" ref={wrapRef}>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggest(true);
            setActiveIdx(0);
            onUpdate(idx, { ...item, name: e.target.value, treeId: undefined, category: item.category });
          }}
          onFocus={() => { if (query.trim()) setShowSuggest(true); }}
          onKeyDown={handleKey}
          placeholder="พิมพ์ชื่อสินค้า หรือค้นหา..."
          className={`w-full px-2.5 py-2 rounded-[7px] font-[var(--font-ui)] text-[19px] text-[var(--ink)] bg-[var(--cream-0)] outline-none transition-all focus:border-[var(--clay)] focus:shadow-[0_0_0_3px_rgba(62,122,58,0.18)]
  ${nameErr
    ? 'border border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.18)]'
    : 'border border-[var(--rule)]'}`}
        />
        {item.category && !showSuggest && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-[var(--sage-d)] bg-[rgba(138,154,91,0.18)] px-1.5 py-px rounded-[3px] font-medium pointer-events-none">
            {item.category}
          </div>
        )}
        {showSuggest && matches.length > 0 && (
          <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-[var(--rule)] rounded-lg shadow-[0_10px_28px_rgba(28,46,26,0.18)] z-50 overflow-hidden max-h-[220px] overflow-y-auto">
            {matches.map((m, i) => (
              <div
                key={m.id}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                className={`px-3 py-2.5 cursor-pointer border-b border-[var(--rule-soft)] flex items-center justify-between gap-3 ${i === activeIdx ? 'bg-[rgba(62,122,58,0.08)]' : 'bg-transparent'}`}
              >
                <div className="text-[18px] text-[var(--ink)]">{m.name}</div>
                <div className="flex gap-2.5 items-center text-[13.5px]">
                  {m.category && (
                    <span className="text-[var(--sage-d)] bg-[rgba(138,154,91,0.18)] px-1.5 py-px rounded-[3px] font-medium">
                      {m.category}
                    </span>
                  )}
                  <span className="font-[var(--font-mono)] text-[var(--clay-d)] font-semibold">
                    ฿{Number(priceMode === 'wholesale' ? (m.priceWholesale ?? m.price) : m.price).toLocaleString('th-TH')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Qty */}
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min="0"
          value={item.qty}
          onChange={(e) => onUpdate(idx, { ...item, qty: e.target.value })}
          className={`w-full px-2 py-2 rounded-[7px] font-[var(--font-mono)] text-[15px] text-right text-[var(--ink)] outline-none
  ${qtyErr
    ? 'border border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.18)] bg-red-50'
    : 'border border-[var(--rule)] bg-[var(--cream-0)]'}`}
        />
        <span className="text-[13px] text-[var(--ink-4)] min-w-[22px]">{item.unit || '—'}</span>
      </div>

      {/* Price */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-[var(--font-mono)] text-[var(--ink-4)] text-[15px]">฿</span>
          <input
            type="number"
            min="0"
            value={item.price}
            onChange={(e) => onUpdate(idx, { ...item, price: e.target.value })}
            placeholder={isCustom ? 'ใส่ราคา' : ''}
            className={`w-full px-2 py-2 rounded-[7px] font-[var(--font-mono)] text-[15px] text-right text-[var(--ink)] outline-none
  ${priceErr
    ? 'border border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.18)] bg-red-50'
    : 'border border-[var(--rule)] bg-[var(--cream-0)]'}`}
          />
        </div>
        {priceErr && isCustom && (
          <div className="text-[12px] text-[#EF4444] text-right pr-0.5">
            ต้องใส่ราคา
          </div>
        )}
      </div>

      {/* Subtotal */}
      <div className="font-[var(--font-mono)] text-[15.5px] font-semibold text-right text-[var(--clay-d)]">
        ฿{fmt(subtotal)}
      </div>

      {/* Delete */}
      <button
        onClick={() => onRemove(idx)}
        title="ลบแถว"
        className="bg-transparent border-0 text-[var(--ink-4)] cursor-pointer p-1.5 rounded-[5px] grid place-items-center transition-all hover:text-[#B6452F] hover:bg-[rgba(164,58,31,0.08)]"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

/* Mobile card layout (injected via className hook) */
export function LineItemRowMobile({ item, idx, catalog, onUpdate, onRemove, showErrors, autoFillPrice = true, priceMode = 'retail' }: Omit<Props, 'isLast'>) {
  const [query, setQuery] = useState(item.name);
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(item.name); }, [item.name]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return catalog.filter((p) => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)).slice(0, 6);
  }, [query, catalog]);

  const pick = (tree: Tree) => {
    const filledPrice = priceMode === 'wholesale' ? (tree.priceWholesale ?? '') : tree.price;
    onUpdate(idx, { ...item, name: tree.name, price: autoFillPrice ? filledPrice : item.price, unit: tree.unit || 'ต้น', category: tree.category || '', treeId: tree.id });
    setQuery(tree.name);
    setShowSuggest(false);
  };

  const subtotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
  const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isCustomM = !!item.name && !item.treeId;
  const nameErrM = !!showErrors && !item.name;
  const qtyErrM = !!showErrors && !!item.name && (!item.qty || Number(item.qty) <= 0);
  const priceErrM = !!showErrors && !!item.name && (!item.price || Number(item.price) === 0);

  return (
    <div className="bg-[var(--cream-0)] border border-[var(--rule-soft)] rounded-[10px] p-3.5 mb-2.5">
      <div className="flex justify-between items-start gap-2 mb-2.5">
        {/* Name */}
        <div className="flex-1 relative" ref={wrapRef}>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSuggest(true); setActiveIdx(0); onUpdate(idx, { ...item, name: e.target.value }); }}
            onFocus={() => { if (query.trim()) setShowSuggest(true); }}
            placeholder="ชื่อสินค้า..."
            className={`w-full px-3 py-2.5 rounded-[7px] font-[var(--font-ui)] text-[19px] text-[var(--ink)] outline-none
  ${nameErrM
    ? 'border border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.18)] bg-white'
    : 'border border-[var(--rule)] bg-white'}`}
          />
          {showSuggest && matches.length > 0 && (
            <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-[var(--rule)] rounded-lg shadow-[0_10px_28px_rgba(28,46,26,0.18)] z-50 overflow-hidden max-h-[200px] overflow-y-auto">
              {matches.map((m, i) => (
                <div
                  key={m.id}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                  className={`px-3 py-2.5 cursor-pointer border-b border-[var(--rule-soft)] flex justify-between ${i === activeIdx ? 'bg-[rgba(62,122,58,0.08)]' : 'bg-transparent'}`}
                >
                  <span className="text-[18px]">{m.name}</span>
                  <span className="font-[var(--font-mono)] text-[var(--clay-d)] text-[14px] font-semibold">฿{Number(priceMode === 'wholesale' ? (m.priceWholesale ?? m.price) : m.price).toLocaleString('th-TH')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Delete */}
        <button onClick={() => onRemove(idx)} className="bg-transparent border-0 text-[var(--ink-4)] cursor-pointer p-2 rounded-[5px] hover:text-[#B6452F]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
      <div className="flex gap-4 flex-wrap">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-[var(--ink-4)] uppercase tracking-[0.06em]">จำนวน</span>
          <div className="flex items-center gap-1.5">
            <input type="number" min="0" value={item.qty} onChange={(e) => onUpdate(idx, { ...item, qty: e.target.value })}
              className={`w-[72px] p-2 rounded-[7px] font-[var(--font-mono)] text-[16px] outline-none text-center
  ${qtyErrM
    ? 'border border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.18)] bg-red-50'
    : 'border border-[var(--rule)] bg-white'}`} />
            <span className="text-[13px] text-[var(--ink-4)]">{item.unit || '—'}</span>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-[var(--ink-4)] uppercase tracking-[0.06em]">ราคา/หน่วย</span>
          <div className="flex items-center gap-1">
            <span className="font-[var(--font-mono)] text-[var(--ink-4)] text-[15px]">฿</span>
            <div className="flex flex-col gap-0.5">
              <input type="number" min="0" value={item.price} onChange={(e) => onUpdate(idx, { ...item, price: e.target.value })}
                placeholder={isCustomM ? 'ใส่ราคา' : ''}
                className={`w-[96px] px-2 py-2 rounded-[7px] font-[var(--font-mono)] text-[16px] outline-none text-right
  ${priceErrM
    ? 'border border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.18)] bg-red-50'
    : 'border border-[var(--rule)] bg-white'}`} />
              {priceErrM && isCustomM && (
                <div className="text-[12px] text-[#EF4444] text-right">ต้องใส่ราคา</div>
              )}
            </div>
          </div>
        </label>
      </div>
      <div className="text-right pt-2 mt-2 border-t border-dashed border-[var(--rule-soft)] font-[var(--font-mono)] text-[17px] font-semibold text-[var(--clay-d)]">
        ฿{fmt(subtotal)}
      </div>
    </div>
  );
}
