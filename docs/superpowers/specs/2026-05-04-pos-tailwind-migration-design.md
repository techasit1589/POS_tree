# POS Page — Tailwind CSS Migration Design

**Date:** 2026-05-04  
**Scope:** `POSPage.tsx` + `LineItemRow.tsx`  
**Goal:** Replace inline `style={}` with Tailwind utility classes to improve responsive layout using `md:` breakpoints, removing the JS `isMobile` hook.

---

## 1. Breakpoint Strategy

Replace `isMobile` (JS `window.innerWidth < 720`) with Tailwind `md` breakpoint (768px).

| Current (JS) | New (Tailwind) |
|---|---|
| `isMobile ? 'flex' : 'none'` | `flex md:hidden` |
| `isMobile ? 'none' : 'flex'` | `hidden md:flex` |
| `isMobile ? '1fr' : '1fr 1fr'` | `grid-cols-1 md:grid-cols-2` |
| `padding: isMobile ? '20px 16px' : '28px 32px'` | `p-5 md:p-8` |

CSS variables (`--clay`, `--cream-0`, etc.) are kept and used via Tailwind arbitrary value syntax:  
`bg-[var(--cream-0)]`, `text-[var(--clay-d)]`, `border-[var(--rule)]`

The `isMobile` hook is deleted in the final step once no code references it.

---

## 2. Migration Steps (each = 1 commit)

### Step 1 — Mobile tab switcher (POSPage.tsx lines ~367–406)
- Replace inline styles on the tab bar with `flex md:hidden`, `flex-1`, `rounded-lg`
- Remove JS-driven `display: isMobile ? 'flex' : 'none'`

### Step 2 — Layout shell + Form pane (POSPage.tsx lines ~409–412)
- `grid grid-cols-1 md:grid-cols-2` for the two-column desktop layout
- `p-5 md:p-8` for form pane padding
- `opacity-[0.55] pointer-events-none` for locked state

### Step 3 — Section headers + fields 01–04 (POSPage.tsx lines ~430–647)
- Section number badge: `font-mono text-sm bg-[rgba(62,122,58,0.12)] border border-[rgba(62,122,58,0.22)] px-2 py-1 rounded`
- Input fields: `appearance-none border border-[var(--rule)] bg-[var(--cream-0)] px-3 py-2.5 rounded-lg w-full text-[17px] outline-none transition-all focus:border-[var(--clay)] focus:ring-2 focus:ring-[rgba(62,122,58,0.18)]`
- Remove `onFocus`/`onBlur` JS handlers that manually toggled border/shadow
- Payment buttons: dynamic `className` with ternary for selected/unselected state

### Step 4 — LineItemRow.tsx
- Desktop row: `grid` with column template, `hidden md:grid`
- Mobile card: `block md:hidden`
- Replace `onMouseEnter`/`onMouseLeave` hover handlers with `hover:` utilities

### Step 5 — Preview pane + Modals (POSPage.tsx lines ~658–832)
- Preview pane background: keep as inline `style` (complex radial-gradient not expressible cleanly in Tailwind)
- Confirm modal + Settings modal: `fixed inset-0`, `rounded-2xl`, `shadow-2xl`, `max-w-sm`
- Backdrop: `bg-[rgba(28,46,26,0.45)] backdrop-blur-sm`

### Step 6 — Mobile bottom action bar (POSPage.tsx lines ~722–800)
- `fixed bottom-14 inset-x-0 z-30 bg-[var(--cream-0)] border-t border-[var(--rule-soft)]`

### Step 7 — Delete `isMobile` hook + style object `s`
- Remove `useIsMobile` function and `useSyncExternalStore` import if unused
- Remove the `s` style object (lines ~308–362)

---

## 3. Handling CSS Variables + Interactive States

**Hover/focus** — replace JS event handlers with Tailwind pseudo-classes:
```
hover:border-[var(--clay)]   hover:bg-[rgba(62,122,58,0.06)]
focus:border-[var(--clay)]   focus:ring-2   focus:ring-[rgba(62,122,58,0.18)]
```

**Dynamic classes** — use ternary in `className`:
```tsx
className={`rounded-lg border ${
  payment === p.id
    ? 'bg-[var(--clay)] text-[var(--cream-0)] border-[var(--clay-d)]'
    : 'bg-[var(--cream-0)] text-[var(--ink-2)] border-[var(--rule)]'
}`}
```

---

## 4. Out of Scope

- `ReceiptPaper.tsx` — not migrated; inline styles are load-bearing for html2canvas/PDF export
- `tailwind.config.js` — no changes needed; CSS variables stay in `index.css`
- Visual appearance — must remain pixel-identical after each step
