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
          className="w-full border border-[var(--rule)] bg-[var(--cream-0)] px-2 py-2 rounded-[7px] font-[var(--font-mono)] text-[15px] text-right text-[var(--ink)] outline-none"
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
  const priceErrM = !!showErrors && !!item.name && (!item.price || Number(item.price) === 0);

  return (
    <div style={{
      background: 'var(--cream-0)', border: '1px solid var(--rule-soft)', borderRadius: '10px',
      padding: '14px', marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
        {/* Name */}
        <div style={{ flex: 1, position: 'relative' }} ref={wrapRef}>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSuggest(true); setActiveIdx(0); onUpdate(idx, { ...item, name: e.target.value }); }}
            onFocus={() => { if (query.trim()) setShowSuggest(true); }}
            placeholder="ชื่อสินค้า..."
            style={{
              width: '100%',
              border: nameErrM ? '1px solid #EF4444' : '1px solid var(--rule)',
              boxShadow: nameErrM ? '0 0 0 3px rgba(239,68,68,0.18)' : 'none',
              background: '#fff',
              padding: '9px 12px', borderRadius: '7px', fontFamily: 'var(--font-ui)',
              fontSize: '19px', color: 'var(--ink)', outline: 'none',
            }}
          />
          {showSuggest && matches.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: '#fff', border: '1px solid var(--rule)', borderRadius: '8px',
              boxShadow: '0 10px 28px rgba(28,46,26,0.18)', zIndex: 50,
              overflow: 'hidden', maxHeight: '200px', overflowY: 'auto',
            }}>
              {matches.map((m, i) => (
                <div key={m.id} onMouseEnter={() => setActiveIdx(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                  style={{
                    padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--rule-soft)',
                    display: 'flex', justifyContent: 'space-between',
                    background: i === activeIdx ? 'rgba(62,122,58,0.08)' : 'transparent',
                  }}>
                  <span style={{ fontSize: '18px' }}>{m.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--clay-d)', fontSize: '14px', fontWeight: 600 }}>฿{Number(priceMode === 'wholesale' ? (m.priceWholesale ?? m.price) : m.price).toLocaleString('th-TH')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Delete */}
        <button onClick={() => onRemove(idx)} style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', padding: '8px', borderRadius: '5px' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>จำนวน</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="number" min="0" value={item.qty} onChange={(e) => onUpdate(idx, { ...item, qty: e.target.value })}
              style={{ width: '72px', border: '1px solid var(--rule)', background: '#fff', padding: '8px', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '16px', outline: 'none', textAlign: 'center' }} />
            <span style={{ fontSize: '13px', color: 'var(--ink-4)' }}>{item.unit || '—'}</span>
          </div>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ราคา/หน่วย</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', fontSize: '15px' }}>฿</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <input type="number" min="0" value={item.price} onChange={(e) => onUpdate(idx, { ...item, price: e.target.value })}
                placeholder={isCustomM ? 'ใส่ราคา' : ''}
                style={{ width: '96px', border: priceErrM ? '1px solid #EF4444' : '1px solid var(--rule)', boxShadow: priceErrM ? '0 0 0 3px rgba(239,68,68,0.18)' : 'none', background: priceErrM ? '#FEF2F2' : '#fff', padding: '8px', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '16px', outline: 'none', textAlign: 'right' }} />
              {priceErrM && isCustomM && (
                <div style={{ fontSize: '12px', color: '#EF4444', textAlign: 'right' }}>ต้องใส่ราคา</div>
              )}
            </div>
          </div>
        </label>
      </div>
      <div style={{ textAlign: 'right', paddingTop: '8px', marginTop: '8px', borderTop: '1px dashed var(--rule-soft)', fontFamily: 'var(--font-mono)', fontSize: '17px', fontWeight: 600, color: 'var(--clay-d)' }}>
        ฿{fmt(subtotal)}
      </div>
    </div>
  );
}
