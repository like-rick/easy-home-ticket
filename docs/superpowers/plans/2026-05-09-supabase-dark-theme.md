# Supabase Dark Theme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all 6 UI components from light Tailwind defaults to Supabase dark theme (#1c1c1c canvas, #3ecf8e primary green, Inter font).

**Architecture:** Pure CSS/Tailwind class replacement. No logic changes, no new components. Each file gets its classes swapped to match the Supabase dark design tokens. Build verification with `plasmo build` after each task.

**Tech Stack:** Plasmo 0.90.5, React 18, Tailwind CSS 3.4 (plasmo- prefix)

---

### Task 1: Tailwind config — add Supabase color palette and fonts

**Files:**
- Modify: `packages/extension/tailwind.config.js`
- Modify: `packages/extension/src/style.css`

- [ ] **Step 1: Add custom colors and font families to tailwind.config.js**

Replace the entire file:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{tsx,html}"],
  darkMode: "media",
  prefix: "plasmo-",
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        canvas: '#1c1c1c',
        'canvas-soft': '#202020',
        'log-bg': '#0d0d0d',
        primary: '#3ecf8e',
        'primary-deep': '#24b47e',
        'text-muted': '#9a9a9a',
        border: '#333333',
      },
    },
  },
}
```

- [ ] **Step 2: Add Inter font import and base body styles to style.css**

Replace the entire file:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: #1c1c1c;
  color: #ffffff;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 3: Build to verify**

Run: `cd packages/extension && npx plasmo build 2>&1 | tail -5`
Expected: `DONE | Finished in ...ms`

- [ ] **Step 4: Commit**

```bash
cd packages/extension && git add tailwind.config.js src/style.css && git commit -m "style: add Supabase dark palette and Inter font to Tailwind config"
```

---

### Task 2: Dashboard page — header, nav, and layout shell

**Files:**
- Modify: `packages/extension/src/tabs/dashboard.tsx`

- [ ] **Step 1: Replace all classes in dashboard.tsx**

Replace the JSX return block (lines 43-71) with:
```tsx
  return (
    <div className="plasmo-h-screen plasmo-flex plasmo-flex-col plasmo-bg-canvas-soft">
      <header className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-px-6 plasmo-py-3 plasmo-bg-canvas plasmo-border-b plasmo-border-border">
        <h1 className="plasmo-text-base plasmo-font-semibold plasmo-tracking-tight">EasyHome Ticket</h1>
        <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-text-xs">
          <span
            className="plasmo-inline-block plasmo-w-1.5 plasmo-h-1.5 plasmo-rounded-full"
            style={{
              backgroundColor: wsConnected ? '#3ecf8e' : '#ff2201',
              boxShadow: wsConnected ? '0 0 6px #3ecf8e88' : '0 0 6px #ff220188',
            }}
          />
          <span className="plasmo-text-text-muted">{wsConnected ? 'Server 已连接' : '已断开'}</span>
        </div>
      </header>
      <nav className="plasmo-flex plasmo-gap-1 plasmo-px-6 plasmo-py-2.5 plasmo-bg-canvas plasmo-border-b plasmo-border-border">
        {(['tasks', 'board', 'log'] as Panel[]).map(p => (
          <button key={p} onClick={() => setActivePanel(p)}
            className={`plasmo-px-4 plasmo-py-1.5 plasmo-rounded-md plasmo-text-sm plasmo-font-medium plasmo-transition-colors ${
              activePanel === p
                ? 'plasmo-bg-primary plasmo-text-black'
                : 'plasmo-text-text-muted hover:plasmo-text-white'
            }`}>
            {{ tasks: '任务', board: '方案', log: '日志' }[p]}
          </button>
        ))}
        <button onClick={() => setShowForm(true)}
          className="plasmo-px-4 plasmo-py-1.5 plasmo-ml-auto plasmo-bg-primary plasmo-text-black plasmo-rounded-md plasmo-text-sm plasmo-font-medium">
          + 新建任务
        </button>
      </nav>
      <main className="plasmo-flex-1 plasmo-overflow-auto plasmo-p-6">
        {activePanel === 'tasks' && <TaskList onSelect={handleSelectTask} selectedId={selectedTaskId} />}
        {activePanel === 'board' && <SolutionBoard solutions={solutions} />}
        {activePanel === 'log' && <LogStream logs={logs} />}
      </main>
      {showForm && <TaskForm onClose={() => setShowForm(false)} />}
    </div>
  )
