import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Loader2 } from 'lucide-react';
import { getAllTrees } from '../../api';
import type { Tree } from '../../types';

interface Props {
  onSelect: (tree: Tree | { name: string; price: number; unit?: string }) => void;
}

export default function TreeSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [allTrees, setAllTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // โหลดต้นไม้ทั้งหมดครั้งเดียวตอน mount
  useEffect(() => {
    getAllTrees()
      .then(setAllTrees)
      .catch(() => setAllTrees([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // filter ใน browser — ไม่ยิง API
  const results = query.trim()
    ? allTrees.filter((t) => {
        const q = query.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          (t.category || '').toLowerCase().includes(q)
        );
      })
    : [];

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setShowDropdown(val.trim() !== '');
  };

  const handleSelect = (tree: Tree) => {
    onSelect(tree);
    setQuery('');
    setShowDropdown(false);
  };

  const handleAddCustom = () => {
    const price = parseFloat(customPrice);
    if (!customName.trim() || isNaN(price) || price <= 0) return;
    onSelect({ name: customName.trim(), price, unit: 'ต้น' });
    setCustomName('');
    setCustomPrice('');
    setShowCustomForm(false);
  };

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => { if (query.trim()) setShowDropdown(true); }}
            placeholder={loading ? 'กำลังโหลดรายการต้นไม้...' : 'ค้นหาต้นไม้... (ชื่อ, หมวดหมู่)'}
            disabled={loading}
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500 text-sm disabled:bg-gray-50"
          />
          {loading && (
            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
          )}
        </div>

        {/* Dropdown Results */}
        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                ไม่พบต้นไม้ที่ค้นหา
                <button
                  className="ml-2 text-forest-600 font-medium hover:underline"
                  onClick={() => {
                    setCustomName(query);
                    setShowCustomForm(true);
                    setShowDropdown(false);
                  }}
                >
                  เพิ่มรายการใหม่
                </button>
              </div>
            ) : (
              results.map((tree) => (
                <button
                  key={tree.id}
                  onClick={() => handleSelect(tree)}
                  className="w-full text-left px-4 py-2.5 hover:bg-forest-50 flex items-center justify-between gap-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm text-gray-800">{tree.name}</p>
                    {tree.category && (
                      <p className="text-xs text-gray-500">
                        <span className="bg-forest-100 text-forest-700 px-1.5 py-0.5 rounded">{tree.category}</span>
                      </p>
                    )}
                  </div>
                  <span className="text-forest-700 font-semibold text-sm whitespace-nowrap">
                    ฿{Number(tree.price).toLocaleString('th-TH')} / {tree.unit || 'ต้น'}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Custom Item Form */}
      <div>
        {!showCustomForm ? (
          <button
            onClick={() => setShowCustomForm(true)}
            className="flex items-center gap-1.5 text-sm text-forest-600 hover:text-forest-800 font-medium"
          >
            <Plus size={16} />
            เพิ่มรายการที่ไม่มีในระบบ
          </button>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-700">เพิ่มรายการเอง</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="ชื่อต้นไม้"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <input
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="ราคา (บาท)"
                min="0"
                className="w-36 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddCustom}
                disabled={!customName.trim() || !customPrice}
                className="px-4 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
              >
                เพิ่มลงใบเสร็จ
              </button>
              <button
                onClick={() => { setShowCustomForm(false); setCustomName(''); setCustomPrice(''); }}
                className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
