import { useState, useRef } from 'react';
import { TreePine, History, Settings } from 'lucide-react';
import POSPage from './components/POS/POSPage';
import type { POSPageHandle } from './components/POS/POSPage';
import TreesPage from './components/Trees/TreesPage';
import HistoryPage from './components/History/HistoryPage';
import SettingsPage from './components/Settings/SettingsPage';
import { PrinterProvider, usePrinter } from './context/PrinterContext';

export const BOTTOM_NAV_H = 56;

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

      {/* ── Top bar: desktop action buttons only (hidden on mobile) ── */}
      <header className="hidden sm:flex" style={{
        alignItems: 'center', justifyContent: 'flex-end',
        padding: '0 12px', height: '56px',
        borderBottom: '1px solid var(--rule-soft)',
        background: 'rgba(255, 250, 243, 0.9)',
        backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 20,
        gap: '16px',
      }}>
        {/* Desktop POS action buttons */}
        <div style={{ gap: '8px', alignItems: 'center', flexShrink: 0, display: 'flex', visibility: activeTab === 'pos' ? 'visible' : 'hidden' }}>
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
            ออกใบเสร็จ
          </button>
        </div>
      </header>

      {/* ── Page content ── */}
      <main style={{ paddingBottom: `${BOTTOM_NAV_H}px` }}>
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

      {/* ── Bottom nav ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: `${BOTTOM_NAV_H}px`, zIndex: 20,
        display: 'flex', alignItems: 'stretch',
        background: 'rgba(255, 250, 243, 0.95)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid var(--rule-soft)',
        boxShadow: '0 -2px 12px rgba(28,46,26,0.07)',
      }}>
        <NavTab active={activeTab === 'pos'} onClick={() => setActiveTab('pos')}>
          <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="2" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5 5h4M5 7h4M5 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          ใบเสร็จ
        </NavTab>
        <NavTab active={activeTab === 'trees'} onClick={() => setActiveTab('trees')}>
          <TreePine size={20} />
          ต้นไม้
        </NavTab>
        <NavTab active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
          <History size={20} />
          ประวัติ
        </NavTab>
        <NavTab active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} hidden>
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <Settings size={20} />
            {dotColor && (
              <span style={{
                position: 'absolute', top: '-3px', right: '-3px',
                width: '7px', height: '7px', borderRadius: '50%',
                background: dotColor, border: '1.5px solid white',
              }} />
            )}
          </span>
          พิมพ์
        </NavTab>
      </nav>
    </div>
  );
}

function NavTab({ children, active, onClick, hidden }: { children: React.ReactNode; active: boolean; onClick: () => void; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        appearance: 'none', border: 'none',
        background: 'transparent',
        color: active ? 'var(--clay-d)' : 'var(--ink-4)',
        fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px',
        transition: 'color 0.15s',
        borderTop: active ? '2px solid var(--clay)' : '2px solid transparent',
        paddingTop: '2px',
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
