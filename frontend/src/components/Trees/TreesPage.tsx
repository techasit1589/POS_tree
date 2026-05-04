import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Search, RefreshCw, TreePine } from 'lucide-react';
import { getAllTrees, createTree, updateTree, deleteTree } from '../../api';
import type { Tree } from '../../types';
import ConfirmModal from '../shared/ConfirmModal';

const CATEGORIES = ['ไม้ผล', 'ไม้ประดับ', 'ไม้ยืนต้น', 'ไม้ไผ่', 'ไม้สมุนไพร', 'อื่นๆ'];
const UNITS = ['ต้น', 'กระถาง', 'กอ', 'ถุง'];

const CATEGORY_COLORS: Record<string, string> = {
  'ไม้ผล': 'bg-orange-100 text-orange-700',
  'ไม้ประดับ': 'bg-pink-100 text-pink-700',
  'ไม้ยืนต้น': 'bg-forest-100 text-forest-700',
  'ไม้ไผ่': 'bg-lime-100 text-lime-700',
  'ไม้สมุนไพร': 'bg-teal-100 text-teal-700',
  'อื่นๆ': 'bg-gray-100 text-gray-600',
};

function fmtPrice(n: number | undefined | null): string {
  if (n === undefined || n === null) return '—';
  const v = Number(n);
  return v % 1 === 0
    ? v.toLocaleString('th-TH')
    : v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type FormState = {
  name: string;
  category: string;
  price: string;
  priceWholesale: string;
  unit: string;
};

const emptyForm = (): FormState => ({
  name: '', category: 'ไม้ผล', price: '', priceWholesale: '', unit: 'ต้น',
});

export default function TreesPage() {
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('ทั้งหมด');

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(emptyForm());
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  const [expandedName, setExpandedName] = useState<number | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Tree | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState<Tree | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllTrees();
      setTrees(data);
      setHasLoaded(true);
    } catch {
      setError('โหลดข้อมูลไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ backend');
    } finally {
      setLoading(false);
    }
  };

  const filtered = trees.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q);
    const matchCat = filterCat === 'ทั้งหมด' || t.category === filterCat;
    return matchSearch && matchCat;
  });

  // ── Add ──
  const handleAdd = async () => {
    const price = parseFloat(addForm.price);
    if (!addForm.name.trim()) return setAddError('กรุณาใส่ชื่อต้นไม้');
    if (isNaN(price) || price <= 0) return setAddError('กรุณาใส่ราคาปลีกที่ถูกต้อง');
    const priceWholesale = addForm.priceWholesale ? parseFloat(addForm.priceWholesale) : undefined;
    if (priceWholesale !== undefined && (isNaN(priceWholesale) || priceWholesale <= 0)) {
      return setAddError('กรุณาใส่ราคาส่งที่ถูกต้อง');
    }
    setAddSaving(true);
    setAddError(null);
    try {
      const created = await createTree({
        name: addForm.name.trim(),
        category: addForm.category,
        price,
        priceWholesale,
        unit: addForm.unit,
      } as Omit<Tree, 'id'>);
      // แทรกตามชื่อ ascending ให้ตรงกับ ordering ของ getAllTrees
      setTrees((prev) => {
        const idx = prev.findIndex((t) => t.name.localeCompare(created.name, 'th') > 0);
        return idx === -1 ? [...prev, created] : [...prev.slice(0, idx), created, ...prev.slice(idx)];
      });
      setHasLoaded(true);
      setShowAddModal(false);
      setAddForm(emptyForm());
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setAddError(typeof msg === 'string' ? msg : 'เกิดข้อผิดพลาด');
    } finally {
      setAddSaving(false);
    }
  };

  // ── Edit ──
  const openEdit = (tree: Tree) => {
    setEditTarget(tree);
    setEditError(null);
    setEditForm({
      name: tree.name,
      category: tree.category || 'อื่นๆ',
      price: String(Number(tree.price)),
      priceWholesale: tree.priceWholesale !== undefined ? String(Number(tree.priceWholesale)) : '',
      unit: tree.unit || 'ต้น',
    });
  };

  const closeEdit = () => { setEditTarget(null); setEditError(null); };

  const saveEdit = async () => {
    if (!editTarget) return;
    const price = parseFloat(editForm.price);
    if (!editForm.name.trim()) return setEditError('กรุณาใส่ชื่อต้นไม้');
    if (isNaN(price) || price <= 0) return setEditError('กรุณาใส่ราคาปลีกที่ถูกต้อง');
    const priceWholesale: number | null = editForm.priceWholesale ? parseFloat(editForm.priceWholesale) : null;
    if (priceWholesale !== null && (isNaN(priceWholesale) || priceWholesale <= 0)) {
      return setEditError('กรุณาใส่ราคาส่งที่ถูกต้อง');
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await updateTree(editTarget.id, {
        name: editForm.name.trim(),
        category: editForm.category,
        price,
        priceWholesale,
        unit: editForm.unit,
      });
      setTrees((prev) => prev.map((t) => (t.id === editTarget.id ? updated : t)));
      closeEdit();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEditError(typeof msg === 'string' ? msg : 'เกิดข้อผิดพลาด');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteTree(deleteTarget.id);
      setTrees((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError('ลบไม่สำเร็จ กรุณาลองใหม่');
      // ไม่ปิด modal ให้ user เห็น error
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2">
            <TreePine size={22} className="text-forest-600" /> รายการต้นไม้ในระบบ
          </h2>
          <p className="text-base text-gray-400 mt-0.5">{trees.length} รายการ</p>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setAddForm(emptyForm()); setAddError(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-forest-600 hover:bg-forest-700 text-white text-base font-semibold rounded-xl transition ml-auto"
        >
          <Plus size={18} /> เพิ่มต้นไม้ใหม่
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-4 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, หมวดหมู่..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-forest-400"
          />
        </div>
        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap">
          {['ทั้งหมด', ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                filterCat === c ? 'bg-forest-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-forest-100'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-forest-600 text-white rounded-lg text-sm font-medium hover:bg-forest-700 transition"
        >
          <RefreshCw size={14} /> โหลดรายการ
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-base">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <RefreshCw size={32} className="mx-auto mb-2 animate-spin opacity-40" />
            <p className="text-base">กำลังโหลด...</p>
          </div>
        ) : !hasLoaded ? (
          <div className="text-center py-16 text-gray-400">
            <TreePine size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-base mb-3">กดปุ่ม "โหลดรายการ" เพื่อดูต้นไม้ทั้งหมด</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-forest-600 text-white rounded-lg text-base font-medium hover:bg-forest-700 transition"
            >
              <RefreshCw size={16} /> โหลดรายการต้นไม้
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <TreePine size={48} className="mx-auto mb-3 opacity-30" />
            <p>ไม่พบรายการ</p>
          </div>
        ) : (
          <table className="w-full text-base table-fixed">
            <thead className="bg-gray-50 text-sm text-gray-500 uppercase">
              <tr>
                <th className="text-left px-4 py-3 w-2/5">ชื่อต้นไม้</th>
                <th className="text-left px-4 py-3 hidden md:table-cell w-1/5">หมวดหมู่</th>
                <th className="text-right px-4 py-3 w-1/5 whitespace-nowrap">ปลีก/ส่ง</th>
                <th className="text-center px-4 py-3 hidden md:table-cell w-16">หน่วย</th>
                <th className="px-4 py-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((tree) => (
                <tr key={tree.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 min-w-0 cursor-pointer" onClick={() => setExpandedName(expandedName === tree.id ? null : tree.id)}>
                    <p className={`font-medium text-gray-800 ${expandedName === tree.id ? 'whitespace-normal' : 'truncate'}`}>{tree.name}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {tree.category && (
                      <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[tree.category] || CATEGORY_COLORS['อื่นๆ']}`}>
                        {tree.category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-forest-700">
                    {tree.priceWholesale !== undefined
                      ? <>{fmtPrice(tree.price)}<span className="text-gray-300 font-normal mx-1">/</span><span className="text-blue-600">{fmtPrice(tree.priceWholesale)}</span></>
                      : fmtPrice(tree.price)
                    }
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 hidden md:table-cell">
                    {tree.unit || 'ต้น'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEdit(tree)}
                        className="flex items-center gap-1 px-2.5 py-2 text-blue-500 hover:bg-blue-100 rounded-lg text-sm font-medium"
                        title="แก้ไข"
                      >
                        <Pencil size={16} />
                        <span>แก้ไข</span>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(tree)}
                        className="flex items-center gap-1 px-2.5 py-2 text-red-500 hover:bg-red-100 rounded-lg text-sm font-medium"
                        title="ลบ"
                      >
                        <Trash2 size={16} />
                        <span>ลบ</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Pencil size={18} className="text-blue-500" /> แก้ไขต้นไม้
              </h3>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">ชื่อต้นไม้ *</label>
                <input
                  autoFocus
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-forest-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">หมวดหมู่</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-forest-400 bg-white"
                  >
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">หน่วย</label>
                  <select
                    value={editForm.unit}
                    onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-forest-400 bg-white"
                  >
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">ราคาปลีก (บาท) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={editForm.price}
                    onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-forest-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">ราคาส่ง (บาท)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={editForm.priceWholesale}
                    onChange={(e) => setEditForm((f) => ({ ...f, priceWholesale: e.target.value }))}
                    placeholder="ไม่บังคับ"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-forest-400"
                  />
                </div>
              </div>
              {editError && <p className="text-base text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={closeEdit} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-base hover:bg-gray-200 font-medium">
                ยกเลิก
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-base font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
              >
                <Check size={16} /> {editSaving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <ConfirmModal
          title="ลบต้นไม้"
          message={`ต้องการลบ "${deleteTarget.name}" ออกจากระบบ?\nการลบจะไม่สามารถกู้คืนได้`}
          confirmLabel="ลบ"
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
          error={deleteError}
        />
      )}

      {/* ── Add Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Plus size={20} className="text-forest-600" /> เพิ่มต้นไม้ใหม่
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">ชื่อต้นไม้ *</label>
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="เช่น ต้นมะม่วง"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-forest-400"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">หมวดหมู่</label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-forest-400 bg-white"
                  >
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">หน่วย</label>
                  <select
                    value={addForm.unit}
                    onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-forest-400 bg-white"
                  >
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">ราคาปลีก (บาท) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={addForm.price}
                    onChange={(e) => setAddForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-forest-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">ราคาส่ง (บาท)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={addForm.priceWholesale}
                    onChange={(e) => setAddForm((f) => ({ ...f, priceWholesale: e.target.value }))}
                    placeholder="ไม่บังคับ"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-forest-400"
                  />
                </div>
              </div>
              {addError && <p className="text-base text-red-600 bg-red-50 px-3 py-2 rounded-lg">{addError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-base hover:bg-gray-200 font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleAdd}
                disabled={addSaving}
                className="px-5 py-2 bg-forest-600 text-white rounded-xl text-base font-semibold hover:bg-forest-700 disabled:opacity-60 flex items-center gap-2"
              >
                <Plus size={16} /> {addSaving ? 'กำลังเพิ่ม...' : 'เพิ่มต้นไม้'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
