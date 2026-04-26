interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** ข้อความ error ที่จะแสดงใน modal (เช่น "ลบไม่สำเร็จ") — modal จะไม่ปิดอัตโนมัติเพื่อให้ user เห็น */
  error?: string | null;
}

export default function ConfirmModal({ title, message, confirmLabel = 'ลบ', onConfirm, onCancel, error }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(28,46,26,0.45)',
        backdropFilter: 'blur(4px)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '360px',
          boxShadow: '0 24px 60px rgba(28,46,26,0.35)',
          animation: 'confirmPop 0.16s cubic-bezier(0.2,0.8,0.2,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '28px 24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>🗑️</div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px' }}>{title}</div>
          <div style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{message}</div>
          {error && (
            <div style={{
              marginTop: '14px', padding: '8px 12px',
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
              color: '#b91c1c', fontSize: '13px', fontWeight: 500,
            }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', padding: '0 24px 24px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '10px', borderRadius: '9px',
              border: '1px solid #e5e7eb', background: '#fff',
              color: '#374151', fontFamily: 'inherit', fontSize: '14px',
              fontWeight: 500, cursor: 'pointer',
            }}
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '10px', borderRadius: '9px',
              border: '1px solid #dc2626', background: '#dc2626',
              color: '#fff', fontFamily: 'inherit', fontSize: '14px',
              fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(220,38,38,0.32)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
      <style>{`@keyframes confirmPop { from { opacity:0; transform:translateY(8px) scale(0.97); } to { opacity:1; transform:none; } }`}</style>
    </div>
  );
}
