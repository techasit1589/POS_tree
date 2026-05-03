# POS Tailwind CSS Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all inline `style={}` in `POSPage.tsx` and `LineItemRow.tsx` with Tailwind utility classes, eliminating the JS `isMobile` hook in favour of `md:` responsive breakpoints.

**Architecture:** Migrate section by section in 9 tasks, each committed independently. CSS variables (`--clay`, `--cream-0`, etc.) stay in `index.css` and are referenced via Tailwind arbitrary-value syntax (`bg-[var(--clay)]`). The `isMobile` JS hook is deleted in the final task once no code depends on it.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v3, Vite

---

## Files Modified

- `frontend/src/components/POS/POSPage.tsx` — main POS page (1 032 lines)
- `frontend/src/components/POS/LineItemRow.tsx` — line item row components (364 lines)

## Files NOT Modified

- `frontend/src/components/POS/ReceiptPaper.tsx` — inline styles are load-bearing for html2canvas/PDF export
- `frontend/src/index.css` — CSS variable definitions stay as-is
- `frontend/tailwind.config.js` — no changes required

---

## Quick Reference: CSS Variable → Tailwind Mapping

```
bg-[var(--cream-0)]          bg-[var(--cream-1)]         bg-[var(--cream-2)]
text-[var(--ink)]            text-[var(--ink-2)]          text-[var(--ink-3)]   text-[var(--ink-4)]
text-[var(--clay-d)]         text-[var(--clay)]           text-[var(--clay-l)]
border-[var(--rule)]         border-[var(--rule-soft)]
font-[var(--font-ui)]        font-[var(--font-mono)]
```

Focus ring (replaces onFocus/onBlur JS handlers):
```
focus:border-[var(--clay)] focus:shadow-[0_0_0_3px_rgba(62,122,58,0.18)] focus:outline-none
```

---

## Task 1: Mobile Tab Switcher

**Files:**
- Modify: `frontend/src/components/POS/POSPage.tsx:367-406`

- [ ] **Step 1: Verify current appearance**

  Run: `cd frontend && npm run dev`
  Open http://localhost:5173 on a narrow window (<768px). Note the two-tab bar at the top.

- [ ] **Step 2: Replace tab bar wrapper**

  Find (lines ~367–372):
  ```tsx
  <div style={{
    display: isMobile ? 'flex' : 'none',
    background: 'var(--cream-0)', borderBottom: '1px solid var(--rule-soft)',
    padding: '8px 12px', gap: '6px',
    position: 'sticky', top: 0, zIndex: 15,
  }}>
  ```

  Replace with:
  ```tsx
  <div className="flex md:hidden bg-[var(--cream-0)] border-b border-[var(--rule-soft)] px-3 py-2 gap-1.5 sticky top-0 z-[15]">
  ```