```

- [ ] **Step 2: Build to verify**

Run: `cd packages/extension && npx plasmo build 2>&1 | tail -5`
Expected: `DONE | Finished in ...ms`

- [ ] **Step 3: Commit**

```bash
cd packages/extension && git add src/tabs/dashboard.tsx && git commit -m "style: apply Supabase dark theme to dashboard shell"
```

---

### Task 3: Task List — cards and status indicators

**Files:**
- Modify: `packages/extension/src/dashboard/task-list.tsx`

- [ ] **Step 1: Replace all classes in task-list.tsx**

Replace the return block (lines 25-42) with:
```tsx
  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-gap-2">
      {tasks.map(t => (
        <div key={t.id}
          onClick={() => onSelect(t.id)}
          className={`plasmo-p-4 plasmo-rounded-xl plasmo-cursor-pointer plasmo-border plasmo-transition-colors ${
            selectedId === t.id
              ? 'plasmo-border-primary plasmo-bg-canvas'
              : 'plasmo-border-border plasmo-bg-canvas hover:plasmo-border-[#555]'
          }`}>
          <div className="plasmo-flex plasmo-justify-between plasmo-items-center">
            <span className="plasmo-text-sm plasmo-font-medium plasmo-text-white">
              {t.name || `${t.fromStation}→${t.toStation}`}
            </span>
            <span
              className="plasmo-w-1.5 plasmo-h-1.5 plasmo-rounded-full"
              style={{
                backgroundColor: t.status === 'active' ? '#3ecf8e' : '#707070',
                boxShadow: t.status === 'active' ? '0 0 5px #3ecf8e88' : 'none',
              }}
            />
          </div>
          <div className="plasmo-text-xs plasmo-text-text-muted plasmo-mt-1">{t.travelDate}</div>
          <div className="plasmo-text-xs plasmo-mt-1" style={{ color: t.status === 'active' ? '#3ecf8e' : '#707070' }}>
            {t.status === 'active' ? '监控中' : '已完成'}
          </div>
        </div>
      ))}
      {tasks.length === 0 && (
        <div className="plasmo-text-text-muted plasmo-text-center plasmo-py-8 plasmo-text-sm">暂无任务，点击"+ 新建任务"开始</div>
      )}
    </div>
  )
```

- [ ] **Step 2: Build to verify**

Run: `cd packages/extension && npx plasmo build 2>&1 | tail -5`
Expected: `DONE | Finished in ...ms`

- [ ] **Step 3: Commit**

```bash
cd packages/extension && git add src/dashboard/task-list.tsx && git commit -m "style: apply Supabase dark theme to task list cards"
```

---

### Task 4: Solution Board — cards, badges, and price display

**Files:**
- Modify: `packages/extension/src/dashboard/solution-board.tsx`

- [ ] **Step 1: Update STATUS_MAP colors and replace all classes**

Replace the entire file:
```tsx
import React from 'react'
import type { SolutionData } from '../lib/types'

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  pending:  { label: '待定',  bg: 'rgba(112,112,112,0.15)', text: '#9a9a9a' },
  available:{ label: '可购',  bg: 'rgba(62,207,142,0.15)', text: '#3ecf8e' },
  sold:     { label: '已售罄', bg: 'rgba(255,34,1,0.15)',  text: '#ff2201' },
  booked:   { label: '已占座', bg: 'rgba(107,1,194,0.15)', text: '#6b01c2' },
}

const PLAN_LABELS: Record<string, string> = {
  direct: '直达', split: '同车换乘', longer: '买长乘短', cross: '非同车换乘',
}

