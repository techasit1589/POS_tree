import { useState, useRef } from 'react';
import { TreePine, History, Settings } from 'lucide-react';
import POSPage from './components/POS/POSPage';
import type { POSPageHandle } from './components/POS/POSPage';
import TreesPage from './components/Trees/TreesPage';
import HistoryPage from './components/History/HistoryPage';
import SettingsPage from './components/Settings/SettingsPage';
import { PrinterProvider, usePrinter } from './context/PrinterContext';

type Tab = 'pos' | 'trees' | 'history' | 'settings';

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('pos');
  const [posOrderSaved, setPosOrderSaved] = useState(false);
  const posRef = useRef<POSPageHandle>(null);
  const { status } = usePrinter();

  const dotColor =
    status === 'connected'  ? '#4ADE80' :
    status === 'connecting' ? '#60A5FA' :
    status === 'error'      ? '#F87171' : '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream-1)', fontFamily: 'var(--font-ui)' }}>
      {/* ── Top bar ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', height: '56px',
        borderBottom: '1px solid var(--rule-soft)',
        background: 'rgba(255, 250, 243, 0.9)',
        backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 20,
        gap: '16px',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flexShrink: 0 }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--clay) 0%, var(--clay-d) 100%)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 2px 6px rgba(62,122,58,0.28)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 20 C12 11, 5 6, 2 6 C2 12, 5 19, 12 20Z" fill="#D4E68A" opacity="0.9"/>
              <path d="M12 20 C12 11, 19 6, 22 6 C22 12, 19 19, 12 20Z" fill="#B8D46A" opacity="0.75"/>
              <path d="M12 20 V4" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
            </svg>
          </div>
          <div className="hidden sm:block">
            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              ร้านพีท-ภีมพันธุ์ไม้
            </div>
            <div style={{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Point of Sale
            </div>
          </div>
        </div>

        {/* Nav tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1, justifyContent: 'center', overflow: 'hidden' }}>
          <NavTab active={activeTab === 'pos'} onClick={() => setActiveTab('pos')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="3" y="2" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5 5h4M5 7h4M5 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span className="hidden sm:inline">สร้างใบเสร็จ</span>
            <span className="sm:hidden">ใบเสร็จ</span>
          </NavTab>
          <NavTab active={activeTab === 'trees'} onClick={() => setActiveTab('trees')}>
            <TreePine size={14} />
            <span className="hidden sm:inline">จัดการต้นไม้</span>
            <span className="sm:hidden">ต้นไม้</span>
          </NavTab>
          <NavTab active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
            <History size={14} />
            <span className="hidden sm:inline">ประวัติการขาย</span>
            <span className="sm:hidden">ประวัติ</span>
          </NavTab>
          <NavTab active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Settings size={14} />
              {dotColor && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px',
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: dotColor, border: '1.5px solid white',
                }} />
              )}
            </span>
            <span className="hidden sm:inline">เครื่องพิมพ์</span>
            <span className="sm:hidden">พิมพ์</span>
          </NavTab>
        </nav>

        {/* POS action buttons (right) — always rendered to keep nav centered; hidden on mobile (handled by POSPage bottom bar) */}
        <div className="hidden sm:flex" style={{ gap: '8px', alignItems: 'center', flexShrink: 0, visibility: activeTab === 'pos' ? 'visible' : 'hidden' }}>
          <button
            onClick={() => { posRef.current?.clear(); setPosOrderSaved(false); }}
            style={tbBtnStyle}
            className="hidden sm:inline-flex"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M3 5v7h8V5M5 5V3h4v2M1 5h12" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
            ยกเลิก
          </button>
          <button
            onClick={() => { if (!posOrderSaved) posRef.current?.submit(); }}
            disabled={posOrderSaved}
            style={{
              ...tbBtnPrimaryStyle,
              opacity: posOrderSaved ? 0.45 : 1,
              cursor: posOrderSaved ? 'not-allowed' : 'pointer',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 7l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="hidden sm:inline">ออกใบเสร็จ</span>
            <span className="sm:hidden">ออก</span>
          </button>
        </div>
      </header>

      {/* Page content — keep all tabs mounted, hide inactive ones to avoid layout jump */}
      <main>
        <div style={{ display: activeTab === 'pos' ? undefined : 'none' }}>
          <POSPage ref={posRef} onSavedOrderChange={setPosOrderSaved} />
        </div>
        <div style={{ display: activeTab === 'trees' ? undefined : 'none' }} className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <TreesPage />
        </div>
        <div style={{ display: activeTab === 'history' ? undefined : 'none' }} className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <HistoryPage />
        </div>
        <div style={{ display: activeTab === 'settings' ? undefined : 'none' }} className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <SettingsPage />
        </div>
      </main>
    </div>
  );
}

function NavTab({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none', border: 'none',
        background: active ? 'rgba(62,122,58,0.12)' : 'transparent',
        color: active ? 'var(--clay-d)' : 'var(--ink-3)',
        padding: '7px 12px', borderRadius: '7px',
        fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: active ? 500 : 400,
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

const tbBtnStyle: React.CSSProperties = {
  appearance: 'none', border: '1px solid var(--rule)', background: 'var(--cream-0)',
  color: 'var(--ink-2)', padding: '7px 13px', borderRadius: '7px',
  fontFamily: 'var(--font-ui)', fontSize: '13px', cursor: 'pointer',
  alignItems: 'center', gap: '6px', transition: 'all 0.15s', whiteSpace: 'nowrap',
};

const tbBtnPrimaryStyle: React.CSSProperties = {
  ...tbBtnStyle,
  background: 'linear-gradient(180deg, var(--clay) 0%, var(--clay-d) 100%)',
  color: 'var(--cream-0)',
  border: '1px solid var(--clay-d)',
  boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 2px 6px rgba(62,122,58,0.32)',
  display: 'inline-flex',
};

export default function App() {
  return (
    <PrinterProvider>
      <AppContent />
    </PrinterProvider>
  );
}