- [ ] **Step 3: Replace tab buttons**

  Find the `<button key={tab} ...>` and its `style={}` (lines ~378–403):
  ```tsx
  <button
    key={tab}
    onClick={() => setMobileTab(tab)}
    disabled={locked}
    style={{
      flex: 1, padding: '10px 12px', borderRadius: '8px',
      border: mobileTab === tab ? 'none' : '1px solid transparent',
      background: mobileTab === tab ? 'var(--clay)' : 'transparent',
      color: mobileTab === tab ? 'var(--cream-0)' : 'var(--ink-3)',
      fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 500,
      cursor: locked ? 'not-allowed' : 'pointer',
      opacity: locked ? 0.4 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      boxShadow: mobileTab === tab ? '0 2px 6px rgba(62,122,58,0.28)' : 'none',
    }}
  >
  ```

  Replace with:
  ```tsx
  <button
    key={tab}
    onClick={() => setMobileTab(tab)}
    disabled={locked}
    className={`flex-1 px-3 py-2.5 rounded-lg flex items-center justify-center gap-1.5 font-[var(--font-ui)] text-[16px] font-medium transition-all
      ${mobileTab === tab
        ? 'bg-[var(--clay)] text-[var(--cream-0)] shadow-[0_2px_6px_rgba(62,122,58,0.28)] border-0'
        : 'bg-transparent text-[var(--ink-3)] border border-transparent'}
      ${locked ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
  >
  ```

- [ ] **Step 4: Replace badge span**

  Find:
  ```tsx
  <span style={{
    background: mobileTab === tab ? 'rgba(255,255,255,0.25)' : 'var(--cream-2)',
    color: mobileTab === tab ? 'inherit' : 'var(--ink-3)',
    padding: '1px 6px', borderRadius: '8px', fontSize: '14px',
    fontFamily: 'var(--font-mono)', marginLeft: '4px',
  }}>{validItemCount}</span>
  ```

  Replace with:
  ```tsx
  <span className={`px-1.5 py-px rounded-full text-[14px] font-[var(--font-mono)] ml-1
    ${mobileTab === tab ? 'bg-[rgba(255,255,255,0.25)]' : 'bg-[var(--cream-2)] text-[var(--ink-3)]'}`}>
    {validItemCount}
  </span>
  ```

- [ ] **Step 5: Verify visually**

  On mobile-width window: tab bar shows, active tab is green, badge updates.
  On desktop-width window: tab bar is hidden.

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/components/POS/POSPage.tsx
  git commit -m "refactor(pos): migrate mobile tab switcher to Tailwind"
  ```

---

## Task 2: Layout Shell + Form Pane Wrapper

**Files:**
- Modify: `frontend/src/components/POS/POSPage.tsx:308-327, 409-412`

- [ ] **Step 1: Replace layout shell div** (line ~409)

  Find:
  ```tsx
  <div style={{ ...s.shell, gridTemplateColumns: isMobile ? '1fr' : s.shell.gridTemplateColumns }}>
  ```

  Replace with:
  ```tsx
  <div className="grid grid-cols-1 md:grid-cols-[minmax(520px,1fr)_minmax(480px,1fr)] min-h-[calc(100vh-56px)] w-full overflow-hidden">
  ```

- [ ] **Step 2: Replace form pane div** (line ~412)

  Find:
  ```tsx
  <div style={{ ...s.formPane, display: isMobile && mobileTab !== 'form' ? 'none' : undefined }}>
  ```

  Replace with:
  ```tsx
  <div className={`overflow-y-auto overflow-x-hidden border-r border-[var(--rule-soft)] bg-[var(--cream-1)] min-w-0 transition-[opacity] duration-200 p-5 pb-[110px] px-4 md:pt-7 md:px-8 md:pb-10
    ${savedOrder ? 'opacity-[0.55] pointer-events-none' : 'opacity-100'}
    ${mobileTab !== 'form' ? 'hidden md:block' : ''}`}>
  ```

- [ ] **Step 3: Remove s.shell and s.formPane from the `s` object** (lines ~309-327)

  Remove these two keys from the `s` object:
  ```tsx
  shell: { ... },      // delete
  formPane: { ... },   // delete
  ```

  The `s` object should now only contain: `section`, `sectionHead`, `sectionNum`, `sectionTitle`, `sectionSub`, `fld`, `lbl`, `previewPane`.

- [ ] **Step 4: Verify visually**

  Desktop: two-column layout with cream-1 left, green-gradient right.
  Mobile: single column, form tab shows form pane, preview tab hides it.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/components/POS/POSPage.tsx
  git commit -m "refactor(pos): migrate layout shell and form pane to Tailwind"
  ```

---

## Task 3: Form Sections 01–04

**Files:**
- Modify: `frontend/src/components/POS/POSPage.tsx:415-656`

This task migrates all form content: locked notice, section headers, inputs, payment buttons, add-item button, error banner. After this task the `s` style object is completely replaced.

- [ ] **Step 1: Replace locked notice** (lines ~415-428)

  Find:
  ```tsx
  <div style={{
    marginBottom: '20px', padding: '12px 14px',
    background: 'rgba(62,122,58,0.10)', border: '1px solid rgba(62,122,58,0.25)',
    borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px',
    fontSize: '16px', color: 'var(--clay-d)',
  }}>
  ```

  Replace with:
  ```tsx
  <div className="mb-5 px-3.5 py-3 bg-[rgba(62,122,58,0.10)] border border-[rgba(62,122,58,0.25)] rounded-lg flex items-center gap-2.5 text-[16px] text-[var(--clay-d)]">
  ```

- [ ] **Step 2: Replace section 01 wrapper + header**

  Replace all uses of `s.section`, `s.sectionHead`, `s.sectionNum`, `s.sectionTitle`, `s.sectionSub`:

  `s.section` → `className="mb-8"`
  `s.sectionHead` → `className="flex items-start gap-3.5 mb-4"`
  `s.sectionNum` → `className="font-[var(--font-mono)] text-[14px] text-[var(--clay-d)] bg-[rgba(62,122,58,0.12)] border border-[rgba(62,122,58,0.22)] px-2 py-1 rounded mt-0.5 tracking-[0.08em] font-semibold"`
  `s.sectionTitle` → `className="text-[20px] font-semibold text-[var(--ink)] tracking-[-0.01em]"`
  `s.sectionSub` → `className="text-[15.5px] text-[var(--ink-3)] mt-0.5"`

  Apply these four substitutions to **all four sections** (01, 02, 03, 04).

- [ ] **Step 3: Replace customer fields grid** (line ~438)

  Find:
  ```tsx
  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
  ```

  Replace with:
  ```tsx
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
  ```

- [ ] **Step 4: Replace `s.lbl` spans** (two label spans in section 01)

  Replace `style={s.lbl}` with:
  ```tsx
  className="text-[14.5px] text-[var(--ink-3)] uppercase tracking-[0.06em] font-medium block mb-1.5"
  ```

- [ ] **Step 5: Replace `s.fld` inputs + remove onFocus/onBlur handlers**

  Replace all `style={s.fld}` (and `style={{ ...s.fld, ... }}`) and remove the `onFocus`/`onBlur` JS handlers that manually toggle border/shadow.

  Base input class (for name and phone fields):
  ```tsx
  className="appearance-none border border-[var(--rule)] bg-[var(--cream-0)] px-3 py-2.5 rounded-[7px] font-[var(--font-ui)] text-[17px] text-[var(--ink)] w-full outline-none transition-all focus:border-[var(--clay)] focus:shadow-[0_0_0_3px_rgba(62,122,58,0.18)]"
  ```

  Textarea (section 04 — same class, add resize and min-height):
  ```tsx
  className="appearance-none border border-[var(--rule)] bg-[var(--cream-0)] px-3 py-2.5 rounded-[7px] font-[var(--font-ui)] text-[17px] text-[var(--ink)] w-full outline-none transition-all focus:border-[var(--clay)] focus:shadow-[0_0_0_3px_rgba(62,122,58,0.18)] resize-y min-h-[64px]"
  ```

  Remove the `onFocus` and `onBlur` props from both inputs and the textarea.

- [ ] **Step 6: Replace section 02 header row** (lines ~467-474)

  Find:
  ```tsx
  <div style={{ ...s.sectionHead, justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
  ```

  Replace with:
  ```tsx
  <div className="flex items-center justify-between gap-3.5 mb-4">
    <div className="flex items-center gap-3.5">
  ```

- [ ] **Step 7: Replace ปลีก/ส่ง toggle container + buttons** (lines ~476-499)

  Find container:
  ```tsx
  <div style={{
    display: 'flex', border: '1px solid rgba(62,122,58,0.35)',
    borderRadius: '7px', overflow: 'hidden',
    opacity: manualPrice ? 0.4 : 1,
    pointerEvents: manualPrice ? 'none' : undefined,
  }}>
  ```

  Replace with:
  ```tsx
  <div className={`flex border border-[rgba(62,122,58,0.35)] rounded-[7px] overflow-hidden transition-opacity ${manualPrice ? 'opacity-40 pointer-events-none' : ''}`}>
  ```

  Find the toggle button style:
  ```tsx
  style={{
    appearance: 'none', border: 'none',
    background: priceMode === mode ? 'rgba(62,122,58,0.15)' : 'transparent',
    color: priceMode === mode ? 'var(--clay-d)' : 'var(--ink-3)',
    padding: '3px 10px', cursor: 'pointer',
    fontFamily: 'var(--font-ui)', fontSize: '15.5px',
    fontWeight: priceMode === mode ? 600 : 400,
    transition: 'all 0.15s',
  }}
  ```

  Replace with:
  ```tsx
  className={`appearance-none border-0 px-2.5 py-0.5 cursor-pointer font-[var(--font-ui)] text-[15.5px] transition-all
    ${priceMode === mode
      ? 'bg-[rgba(62,122,58,0.15)] text-[var(--clay-d)] font-semibold'
      : 'bg-transparent text-[var(--ink-3)] font-normal'}`}
  ```

- [ ] **Step 8: Replace line item table header** (lines ~531-539)

  Find:
  ```tsx
  <div style={{ background: 'var(--cream-0)', border: '1px solid var(--rule-soft)', borderRadius: '10px', overflow: 'visible', marginBottom: '10px' }}>
    <div style={{
      display: 'grid', gridTemplateColumns: '28px 1fr 100px 110px 94px 28px',
      alignItems: 'center', gap: '8px', padding: '10px 14px',
      background: 'var(--cream-2)', borderBottom: '1px solid var(--rule-soft)',
      fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.08em',
      color: 'var(--ink-3)', fontWeight: 600, borderRadius: '10px 10px 0 0',
    }}>
  ```

  Replace with:
  ```tsx
  <div className="bg-[var(--cream-0)] border border-[var(--rule-soft)] rounded-[10px] overflow-visible mb-2.5">
    <div className="grid grid-cols-[28px_1fr_100px_110px_94px_28px] items-center gap-2 px-3.5 py-2.5 bg-[var(--cream-2)] border-b border-[var(--rule-soft)] text-[14px] uppercase tracking-[0.08em] text-[var(--ink-3)] font-semibold rounded-t-[10px]">
  ```

- [ ] **Step 9: Replace add-item button + remove mouse handlers** (lines ~576-590)

  Find:
  ```tsx
  <button
    onClick={addItem}
    style={{
      appearance: 'none', border: '1.5px dashed var(--rule)', background: 'transparent',
      color: 'var(--ink-3)', padding: '12px 14px', borderRadius: '8px',
      cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '16px',
      display: 'inline-flex', alignItems: 'center', gap: '7px',
      width: '100%', justifyContent: 'center', transition: 'all 0.15s', fontWeight: 500,
    }}
    onMouseEnter={(e) => { ... }}
    onMouseLeave={(e) => { ... }}
  >
  ```

  Replace with (remove onMouseEnter/onMouseLeave entirely):
  ```tsx
  <button
    onClick={addItem}
    className="appearance-none border-[1.5px] border-dashed border-[var(--rule)] bg-transparent text-[var(--ink-3)] px-3.5 py-3 rounded-lg cursor-pointer font-[var(--font-ui)] text-[16px] inline-flex items-center gap-1.5 w-full justify-center transition-all font-medium hover:border-[var(--clay)] hover:text-[var(--clay-d)] hover:bg-[rgba(62,122,58,0.06)]"
  >
  ```

- [ ] **Step 10: Replace payment buttons grid + buttons** (lines ~601-626)

  Grid:
  ```tsx
  // Find:
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
  // Replace:
  <div className="grid grid-cols-2 gap-2.5">
  ```

  Payment button:
  ```tsx
  className={`appearance-none rounded-[10px] cursor-pointer flex flex-col items-center gap-2 min-h-[80px] transition-all px-3.5 py-4 font-[var(--font-ui)]
    ${payment === p.id
      ? 'border border-[var(--clay-d)] bg-gradient-to-b from-[var(--clay)] to-[var(--clay-d)] text-[var(--cream-0)] shadow-[0_3px_10px_rgba(62,122,58,0.32)]'
      : 'border border-[var(--rule)] bg-[var(--cream-0)] text-[var(--ink-2)]'}`}
  ```

  Remove the `style={}` prop from the payment button entirely.

- [ ] **Step 11: Replace error banner** (lines ~650-654)

  Find:
  ```tsx
  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: '8px', padding: '12px 14px', fontSize: '16px', marginBottom: '16px' }}>
  ```

  Replace with:
  ```tsx
  <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-3.5 py-3 text-[16px] mb-4">
  ```

- [ ] **Step 12: Delete the `s` style object entirely** (lines ~308-362)

  Remove the entire block:
  ```tsx
  // ── Styles ──────────────────────────────────────────────────────────────────
  const s = {
    ...
  };
  ```

  Also remove the `React.CSSProperties` import if it is now unused (check if any other code in the file still uses it).

- [ ] **Step 13: Verify visually**

  All four form sections (customer, line items, payment, note) look identical to before. Focus states show green border + ring. Payment button selection/hover works. Error banner shows in red.

- [ ] **Step 14: Commit**

  ```bash
  git add frontend/src/components/POS/POSPage.tsx
  git commit -m "refactor(pos): migrate form sections 01-04 to Tailwind"
  ```

---

## Task 4: LineItemRow — Desktop

**Files:**
- Modify: `frontend/src/components/POS/LineItemRow.tsx:84-246`

- [ ] **Step 1: Replace row wrapper div** (lines ~84-96)

  Find:
  ```tsx
  <div
    className="lineitem-row"
    style={{
      display: 'grid',
      gridTemplateColumns: '28px 1fr 100px 110px 94px 28px',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 14px',
      borderBottom: isLast ? 'none' : '1px solid var(--rule-soft)',
      position: 'relative',
    }}
  >
  ```

  Replace with:
  ```tsx
  <div className={`lineitem-row grid grid-cols-[28px_1fr_100px_110px_94px_28px] items-center gap-2 px-3.5 py-2.5 relative ${!isLast ? 'border-b border-[var(--rule-soft)]' : ''}`}>
  ```

- [ ] **Step 2: Replace row number div** (line ~98)

  Find:
  ```tsx
  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', fontSize: '14px' }}>{idx + 1}</div>
  ```

  Replace with:
  ```tsx
  <div className="font-[var(--font-mono)] text-[var(--ink-4)] text-[14px]">{idx + 1}</div>
  ```

- [ ] **Step 3: Replace name input + remove onFocusCapture/onBlurCapture JS handlers** (lines ~101-128)

  Find the outer div:
  ```tsx
  <div style={{ position: 'relative' }} ref={wrapRef}>
  ```
  Replace with:
  ```tsx
  <div className="relative" ref={wrapRef}>
  ```

  Find the input with inline style (lines ~102-128) — note it uses `nameErr` to toggle border/shadow:
  ```tsx
  <input
    ...
    style={{
      width: '100%',
      border: nameErr ? '1px solid #EF4444' : '1px solid var(--rule)',
      boxShadow: nameErr ? '0 0 0 3px rgba(239,68,68,0.18)' : 'none',
      background: 'var(--cream-0)',
      padding: '8px 10px',
      borderRadius: '7px',
      fontFamily: 'var(--font-ui)',
      fontSize: '19px',
      color: 'var(--ink)',
      outline: 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}
    onFocusCapture={(e) => { ... }}
    onBlurCapture={(e) => { ... }}
  />
  ```

  Replace with (remove onFocusCapture/onBlurCapture entirely):
  ```tsx
  <input
    ...
    className={`w-full px-2.5 py-2 rounded-[7px] font-[var(--font-ui)] text-[19px] text-[var(--ink)] bg-[var(--cream-0)] outline-none transition-all focus:border-[var(--clay)] focus:shadow-[0_0_0_3px_rgba(62,122,58,0.18)]
      ${nameErr
        ? 'border border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.18)]'
        : 'border border-[var(--rule)]'}`}
  />
  ```

- [ ] **Step 4: Replace category badge** (lines ~129-138)

  Find:
  ```tsx
  <div style={{
    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
    fontSize: '12px', color: 'var(--sage-d)',
    background: 'rgba(138,154,91,0.18)', padding: '2px 7px', borderRadius: '3px',
    fontWeight: 500, pointerEvents: 'none',
  }}>
  ```

  Replace with:
  ```tsx
  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-[var(--sage-d)] bg-[rgba(138,154,91,0.18)] px-1.5 py-px rounded-[3px] font-medium pointer-events-none">
  ```

- [ ] **Step 5: Replace autocomplete dropdown** (lines ~139-172)

  Dropdown container:
  ```tsx
  // Find:
  <div style={{
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
    background: '#fff', border: '1px solid var(--rule)', borderRadius: '8px',
    boxShadow: '0 10px 28px rgba(28,46,26,0.18)', zIndex: 50,
    overflow: 'hidden', maxHeight: '220px', overflowY: 'auto',
  }}>
  // Replace:
  <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-[var(--rule)] rounded-lg shadow-[0_10px_28px_rgba(28,46,26,0.18)] z-50 overflow-hidden max-h-[220px] overflow-y-auto">
  ```

  Suggestion row:
  ```tsx
  // Find:
  <div
    key={m.id}
    onMouseEnter={() => setActiveIdx(i)}
    onMouseDown={(e) => { e.preventDefault(); pick(m); }}
    style={{
      padding: '9px 12px', cursor: 'pointer',
      borderBottom: '1px solid var(--rule-soft)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      background: i === activeIdx ? 'rgba(62,122,58,0.08)' : 'transparent',
    }}
  >
  // Replace:
  <div
    key={m.id}
    onMouseEnter={() => setActiveIdx(i)}
    onMouseDown={(e) => { e.preventDefault(); pick(m); }}
    className={`px-3 py-2.5 cursor-pointer border-b border-[var(--rule-soft)] flex items-center justify-between gap-3 ${i === activeIdx ? 'bg-[rgba(62,122,58,0.08)]' : 'bg-transparent'}`}
  >
  ```

  Name in suggestion:
  ```tsx
  // Find:
  <div style={{ fontSize: '18px', color: 'var(--ink)' }}>{m.name}</div>
  // Replace:
  <div className="text-[18px] text-[var(--ink)]">{m.name}</div>
  ```

  Right side of suggestion:
  ```tsx
  // Find:
  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13.5px' }}>
  // Replace:
  <div className="flex gap-2.5 items-center text-[13.5px]">
  ```

  Category badge in suggestion:
  ```tsx
  // Find:
  <span style={{ color: 'var(--sage-d)', background: 'rgba(138,154,91,0.18)', padding: '2px 6px', borderRadius: '3px', fontWeight: 500 }}>
  // Replace:
  <span className="text-[var(--sage-d)] bg-[rgba(138,154,91,0.18)] px-1.5 py-px rounded-[3px] font-medium">
  ```

  Price in suggestion:
  ```tsx
  // Find:
  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--clay-d)', fontWeight: 600 }}>
  // Replace:
  <span className="font-[var(--font-mono)] text-[var(--clay-d)] font-semibold">
  ```

- [ ] **Step 6: Replace qty cell** (lines ~176-190)

  Outer div:
  ```tsx
  // Find:
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
  // Replace:
  <div className="flex items-center gap-1.5">
  ```

  Qty input:
  ```tsx
  className="w-full border border-[var(--rule)] bg-[var(--cream-0)] px-2 py-2 rounded-[7px] font-[var(--font-mono)] text-[15px] text-right text-[var(--ink)] outline-none"
  ```
  Remove `style={}`.

  Unit span:
  ```tsx
  // Find:
  <span style={{ fontSize: '13px', color: 'var(--ink-4)', minWidth: '22px' }}>{item.unit || '—'}</span>
  // Replace:
  <span className="text-[13px] text-[var(--ink-4)] min-w-[22px]">{item.unit || '—'}</span>
  ```

- [ ] **Step 7: Replace price cell** (lines ~192-218)

  Outer div:
  ```tsx
  // Find:
  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
  // Replace:
  <div className="flex flex-col gap-0.5">
  ```

  Inner row div:
  ```tsx
  // Find:
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
  // Replace:
  <div className="flex items-center gap-1.5">
  ```

  Baht symbol:
  ```tsx
  // Find:
  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', fontSize: '15px' }}>฿</span>
  // Replace:
  <span className="font-[var(--font-mono)] text-[var(--ink-4)] text-[15px]">฿</span>
  ```

  Price input (uses `priceErr` for error state):
  ```tsx
  className={`w-full px-2 py-2 rounded-[7px] font-[var(--font-mono)] text-[15px] text-right text-[var(--ink)] outline-none
    ${priceErr
      ? 'border border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.18)] bg-red-50'
      : 'border border-[var(--rule)] bg-[var(--cream-0)]'}`}
  ```
  Remove `style={}`.

  Price error text:
  ```tsx
  // Find:
  <div style={{ fontSize: '12px', color: '#EF4444', textAlign: 'right', paddingRight: '2px' }}>
  // Replace:
  <div className="text-[12px] text-[#EF4444] text-right pr-0.5">
  ```

- [ ] **Step 8: Replace subtotal cell** (lines ~221-226)

  Find:
  ```tsx
  <div style={{
    fontFamily: 'var(--font-mono)', fontSize: '15.5px', fontWeight: 600,
    textAlign: 'right', color: 'var(--clay-d)',
  }}>
  ```

  Replace with:
  ```tsx
  <div className="font-[var(--font-mono)] text-[15.5px] font-semibold text-right text-[var(--clay-d)]">
  ```

- [ ] **Step 9: Replace delete button + remove mouse handlers** (lines ~229-243)

  Find:
  ```tsx
  <button
    onClick={() => onRemove(idx)}
    title="ลบแถว"
    style={{
      background: 'none', border: 'none', color: 'var(--ink-4)',
      cursor: 'pointer', padding: '6px', borderRadius: '5px',
      display: 'grid', placeItems: 'center', transition: 'all 0.15s',
    }}
    onMouseEnter={(e) => { ... }}
    onMouseLeave={(e) => { ... }}
  >
  ```

  Replace with (remove onMouseEnter/onMouseLeave):
  ```tsx
  <button
    onClick={() => onRemove(idx)}
    title="ลบแถว"
    className="bg-transparent border-0 text-[var(--ink-4)] cursor-pointer p-1.5 rounded-[5px] grid place-items-center transition-all hover:text-[#B6452F] hover:bg-[rgba(164,58,31,0.08)]"
  >
  ```

- [ ] **Step 10: Verify desktop row visually**

  Dev server should be running. Add a few items, verify grid alignment, focus states, error states (submit with empty items), autocomplete dropdown.

- [ ] **Step 11: Commit**

  ```bash
  git add frontend/src/components/POS/LineItemRow.tsx
  git commit -m "refactor(pos): migrate LineItemRow desktop to Tailwind"
  ```

---

## Task 5: LineItemRow — Mobile Card

**Files:**
- Modify: `frontend/src/components/POS/LineItemRow.tsx:285-363`

- [ ] **Step 1: Replace mobile card wrapper** (line ~286)

  Find:
  ```tsx
  <div style={{
    background: 'var(--cream-0)', border: '1px solid var(--rule-soft)', borderRadius: '10px',
    padding: '14px', marginBottom: '10px',
  }}>
  ```

  Replace with:
  ```tsx
  <div className="bg-[var(--cream-0)] border border-[var(--rule-soft)] rounded-[10px] p-3.5 mb-2.5">
  ```

- [ ] **Step 2: Replace card header row** (line ~290)

  Find:
  ```tsx
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
  ```

  Replace with:
  ```tsx
  <div className="flex justify-between items-start gap-2 mb-2.5">
  ```

- [ ] **Step 3: Replace name input wrapper + input** (lines ~292-306)

  Wrapper div:
  ```tsx
  // Find:
  <div style={{ flex: 1, position: 'relative' }} ref={wrapRef}>
  // Replace:
  <div className="flex-1 relative" ref={wrapRef}>
  ```

  Name input (uses `nameErrM`):
  ```tsx
  className={`w-full px-3 py-2.5 rounded-[7px] font-[var(--font-ui)] text-[19px] text-[var(--ink)] outline-none
    ${nameErrM
      ? 'border border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.18)] bg-white'
      : 'border border-[var(--rule)] bg-white'}`}
  ```
  Remove `style={}`.

- [ ] **Step 4: Replace mobile autocomplete dropdown** (lines ~307-327)

  Dropdown container:
  ```tsx
  <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-[var(--rule)] rounded-lg shadow-[0_10px_28px_rgba(28,46,26,0.18)] z-50 overflow-hidden max-h-[200px] overflow-y-auto">
  ```

  Suggestion row:
  ```tsx
  className={`px-3 py-2.5 cursor-pointer border-b border-[var(--rule-soft)] flex justify-between ${i === activeIdx ? 'bg-[rgba(62,122,58,0.08)]' : 'bg-transparent'}`}
  ```

  Suggestion name:
  ```tsx
  <span className="text-[18px]">{m.name}</span>
  ```

  Suggestion price:
  ```tsx
  <span className="font-[var(--font-mono)] text-[var(--clay-d)] text-[14px] font-semibold">฿...</span>
  ```

- [ ] **Step 5: Replace delete button in mobile card** (line ~330)

  Find:
  ```tsx
  <button onClick={() => onRemove(idx)} style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', padding: '8px', borderRadius: '5px' }}>
  ```

  Replace with:
  ```tsx
  <button onClick={() => onRemove(idx)} className="bg-transparent border-0 text-[var(--ink-4)] cursor-pointer p-2 rounded-[5px] hover:text-[#B6452F]">
  ```

- [ ] **Step 6: Replace fields row + labels** (lines ~334-356)

  Outer flex div:
  ```tsx
  // Find:
  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
  // Replace:
  <div className="flex gap-4 flex-wrap">
  ```

  Qty label wrapper:
  ```tsx
  // Find:
  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
  // Replace:
  <label className="flex flex-col gap-1">
  ```

  Label text (qty + price — both same):
  ```tsx
  // Find:
  <span style={{ fontSize: '12px', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
  // Replace:
  <span className="text-[12px] text-[var(--ink-4)] uppercase tracking-[0.06em]">
  ```

  Qty input row div:
  ```tsx
  // Find:
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
  // Replace (both qty and price row divs):
  <div className="flex items-center gap-1.5">
  ```

  Qty input:
  ```tsx
  className="w-[72px] border border-[var(--rule)] bg-white p-2 rounded-[7px] font-[var(--font-mono)] text-[16px] outline-none text-center"
  ```
  Remove `style={}`.

  Unit span:
  ```tsx
  <span className="text-[13px] text-[var(--ink-4)]">{item.unit || '—'}</span>
  ```

  Price label wrapper: same as qty label.

  Baht symbol:
  ```tsx
  <span className="font-[var(--font-mono)] text-[var(--ink-4)] text-[15px]">฿</span>
  ```

  Price input wrapper div:
  ```tsx
  // Find:
  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
  // Replace:
  <div className="flex flex-col gap-0.5">
  ```

  Price input (uses `priceErrM`):
  ```tsx
  className={`w-[96px] px-2 py-2 rounded-[7px] font-[var(--font-mono)] text-[16px] outline-none text-right
    ${priceErrM
      ? 'border border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.18)] bg-red-50'
      : 'border border-[var(--rule)] bg-white'}`}
  ```
  Remove `style={}`.

  Price error text:
  ```tsx
  <div className="text-[12px] text-[#EF4444] text-right">ต้องใส่ราคา</div>
  ```

- [ ] **Step 7: Replace subtotal row** (line ~358)

  Find:
  ```tsx
  <div style={{ textAlign: 'right', paddingTop: '8px', marginTop: '8px', borderTop: '1px dashed var(--rule-soft)', fontFamily: 'var(--font-mono)', fontSize: '17px', fontWeight: 600, color: 'var(--clay-d)' }}>
  ```

  Replace with:
  ```tsx
  <div className="text-right pt-2 mt-2 border-t border-dashed border-[var(--rule-soft)] font-[var(--font-mono)] text-[17px] font-semibold text-[var(--clay-d)]">
  ```

- [ ] **Step 8: Verify mobile card visually**

  Resize browser window to <768px. Verify cards render correctly, qty/price fields align, error states work.

- [ ] **Step 9: Commit**

  ```bash
  git add frontend/src/components/POS/LineItemRow.tsx
  git commit -m "refactor(pos): migrate LineItemRowMobile to Tailwind"
  ```

---

## Task 6: Preview Pane + Action Buttons

**Files:**
- Modify: `frontend/src/components/POS/POSPage.tsx:658-718`

- [ ] **Step 1: Replace preview pane wrapper** (line ~659)

  Find:
  ```tsx
  <div style={{ ...s.previewPane, display: isMobile && mobileTab !== 'preview' ? 'none' : undefined }}>
  ```

  Keep the complex gradient as inline `style` (cannot be expressed cleanly in Tailwind), but migrate layout properties and the display logic:
  ```tsx
  <div
    className={`overflow-y-auto px-8 py-5 pb-20 relative ${mobileTab !== 'preview' ? 'hidden md:block' : ''}`}
    style={{ background: 'radial-gradient(ellipse at 20% 10%, #8FAE6A 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, #557A3A 0%, transparent 55%), linear-gradient(135deg, #6F8F52 0%, #3E5F28 100%)' }}
  >
  ```

- [ ] **Step 2: Replace preview bar** (lines ~661-681)

  Outer div:
  ```tsx
  // Find:
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 20px', gap: '12px', flexWrap: 'wrap' }}>
  // Replace:
  <div className="flex items-center justify-between px-1 pt-2 pb-5 gap-3 flex-wrap">
  ```

  Label div:
  ```tsx
  // Find:
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: 'var(--cream-0)', letterSpacing: '0.02em' }}>
  // Replace:
  <div className="flex items-center gap-2 text-[15px] text-[var(--cream-0)] tracking-[0.02em]">
  ```

  Settings button:
  ```tsx
  className="appearance-none border border-[rgba(251,245,232,0.4)] bg-[rgba(251,245,232,0.15)] backdrop-blur-[8px] text-[var(--cream-0)] px-3 py-1.5 rounded-[7px] font-[var(--font-ui)] text-[15.5px] cursor-pointer inline-flex items-center gap-1.5 transition-all"
  ```
  Remove `style={}`.

- [ ] **Step 3: Replace receipt paper wrapper** (line ~684)

  Find:
  ```tsx
  <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 40px' }}>
  ```

  Replace with:
  ```tsx
  <div className="flex justify-center py-4 pb-10">
  ```

- [ ] **Step 4: Replace post-save desktop action bar** (lines ~689-713)

  Change the condition from `savedOrder && !isMobile` to `savedOrder` and use `hidden md:flex`:

  Find:
  ```tsx
  {savedOrder && !isMobile && (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center',
      background: 'rgba(251,245,232,0.12)', borderRadius: '12px', padding: '14px',
      backdropFilter: 'blur(8px)',
    }}>
  ```

  Replace with:
  ```tsx
  {savedOrder && (
    <div className="hidden md:flex flex-wrap gap-2 justify-center bg-[rgba(251,245,232,0.12)] rounded-xl p-3.5 backdrop-blur-[8px]">
  ```

- [ ] **Step 5: Replace error text** (line ~716)

  Find:
  ```tsx
  <div style={{ color: 'var(--cream-0)', fontSize: '15px', textAlign: 'center', marginTop: '8px', opacity: 0.8 }}>
  ```

  Replace with:
  ```tsx
  <div className="text-[var(--cream-0)] text-[15px] text-center mt-2 opacity-80">
  ```

- [ ] **Step 6: Remove `s.previewPane` from the `s` object** — it was already partially used; after this step the `s` object should be empty and can be deleted if not already done.

- [ ] **Step 7: Verify visually**

  Desktop: preview pane shows green gradient background, settings button, receipt paper centred. Post-save: action buttons appear.
  Mobile preview tab: shows correctly.

- [ ] **Step 8: Commit**

  ```bash
  git add frontend/src/components/POS/POSPage.tsx
  git commit -m "refactor(pos): migrate preview pane and action buttons to Tailwind"
  ```

---

## Task 7: Mobile Bottom Action Bar

**Files:**
- Modify: `frontend/src/components/POS/POSPage.tsx:722-800`

- [ ] **Step 1: Replace bottom bar wrapper + change condition**

  Find:
  ```tsx
  {isMobile && (
    <div style={{
      position: 'fixed', bottom: 56, left: 0, right: 0, zIndex: 30,
      background: 'var(--cream-0)', borderTop: '1px solid var(--rule-soft)',
      boxShadow: '0 -4px 20px rgba(28,46,26,0.10)',
      padding: '10px 16px 10px',
    }}>
  ```

  Replace (drop `isMobile` condition, use `md:hidden` instead):
  ```tsx
  <div className="md:hidden fixed bottom-14 inset-x-0 z-30 bg-[var(--cream-0)] border-t border-[var(--rule-soft)] shadow-[0_-4px_20px_rgba(28,46,26,0.10)] px-4 py-2.5">
  ```

  Remove the closing `)}` that was paired with `{isMobile && (` — replace with just `</div>`.

- [ ] **Step 2: Replace pre-save row** (lines ~731-764)

  Outer div:
  ```tsx
  // Find:
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
  // Replace:
  <div className="flex items-center gap-3">
  ```

  Summary div:
  ```tsx
  // Find:
  <div style={{ flex: 1, minWidth: 0 }}>
  // Replace:
  <div className="flex-1 min-w-0">
  ```

  Count text:
  ```tsx
  // Find:
  <div style={{ fontSize: '14px', color: 'var(--ink-4)', lineHeight: 1.2 }}>
  // Replace:
  <div className="text-[14px] text-[var(--ink-4)] leading-tight">
  ```

  Total amount:
  ```tsx
  // Find:
  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--clay-d)', fontFamily: 'var(--font-mono)', lineHeight: 1.2 }}>
  // Replace:
  <div className="text-[22px] font-bold text-[var(--clay-d)] font-[var(--font-mono)] leading-tight">
  ```

  Empty state:
  ```tsx
  // Find:
  <div style={{ fontSize: '16px', color: 'var(--ink-4)' }}>
  // Replace:
  <div className="text-[16px] text-[var(--ink-4)]">
  ```

  Submit button:
  ```tsx
  className={`bg-gradient-to-b from-[var(--clay)] to-[var(--clay-d)] text-[var(--cream-0)] border border-[var(--clay-d)] px-5 py-3 rounded-[10px] font-[var(--font-ui)] text-[17px] font-semibold flex items-center gap-2 shadow-[0_2px_8px_rgba(62,122,58,0.35)] whitespace-nowrap shrink-0 ${saving ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
  ```
  Remove `style={}`.

- [ ] **Step 3: Replace post-save column** (lines ~767-798)

  Outer div:
  ```tsx
  // Find:
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
  // Replace:
  <div className="flex flex-col gap-2">
  ```

  Error text:
  ```tsx
  // Find:
  <div style={{ fontSize: '14px', color: '#B6452F' }}>
  // Replace:
  <div className="text-[14px] text-[#B6452F]">
  ```

  Buttons row:
  ```tsx
  // Find:
  <div style={{ display: 'flex', gap: '8px' }}>
  // Replace:
  <div className="flex gap-2">
  ```

  New order button:
  ```tsx
  className="w-full py-2.5 rounded-lg border border-[var(--rule)] bg-transparent text-[var(--ink-3)] font-[var(--font-ui)] text-[16px] cursor-pointer flex items-center justify-center gap-1.5"
  ```
  Remove `style={}`.

- [ ] **Step 4: Verify visually**

  On mobile: bottom bar appears (above nav bar), submit button works. After save: action buttons appear, new order button clears form.
  On desktop: bottom bar is hidden.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/components/POS/POSPage.tsx
  git commit -m "refactor(pos): migrate mobile bottom action bar to Tailwind"
  ```

---

## Task 8: Modals + Helper Components

**Files:**
- Modify: `frontend/src/components/POS/POSPage.tsx:802-1031`

- [ ] **Step 1: Replace confirm modal backdrop** (lines ~803-808)

  Find:
  ```tsx
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(28,46,26,0.45)',
    backdropFilter: 'blur(4px)', zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
  }} onClick={() => setShowConfirm(false)}>
  ```

  Replace with:
  ```tsx
  <div className="fixed inset-0 bg-[rgba(28,46,26,0.45)] backdrop-blur-[4px] z-[100] flex items-center justify-center p-6" onClick={() => setShowConfirm(false)}>
  ```

- [ ] **Step 2: Replace confirm modal container** (lines ~809-813)

  Find:
  ```tsx
  <div style={{
    background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '400px',
    boxShadow: '0 24px 60px rgba(28,46,26,0.35)',
    animation: 'rsPop 0.18s cubic-bezier(0.2,0.8,0.2,1)',
  }} onClick={(e) => e.stopPropagation()}>
  ```

  Replace with:
  ```tsx
  <div className="bg-white rounded-[14px] w-full max-w-[400px] shadow-[0_24px_60px_rgba(28,46,26,0.35)] animate-[rsPop_0.18s_cubic-bezier(0.2,0.8,0.2,1)]" onClick={(e) => e.stopPropagation()}>
  ```

- [ ] **Step 3: Replace confirm modal body** (lines ~814-823)

  Padding div:
  ```tsx
  // Find:
  <div style={{ padding: '28px 24px 20px', textAlign: 'center' }}>
  // Replace:
  <div className="px-6 pt-7 pb-5 text-center">
  ```

  Emoji:
  ```tsx
  // Find:
  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧾</div>
  // Replace:
  <div className="text-[32px] mb-2">🧾</div>
  ```

  Title:
  ```tsx
  // Find:
  <div style={{ fontSize: '21px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>
  // Replace:
  <div className="text-[21px] font-bold text-[var(--ink)] mb-1">
  ```

  Subtitle:
  ```tsx
  // Find:
  <div style={{ fontSize: '16px', color: 'var(--ink-3)', marginBottom: '16px' }}>
  // Replace:
  <div className="text-[16px] text-[var(--ink-3)] mb-4">
  ```

  Summary box:
  ```tsx
  // Find:
  <div style={{ background: 'var(--cream-1)', borderRadius: '8px', padding: '12px 14px', textAlign: 'left' }}>
  // Replace:
  <div className="bg-[var(--cream-1)] rounded-lg px-3.5 py-3 text-left">
  ```

  Button row:
  ```tsx
  // Find:
  <div style={{ display: 'flex', gap: '8px', padding: '0 24px 24px' }}>
  // Replace:
  <div className="flex gap-2 px-6 pb-6">
  ```

- [ ] **Step 4: Replace settings modal backdrop + container** (lines ~836-845)

  Backdrop: same class as confirm modal backdrop — `fixed inset-0 bg-[rgba(28,46,26,0.45)] backdrop-blur-[4px] z-[100] flex items-center justify-center p-6`

  Container:
  ```tsx
  className="bg-white rounded-[14px] w-full max-w-[440px] max-h-[calc(100vh-48px)] flex flex-col overflow-hidden shadow-[0_24px_60px_rgba(28,46,26,0.35)]"
  ```

- [ ] **Step 5: Replace settings modal header** (lines ~847-855)

  Header div:
  ```tsx
  className="flex items-center justify-between px-5 pt-4 pb-3.5 border-b border-[var(--rule-soft)]"
  ```

  Title div:
  ```tsx
  className="flex items-center gap-2 font-semibold text-[18px] text-[var(--clay-d)]"
  ```

  Close button:
  ```tsx
  className="bg-transparent border-0 cursor-pointer text-[var(--ink-3)] p-1.5 rounded-[6px] inline-flex"
  ```

- [ ] **Step 6: Replace settings modal body** (lines ~858-896)

  Body div:
  ```tsx
  className="px-5 py-[18px] overflow-y-auto flex flex-col gap-3.5"
  ```

  Divider:
  ```tsx
  // Find:
  <div style={{ height: '1px', background: 'var(--rule-soft)', margin: '2px 0' }} />
  // Replace:
  <div className="h-px bg-[var(--rule-soft)] my-0.5" />
  ```

  Logo toggle row:
  ```tsx
  // Find:
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
  // Replace:
  <div className="flex items-center justify-between gap-3">
  ```

  Logo label:
  ```tsx
  // Find:
  <span style={{ fontSize: '16px', color: 'var(--ink)' }}>
  // Replace:
  <span className="text-[16px] text-[var(--ink)]">
  ```

  Toggle button:
  ```tsx
  className="bg-transparent border-0 cursor-pointer p-0 flex items-center"
  ```

  Toggle track:
  ```tsx
  className={`w-8 h-[18px] rounded-[9px] relative transition-colors ${draftSettings.showLogo ? 'bg-[var(--clay)]' : 'bg-[var(--rule)]'}`}
  ```
  Remove `style={}`.

  Toggle thumb:
  ```tsx
  className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${draftSettings.showLogo ? 'translate-x-3.5' : ''}`}
  ```
  Remove `style={}`.

- [ ] **Step 7: Replace settings modal footer** (line ~899)

  Find:
  ```tsx
  <div style={{ display: 'flex', gap: '8px', padding: '14px 20px 18px', borderTop: '1px solid var(--rule-soft)', background: 'var(--cream-1)' }}>
  ```

  Replace with:
  ```tsx
  <div className="flex gap-2 px-5 pt-3.5 pb-[18px] border-t border-[var(--rule-soft)] bg-[var(--cream-1)]">
  ```

- [ ] **Step 8: Migrate `ModalBtn` component** (lines ~940-960)

  Replace the entire style object with className:
  ```tsx
  function ModalBtn({ onClick, children, primary, disabled }: { onClick?: () => void; children: React.ReactNode; primary?: boolean; disabled?: boolean }) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`flex-1 appearance-none font-[var(--font-ui)] text-[16.5px] px-4 py-2.5 rounded-lg cursor-pointer inline-flex items-center justify-center gap-1.5 font-medium transition-all
          ${primary
            ? 'border border-[var(--clay-d)] bg-gradient-to-b from-[var(--clay)] to-[var(--clay-d)] text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_2px_6px_rgba(62,122,58,0.32)]'
            : 'border border-[var(--rule)] bg-white text-[var(--ink)]'}
          ${disabled ? 'opacity-60' : ''}`}
      >
        {children}
      </button>
    );
  }
  ```

- [ ] **Step 9: Migrate `ActionBtn` component** (lines ~984-1014)

  ```tsx
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
        className={`appearance-none rounded-lg font-[var(--font-ui)] text-[16px] font-medium inline-flex items-center gap-1.5 transition-all whitespace-nowrap backdrop-blur-[6px] px-3.5 py-2
          ${ghost
            ? 'border border-[rgba(251,245,232,0.35)] bg-transparent text-[rgba(251,245,232,0.75)]'
            : 'border border-[rgba(251,245,232,0.55)] bg-[rgba(251,245,232,0.92)] text-[var(--ink-2)] shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]'}
          ${disabled ? 'opacity-[0.38] cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {icon}
        {children}
      </button>
    );
  }
  ```

- [ ] **Step 10: Migrate `SummaryRow` component** (lines ~931-938)

  ```tsx
  function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
      <div className="flex justify-between py-1 text-[16px]">
        <span className="text-[var(--ink-3)]">{label}</span>
        <span className={`text-[var(--ink)] ${bold ? 'font-bold' : 'font-medium'}`}>{value}</span>
      </div>
    );
  }
  ```

- [ ] **Step 11: Migrate `SettingsField` component** (lines ~1016-1023)

  ```tsx
  function SettingsField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-[15px] text-[var(--ink-2)] font-medium">{label}</label>
        {children}
      </div>
    );
  }
  ```

- [ ] **Step 12: Migrate `modalInputStyle` → className on each input in settings modal body**

  Delete the `modalInputStyle` constant (lines ~1025-1030).

  On each `<input style={modalInputStyle}>` and `<textarea style={{ ...modalInputStyle, ... }}>` in the settings modal body, replace with:

  Input:
  ```tsx
  className="appearance-none border border-[var(--rule)] rounded-[7px] px-[11px] py-[9px] font-[var(--font-ui)] text-[16.5px] text-[var(--ink)] bg-white outline-none w-full transition-all"
  ```

  Textarea (add resize and min-height):
  ```tsx
  className="appearance-none border border-[var(--rule)] rounded-[7px] px-[11px] py-[9px] font-[var(--font-ui)] text-[16.5px] text-[var(--ink)] bg-white outline-none w-full transition-all resize-y min-h-[56px]"
  ```

  For the thank-you textarea, use `min-h-[72px]` instead.

- [ ] **Step 13: Verify modals visually**

  Open confirm modal (fill items + click submit). Open settings modal (click gear icon). Both should look identical to before.

- [ ] **Step 14: Commit**

  ```bash
  git add frontend/src/components/POS/POSPage.tsx
  git commit -m "refactor(pos): migrate modals and helper components to Tailwind"
  ```

---

## Task 9: Delete isMobile Hook + Cleanup

**Files:**
- Modify: `frontend/src/components/POS/POSPage.tsx`

- [ ] **Step 1: Verify isMobile is no longer referenced**

  Run:
  ```bash
  grep -n "isMobile" frontend/src/components/POS/POSPage.tsx
  ```

  Expected: no output. If any lines appear, go back to the relevant task and migrate them first.

- [ ] **Step 2: Delete the `useIsMobile` function** (lines ~3-10)

  Remove:
  ```tsx
  function useIsMobile() {
    const getSnapshot = () => window.innerWidth < 720;
    const subscribe = (cb: () => void) => {
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    };
    return useSyncExternalStore(subscribe, getSnapshot, () => false);
  }
  ```

- [ ] **Step 3: Remove `isMobile` variable declaration** (line ~86)

  Remove:
  ```tsx
  const isMobile = useIsMobile();
  ```

- [ ] **Step 4: Remove `useSyncExternalStore` from React import** (line 1)

  Find:
  ```tsx
  import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useSyncExternalStore } from 'react';
  ```

  Replace with:
  ```tsx
  import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
  ```

- [ ] **Step 5: Verify no TypeScript errors**

  Run:
  ```bash
  cd frontend && npx tsc --noEmit
  ```

  Expected: no errors. Fix any if they appear.

- [ ] **Step 6: Final visual verification**

  On desktop (≥768px): two-column layout, form left, preview right, tab bar hidden.
  On mobile (<768px): tab bar visible, single column, form/preview switch correctly, bottom action bar visible.
  Test golden paths: add item → submit → view receipt → print/export → new order.

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/src/components/POS/POSPage.tsx
  git commit -m "refactor(pos): remove isMobile hook, complete Tailwind migration"
  ```

- [ ] **Step 8: Push**

  ```bash
  git push
  ```

---

## Completion Checklist

- [ ] `POSPage.tsx` contains no `style={}` props (except the preview pane gradient background)
- [ ] `LineItemRow.tsx` contains no `style={}` props
- [ ] `useIsMobile` hook deleted
- [ ] `useSyncExternalStore` import removed
- [ ] `const isMobile` declaration removed
- [ ] `const s = { ... }` style object deleted
- [ ] `modalInputStyle` constant deleted
- [ ] All `onMouseEnter`/`onMouseLeave` JS hover handlers removed
- [ ] All `onFocus`/`onBlur`/`onFocusCapture`/`onBlurCapture` style-toggling handlers removed
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] Visual appearance identical on desktop and mobile
