import { Trash2, Pencil, Check, X } from 'lucide-react';
import { useState } from 'react';
import type { CartItem as CartItemType } from '../../types';

interface Props {
  item: CartItemType;
  onUpdate: (id: string, updates: Partial<CartItemType>) => void;
  onRemove: (id: string) => void;
}

export default function CartItemRow({ item, onUpdate, onRemove }: Props) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.treeName);
  const [editPrice, setEditPrice] = useState(String(item.unitPrice));

  const subtotal = item.quantity * item.unitPrice;

  const saveEdit = () => {
    const price = parseFloat(editPrice);
    if (!editName.trim() || isNaN(price) || price <= 0) return;
    onUpdate(item.id, { treeName: editName.trim(), unitPrice: price });
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditName(item.treeName);
    setEditPrice(String(item.unitPrice));
    setEditing(false);
  };

  // quantity: allow typing, clamp to min 1 on blur
  const handleQtyChange = (val: string) => {
    const n = parseInt(val);
    if (val === '' || isNaN(n)) {
      onUpdate(item.id, { quantity: 1 });
    } else {
      onUpdate(item.id, { quantity: Math.max(1, n) });
    }
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      {/* Name */}
      <td className="py-2 px-3">
        {editing ? (
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
            autoFocus
            className="w-full px-2 py-1 border border-forest-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-forest-500"
          />
        ) : (
          <span className="text-sm font-medium text-gray-800">{item.treeName}</span>
        )}
      </td>

      {/* Quantity — always editable by typing */}
      <td className="py-2 px-2 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => item.quantity > 1 && onUpdate(item.id, { quantity: item.quantity - 1 })}
            className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-sm font-bold flex items-center justify-center select-none"
          >−</button>
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => handleQtyChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="w-12 text-center text-sm font-medium border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-forest-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => onUpdate(item.id, { quantity: item.quantity + 1 })}
            className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-sm font-bold flex items-center justify-center select-none"
          >+</button>
        </div>
      </td>

      {/* Unit Price */}
      <td className="py-2 px-3 text-right">
        {editing ? (
          <input
            type="number"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
            className="w-24 px-2 py-1 border border-forest-400 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-forest-500"
          />
        ) : (
          <span className="text-sm text-gray-700">
            ฿{Number(item.unitPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
        )}
      </td>

      {/* Subtotal */}
      <td className="py-2 px-3 text-right font-semibold text-sm text-forest-700">
        ฿{subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
      </td>

      {/* Actions — always visible */}
      <td className="py-2 px-2 text-center">
        <div className="flex items-center justify-center gap-1">
          {editing ? (
            <>
              <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-100 rounded" title="บันทึก">
                <Check size={15} />
              </button>
              <button onClick={cancelEdit} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="ยกเลิก">
                <X size={15} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditing(true); setEditName(item.treeName); setEditPrice(String(item.unitPrice)); }}
                className="p-1.5 text-blue-500 hover:bg-blue-100 rounded" title="แก้ไขชื่อ/ราคา">
                <Pencil size={15} />
              </button>
              <button onClick={() => onRemove(item.id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded" title="ลบ">
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