export function SolutionBoard({ solutions }: { solutions: SolutionData[] }) {
  if (solutions.length === 0) {
    return <div className="plasmo-text-text-muted plasmo-text-center plasmo-py-8 plasmo-text-sm">选择左侧任务查看方案</div>
  }

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-gap-2">
      {solutions.map(s => {
        const st = STATUS_MAP[s.ticketStatus] || STATUS_MAP.pending
        return (
          <div key={s.id}
            className="plasmo-p-5 plasmo-rounded-xl plasmo-bg-canvas plasmo-border"
            style={{ borderColor: s.ticketStatus === 'available' ? 'rgba(62,207,142,0.27)' : '#333' }}>
            <div className="plasmo-flex plasmo-justify-between plasmo-items-center plasmo-mb-3">
              <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
                <span className="plasmo-text-lg plasmo-font-semibold plasmo-text-white">{s.trainNo}</span>
                <span className="plasmo-text-xs plasmo-px-2 plasmo-py-0.5 plasmo-rounded-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-text-text-muted">
                  {PLAN_LABELS[s.planType] || s.planType}
                </span>
                <span className="plasmo-text-xs plasmo-px-2 plasmo-py-0.5 plasmo-rounded-full" style={{ backgroundColor: st.bg, color: st.text }}>
                  {st.label}
                </span>
              </div>
              <span className="plasmo-text-xl plasmo-font-semibold" style={{ color: '#3ecf8e' }}>¥{s.totalPrice}</span>
            </div>
            <div className="plasmo-text-sm plasmo-text-text-muted plasmo-pt-3 plasmo-border-t plasmo-border-border">
              {s.segments.map((seg, i) => (
                <span key={i}>
                  {seg.fromStation} {seg.fromTime} → {seg.toStation} {seg.toTime} {seg.seatType} ¥{seg.price}
                  {i < s.segments.length - 1 ? ' + ' : ''}
                </span>
              ))}
            </div>
            {s.extraFee > 0 && (
              <div className="plasmo-text-xs plasmo-mt-2" style={{ color: '#ffdb13' }}>溢价 ¥{s.extraFee}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Build to verify**

Run: `cd packages/extension && npx plasmo build 2>&1 | tail -5`
Expected: `DONE | Finished in ...ms`

- [ ] **Step 3: Commit**

```bash
cd packages/extension && git add src/dashboard/solution-board.tsx && git commit -m "style: apply Supabase dark theme to solution board"
```

---

### Task 5: Log Stream — terminal dark theme

**Files:**
- Modify: `packages/extension/src/dashboard/log-stream.tsx`

- [ ] **Step 1: Replace all classes in log-stream.tsx**

Replace the return block (lines 12-25) with:
```tsx
  return (
    <div ref={ref} className="plasmo-h-full plasmo-overflow-auto plasmo-bg-log-bg plasmo-font-mono plasmo-text-xs plasmo-p-3 plasmo-rounded-lg plasmo-leading-relaxed">
      {logs.map((l, i) => (
        <div key={i} className="plasmo-py-0.5">
          <span style={{ color: '#707070' }}>{l.time}</span>{' '}
          <span className={l.event === 'ticket_found' ? 'plasmo-font-semibold' : 'plasmo-text-text-muted'}
            style={{ color: l.event === 'ticket_found' ? '#ffdb13' : '#9a9a9a' }}>
            [{l.event}]
          </span>{' '}
          <span style={{ color: '#4ade80' }}>{l.detail}</span>
        </div>
      ))}
      {logs.length === 0 && <div style={{ color: '#707070' }}>等待日志...</div>}
    </div>
  )
```

- [ ] **Step 2: Build to verify**

Run: `cd packages/extension && npx plasmo build 2>&1 | tail -5`
Expected: `DONE | Finished in ...ms`

- [ ] **Step 3: Commit**

```bash
cd packages/extension && git add src/dashboard/log-stream.tsx && git commit -m "style: apply Supabase dark terminal theme to log stream"
```

---

### Task 6: Task Form — modal, inputs, toggles, and buttons

**Files:**
- Modify: `packages/extension/src/dashboard/task-form.tsx`

- [ ] **Step 1: Replace all classes in task-form.tsx**

Replace the entire JSX return block (lines 51-144) with:
```tsx
  return (
    <div className="plasmo-fixed plasmo-inset-0 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-z-50" style={{ backgroundColor: 'rgba(0,0,0,0.53)' }}>
      <div className="plasmo-bg-canvas plasmo-rounded-xl plasmo-p-6 plasmo-w-[480px] plasmo-max-h-[80vh] plasmo-overflow-auto plasmo-border plasmo-border-border">
        <h2 className="plasmo-text-lg plasmo-font-semibold plasmo-text-white plasmo-mb-4">新建监控任务</h2>

        <div className="plasmo-grid plasmo-grid-cols-2 plasmo-gap-3">
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">出发站</label>
            <select value={from} onChange={e => setFrom(e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none">
              <option value="">选择</option>
              {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">目的站</label>
            <select value={to} onChange={e => setTo(e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none">
              <option value="">选择</option>
              {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">日期</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none" />
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">溢价上限(元)</label>
            <input type="number" value={maxExtra} onChange={e => setMaxExtra(+e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none" />
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">时段开始</label>
            <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none" />
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">时段结束</label>
            <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none" />
          </div>
        </div>

        <div className="plasmo-mt-4">
          <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-2 plasmo-block">席别</label>
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2">
            {SEAT_TYPES.map(s => (
              <button key={s} onClick={() => setSeatTypes(toggleArr(seatTypes, s))}
                className="plasmo-px-3 plasmo-py-1 plasmo-rounded-md plasmo-text-sm plasmo-border plasmo-transition-colors"
                style={{
                  backgroundColor: seatTypes.includes(s) ? 'rgba(62,207,142,0.15)' : '#202020',
                  borderColor: seatTypes.includes(s) ? 'rgba(62,207,142,0.27)' : '#333',
                  color: seatTypes.includes(s) ? '#3ecf8e' : '#9a9a9a',
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="plasmo-mt-4">
          <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-2 plasmo-block">策略</label>
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2">
            {STRATEGIES.map(s => (
              <button key={s.key} onClick={() => setStrategies(toggleArr(strategies, s.key))}
                className="plasmo-px-3 plasmo-py-1 plasmo-rounded-md plasmo-text-sm plasmo-border plasmo-transition-colors"
                style={{
                  backgroundColor: strategies.includes(s.key) ? 'rgba(62,207,142,0.15)' : '#202020',
                  borderColor: strategies.includes(s.key) ? 'rgba(62,207,142,0.27)' : '#333',
                  color: strategies.includes(s.key) ? '#3ecf8e' : '#9a9a9a',
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="plasmo-mt-4">
          <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">固定车次 (逗号分隔，可选)</label>
          <input type="text" value={trainNos} onChange={e => setTrainNos(e.target.value)} placeholder="G123,G321"
            className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white placeholder:plasmo-text-[#707070] focus:plasmo-border-primary plasmo-outline-none" />
        </div>

        <div className="plasmo-mt-4 plasmo-grid plasmo-grid-cols-2 plasmo-gap-3">
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">乘车人</label>
            <input type="text" value={passengerName} onChange={e => setPassengerName(e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none" />
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">身份证号</label>
            <input type="text" value={passengerId} onChange={e => setPassengerId(e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none" />
          </div>
        </div>

        <div className="plasmo-flex plasmo-gap-3 plasmo-mt-6 plasmo-justify-end">
          <button onClick={onClose}
            className="plasmo-px-5 plasmo-py-2 plasmo-bg-transparent plasmo-border plasmo-border-border plasmo-text-text-muted plasmo-rounded-md plasmo-text-sm plasmo-font-medium">
            取消
          </button>
          <button onClick={handleSubmit}
            className="plasmo-px-5 plasmo-py-2 plasmo-bg-primary plasmo-text-black plasmo-rounded-md plasmo-text-sm plasmo-font-medium">
            保存并开始
          </button>
        </div>
      </div>
    </div>
  )
```

- [ ] **Step 2: Build to verify**

Run: `cd packages/extension && npx plasmo build 2>&1 | tail -5`
Expected: `DONE | Finished in ...ms`

- [ ] **Step 3: Commit**

```bash
cd packages/extension && git add src/dashboard/task-form.tsx && git commit -m "style: apply Supabase dark theme to task form modal"
```

---

### Task 7: Popup — dark card and button

**Files:**
- Modify: `packages/extension/src/popup.tsx`

- [ ] **Step 1: Replace all classes in popup.tsx**

Replace the JSX return block (lines 9-18) with:
```tsx
  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-justify-center plasmo-p-4 plasmo-w-56 plasmo-bg-canvas">
      <h2 className="plasmo-text-base plasmo-font-semibold plasmo-mb-3 plasmo-text-white">EasyHome</h2>
      <button
        onClick={openDashboard}
        className="plasmo-px-4 plasmo-py-2 plasmo-bg-primary plasmo-text-black plasmo-rounded-md plasmo-text-sm plasmo-font-medium plasmo-w-full">
        打开控制台
      </button>
    </div>
  )
```

- [ ] **Step 2: Build to verify**

Run: `cd packages/extension && npx plasmo build 2>&1 | tail -5`
Expected: `DONE | Finished in ...ms`

- [ ] **Step 3: Commit**

```bash
cd packages/extension && git add src/popup.tsx && git commit -m "style: apply Supabase dark theme to popup"
```

---

### Task 8: Final verification build

**Files:** None (verification only)

- [ ] **Step 1: Clean build**

Run: `cd packages/extension && npx plasmo build 2>&1 | tail -10`
Expected: `DONE | Finished in ...ms` with no errors

- [ ] **Step 2: Check manifest for correctness**

Run: `cat packages/extension/build/chrome-mv3-dev/manifest.json | python3 -m json.tool | grep -E 'newtab|tabs'`
Expected: No `newtab` override found; should show tab-related permissions only

- [ ] **Step 3: Verify all HTML pages generated correctly**

Run: `ls packages/extension/build/chrome-mv3-dev/tabs/dashboard.html && ls packages/extension/build/chrome-mv3-dev/popup.html`
Expected: Both files exist

- [ ] **Step 4: Commit verification**

```bash
cd packages/extension && git add -A && git diff --cached --stat && git commit -m "chore: final verification after Supabase dark theme migration"
```
