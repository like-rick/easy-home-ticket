# Task Form Validation & Passenger Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add required-field validation with inline errors to the task form, and replace free-text passenger name/ID inputs with a 12306 passenger picker that scrapes data via content script.

**Architecture:** Extend the existing `TaskForm` component with an `errors` state and inline error rendering. Replace the two passenger text `<input>` elements with a `PassengerPicker` sub-component that sends `chrome.runtime.sendMessage({type:'FETCH_PASSENGERS'})` to the content script, which checks 12306 cookies and scrapes the passenger list DOM. Falls back to manual input when 12306 is unavailable.

**Tech Stack:** React (Plasmo extension), TypeScript, Chrome Extension APIs, existing Tailwind-like CSS classes

---

### Task 1: Add validation infrastructure and required field markers

**Files:**
- Modify: `packages/extension/src/dashboard/task-form.tsx`

- [ ] **Step 1: Add `errors` state and a helper to render field errors**

In `TaskForm` component, add after the existing `useState` lines (after line 159):

```tsx
const [errors, setErrors] = useState<Record<string, string>>({})

const setFieldError = (field: string, msg: string) => {
  setErrors(prev => ({ ...prev, [field]: msg }))
}

const clearFieldError = (field: string) => {
  setErrors(prev => {
    if (!(field in prev)) return prev
    const next = { ...prev }
    delete next[field]
    return next
  })
}

const fieldErrorClass = (field: string) =>
  errors[field]
    ? 'plasmo-border-red-500'
    : 'plasmo-border-border'
```

- [ ] **Step 2: Add required marker `*` to all field labels except trainNos**

Update labels. Where currently the label is like:
```tsx
<label ...>出发站</label>
```
Change to:
```tsx
<label ...><span className="plasmo-text-red-500">* </span>出发站</label>
```

Apply this pattern to all labels: 出发站, 目的站, 日期, 时段开始, 时段结束, 溢价上限(元), 席别, 策略, 乘车人.

For trainNos, change label to:
```tsx
<label ...>固定车次 <span className="plasmo-text-text-muted">(可选)</span></label>
```

- [ ] **Step 3: Add `fieldErrorClass` to each input and render error text below each field**

For each `<input>` element, add the error border class. Example for the date input (line 202-203):
```tsx
<input type="date" value={date} onChange={e => { setDate(e.target.value); clearFieldError('date') }}
  className={`plasmo-w-full plasmo-bg-canvas-soft plasmo-border ${fieldErrorClass('date')} plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none`} />
{errors.date && <p className="plasmo-text-red-500 plasmo-text-xs plasmo-mt-1">{errors.date}</p>}
```

Apply the same pattern (add `clearFieldError` to onChange, add `fieldErrorClass`, add conditional error `<p>`) to all required inputs:
- 出发站 / 目的站 (StationPicker — needs special handling, see below)
- date
- timeStart, timeEnd
- maxExtra (溢价上限)
- seatTypes (席别)
- strategies (策略)

For StationPicker, add `error` and `onClearError` props:
```tsx
function StationPicker({
  value, onChange, placeholder, error, onClearError,
}: {
  value: StationInfo | null
  onChange: (s: StationInfo | null) => void
  placeholder: string
  error?: string
  onClearError?: () => void
}) {
```

In StationPicker's `select` function, call `onClearError?.()`. In the input className, add `error ? 'plasmo-border-red-500' : 'plasmo-border-border'`. After the dropdown div, render:
```tsx
{error && <p className="plasmo-text-red-500 plasmo-text-xs plasmo-mt-1">{error}</p>}
```

Pass error from TaskForm:
```tsx
<StationPicker value={from} onChange={setFrom} placeholder="必填 — 输入拼音或站名搜索" error={errors.from} onClearError={() => clearFieldError('from')} />
```

- [ ] **Step 4: Commit**

```bash
git add packages/extension/src/dashboard/task-form.tsx
git commit -m "feat: add validation infrastructure and required field markers to task form"
```

---

### Task 2: Implement handleSubmit validation logic

**Files:**
- Modify: `packages/extension/src/dashboard/task-form.tsx`

- [ ] **Step 1: Replace `handleSubmit` with full validation**

Replace the current `handleSubmit` (lines 164-184) with:

```tsx
const handleSubmit = () => {
  const newErrors: Record<string, string> = {}

  if (!from) newErrors.from = '请选择出发站'
  if (!to) newErrors.to = '请选择到达站'
  if (!date) newErrors.date = '请选择出行日期'
  if (!timeStart) newErrors.timeStart = '请选择开始时间'
  if (!timeEnd) newErrors.timeEnd = '请选择结束时间'
  if (!maxExtra || maxExtra <= 0) newErrors.maxExtra = '请填写最多加价金额'
  if (seatTypes.length === 0) newErrors.seatTypes = '请至少选择一种座位类型'
  if (strategies.length === 0) newErrors.strategies = '请至少选择一种监控策略'

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors)
    return
  }

  const send = getSendFn()
  if (!send) return
  const config: TaskConfig = {
    name: `${from!.name}→${to!.name}`,
    fromStation: from!.name,
    toStation: to!.name,
    travelDate: date,
    timeStart,
    timeEnd,
    maxExtraFee: maxExtra,
    seatTypes,
    trainNos: trainNos ? trainNos.split(',').map(s => s.trim()) : undefined,
    strategies,
    passengers: [],
  }
  const taskId = 'local-' + Date.now()
  createTask(config, send)
  routeMessage({ type: 'TASK_CREATED', ...config, id: taskId } as any)
  onClose()
}
```

Note: `passengers` is set to `[]` for now — will be wired in Task 5.

- [ ] **Step 2: Commit**

```bash
git add packages/extension/src/dashboard/task-form.tsx
git commit -m "feat: add full form validation to handleSubmit"
```

---

### Task 3: Add PassengerPicker dropdown multi-select component

**Files:**
- Modify: `packages/extension/src/dashboard/task-form.tsx`

- [ ] **Step 1: Add PassengerPicker component before TaskForm**

Insert before `export function TaskForm(...)` (before line 148):

```tsx
function PassengerPicker({
  passengers,
  onChange,
  error,
  onClearError,
}: {
  passengers: Passenger[]
  onChange: (list: Passenger[]) => void
  error?: string
  onClearError?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<Passenger[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualId, setManualId] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchPassengers = () => {
    setLoading(true)
    setFetchError('')
    chrome.runtime.sendMessage({ type: 'FETCH_PASSENGERS' }, (response) => {
      setLoading(false)
      if (chrome.runtime.lastError || !response) {
        setFetchError('请先打开 12306 官网并登录')
        return
      }
      if (response.error === 'not_logged_in') {
        setFetchError('not_logged_in')
        return
      }
      if (response.error === 'fetch_failed') {
        setFetchError('读取失败，请刷新 12306 页面后重试或手动输入')
        return
      }
      if (response.passengers && response.passengers.length > 0) {
        setList(response.passengers)
        setFetchError('')
      } else {
        setFetchError('未找到常用乘车人，请在 12306 添加乘客或手动输入')
      }
    })
  }

  const togglePassenger = (p: Passenger) => {
    onClearError?.()
    const exists = passengers.find(x => x.id === p.id)
    if (exists) {
      onChange(passengers.filter(x => x.id !== p.id))
    } else {
      onChange([...passengers, p])
    }
  }

  const addManual = () => {
    if (!manualName || !manualId) return
    onClearError?.()
    onChange([...passengers, { id: manualId, name: manualName, idType: '身份证', idNumber: manualId }])
    setManualName('')
    setManualId('')
    setManualMode(false)
  }

  const removePassenger = (id: string) => {
    onChange(passengers.filter(x => x.id !== id))
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openPicker = () => {
    setOpen(true)
    if (list.length === 0 && !loading && !fetchError) fetchPassengers()
  }

  return (
    <div className="plasmo-relative" ref={containerRef}>
      <div
        className={`plasmo-flex plasmo-items-center plasmo-gap-1 plasmo-bg-canvas-soft plasmo-border ${error ? 'plasmo-border-red-500' : 'plasmo-border-border'} plasmo-rounded-md plasmo-px-3 plasmo-py-1.5 plasmo-min-h-[36px] plasmo-cursor-pointer`}
        onClick={openPicker}
      >
        {passengers.length === 0 ? (
          <span className="plasmo-text-sm plasmo-text-[#707070]">选择乘车人</span>
        ) : (
          passengers.map(p => (
            <span key={p.id} className="plasmo-inline-flex plasmo-items-center plasmo-gap-1 plasmo-bg-[#1f2937] plasmo-text-white plasmo-text-xs plasmo-px-2 plasmo-py-0.5 plasmo-rounded">
              {p.name}
              <button onClick={(e) => { e.stopPropagation(); removePassenger(p.id) }}
                className="plasmo-text-[#9a9a9a] hover:plasmo-text-white plasmo-ml-0.5">&times;</button>
            </span>
          ))
        )}
      </div>
      {error && <p className="plasmo-text-red-500 plasmo-text-xs plasmo-mt-1">{error}</p>}

      {open && (
        <div className="plasmo-absolute plasmo-top-full plasmo-mt-1 plasmo-w-full plasmo-bg-[#161616] plasmo-border plasmo-border-border plasmo-rounded-md plasmo-z-50 plasmo-overflow-hidden">
          {loading ? (
            <div className="plasmo-px-3 plasmo-py-3 plasmo-text-sm plasmo-text-text-muted">加载中...</div>
          ) : fetchError === 'not_logged_in' ? (
            <div className="plasmo-p-4 plasmo-text-center">
              <p className="plasmo-text-yellow-500 plasmo-text-sm plasmo-mb-3">未检测到 12306 登录状态</p>
              <button onClick={() => chrome.tabs.create({ url: 'https://kyfw.12306.cn/otn/login/init' })}
                className="plasmo-px-3 plasmo-py-1 plasmo-bg-primary plasmo-text-black plasmo-rounded-md plasmo-text-sm plasmo-mr-2">前往 12306 登录</button>
              <button onClick={() => { setManualMode(true); setFetchError('') }}
                className="plasmo-px-3 plasmo-py-1 plasmo-bg-transparent plasmo-border plasmo-border-border plasmo-text-text-muted plasmo-rounded-md plasmo-text-sm">手动输入</button>
            </div>
          ) : manualMode ? (
            <div className="plasmo-p-3">
              <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} placeholder="姓名"
                className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white plasmo-mb-2 focus:plasmo-border-primary plasmo-outline-none" />
              <input type="text" value={manualId} onChange={e => setManualId(e.target.value)} placeholder="身份证号"
                className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white plasmo-mb-3 focus:plasmo-border-primary plasmo-outline-none" />
              <div className="plasmo-flex plasmo-justify-end plasmo-gap-2">
                <button onClick={() => setManualMode(false)}
                  className="plasmo-px-3 plasmo-py-1 plasmo-text-sm plasmo-text-text-muted">取消</button>
                <button onClick={addManual}
                  className="plasmo-px-3 plasmo-py-1 plasmo-bg-primary plasmo-text-black plasmo-rounded-md plasmo-text-sm">添加</button>
              </div>
            </div>
          ) : fetchError ? (
            <div className="plasmo-p-3">
              <p className="plasmo-text-sm plasmo-text-text-muted plasmo-mb-2">{fetchError}</p>
              <button onClick={() => { setManualMode(true); setFetchError('') }}
                className="plasmo-px-3 plasmo-py-1 plasmo-bg-transparent plasmo-border plasmo-border-border plasmo-text-text-muted plasmo-rounded-md plasmo-text-sm">手动输入</button>
            </div>
          ) : list.length === 0 ? (
            <div className="plasmo-px-3 plasmo-py-3 plasmo-text-sm plasmo-text-text-muted">无可用乘车人</div>
          ) : (
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              {list.map(p => {
                const selected = !!passengers.find(x => x.id === p.id)
                return (
                  <div key={p.id}
                    onClick={() => togglePassenger(p)}
                    className="plasmo-flex plasmo-items-center plasmo-px-3 plasmo-py-2 plasmo-cursor-pointer hover:plasmo-bg-[#1f2937] plasmo-text-sm"
                  >
                    <span className={selected ? 'plasmo-text-primary' : 'plasmo-text-[#4b5563]'} style={{ marginRight: 8 }}>
                      {selected ? '✓' : '○'}
                    </span>
                    <div className="plasmo-flex-1">
                      <span className="plasmo-text-white">{p.name}</span>
                      <span className="plasmo-text-xs plasmo-text-text-muted plasmo-ml-2">{p.idNumber.replace(/(\d{4})\d+(\d{4})/, '$1****$2')}</span>
                    </div>
                    <span className="plasmo-text-xs plasmo-px-2 plasmo-py-0.5 plasmo-rounded" style={{ backgroundColor: '#1f2937', color: p.idType === '学生' ? '#f59e0b' : '#10b981' }}>
                      {p.idType}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

Note: `Passenger` is imported from `'../lib/types'` — add it to the import on line 2:
```tsx
import type { TaskConfig, StationInfo, Passenger } from '../lib/types'
```

- [ ] **Step 2: Commit**

```bash
git add packages/extension/src/dashboard/task-form.tsx
git commit -m "feat: add PassengerPicker dropdown multi-select component"
```

---

### Task 4: Add FETCH_PASSENGERS handler to content script

**Files:**
- Modify: `packages/extension/src/content.tsx`

- [ ] **Step 1: Add FETCH_PASSENGERS message handler**

Replace the content of `packages/extension/src/content.tsx` with:

```tsx
import type { PlasmoCSConfig } from "plasmo"
import type { OrderSignal, Passenger } from "./lib/types"
import { executeOrder } from "./content/executor"

export const config: PlasmoCSConfig = {
  matches: ["https://kyfw.12306.cn/*"]
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'ORDER_SIGNAL') {
    executeOrder(msg as OrderSignal).then(result => {
      chrome.runtime.sendMessage({ type: 'ORDER_RESULT', taskId: msg.taskId, result })
    })
    sendResponse({ ack: true })
    return true
  }

  if (msg.type === 'FETCH_PASSENGERS') {
    fetchPassengers().then(passengers => {
      sendResponse({ passengers })
    }).catch(err => {
      sendResponse({ error: err.message || 'fetch_failed' })
    })
    return true
  }
})

async function fetchPassengers(): Promise<Passenger[]> {
  // Check login cookies
  const cookies = document.cookie
  if (!cookies.includes('_passport_ct') && !cookies.includes('tk=') && !cookies.includes('uamtk')) {
    throw new Error('not_logged_in')
  }

  // Navigate to passenger page if not already there
  const onPassengerPage = location.href.includes('passengers') || location.href.includes('passenger')
  if (!onPassengerPage) {
    const resp = await fetch('https://kyfw.12306.cn/otn/confirmPassenger/getPassengerDTOs', { credentials: 'include' })
    if (!resp.ok) throw new Error('fetch_failed')
    const data = await resp.json()
    if (!data.status && data.httpstatus !== 200) throw new Error('not_logged_in')
    const list = data.data?.normal_passengers || data.data?.passenger_info_dto_list || data.data?.list || []
    if (!list.length) return []
    return list.map((p: any) => ({
      id: p.passenger_id || p.passenger_uuid || p.allEncStr || p.code || '',
      name: p.passenger_name || p.name || '',
      idType: p.passenger_id_type_name || p.id_type_name || '成人',
      idNumber: p.passenger_id_no || p.id_number || '',
    }))
  }

  // DOM scraping fallback on passenger list page
  const rows = document.querySelectorAll('#passenger_list li, .passenger-item, [id*="passenger"] li, tr[class*="passenger"]')
  const result: Passenger[] = []
  rows.forEach(row => {
    const nameEl = row.querySelector('[class*="name"], .passenger-name, td:nth-child(2)')
    const idEl = row.querySelector('[class*="id"], .passenger-id, td:nth-child(3)')
    if (nameEl && idEl) {
      result.push({
        id: idEl.textContent?.trim() || '',
        name: nameEl.textContent?.trim() || '',
        idType: '成人',
        idNumber: idEl.textContent?.trim() || '',
      })
    }
  })
  return result
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/extension/src/content.tsx
git commit -m "feat: add FETCH_PASSENGERS handler to content script"
```

---

### Task 5: Wire passenger picker into TaskForm and handleSubmit

**Files:**
- Modify: `packages/extension/src/dashboard/task-form.tsx`

- [ ] **Step 1: Replace passenger state and inputs with PassengerPicker**

Remove these two lines (158-159):
```tsx
const [passengerName, setPassengerName] = useState('')
const [passengerId, setPassengerId] = useState('')
```

Add:
```tsx
const [passengers, setPassengers] = useState<Passenger[]>([])
```

Replace the passenger name + ID inputs section (lines 262-273):
```tsx
<div className="plasmo-mt-4 plasmo-grid plasmo-grid-cols-2 plasmo-gap-3">
  <div>
    <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">
      <span className="plasmo-text-red-500">* </span>乘车人
    </label>
    <PassengerPicker
      passengers={passengers}
      onChange={(list) => { setPassengers(list); clearFieldError('passengers') }}
      error={errors.passengers}
      onClearError={() => clearFieldError('passengers')}
    />
  </div>
</div>
```

But keep the grid layout balanced. The passenger picker spans full width since it replaces two inputs. Adjust the containing div:

Replace lines 262-273 with:
```tsx
<div className="plasmo-mt-4">
  <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">
    <span className="plasmo-text-red-500">* </span>乘车人
  </label>
  <PassengerPicker
    passengers={passengers}
    onChange={(list) => { setPassengers(list); clearFieldError('passengers') }}
    error={errors.passengers}
    onClearError={() => clearFieldError('passengers')}
  />
</div>
```

- [ ] **Step 2: Update handleSubmit to validate passengers and pass real data**

In handleSubmit, add the passenger check before the error count check:
```tsx
if (passengers.length === 0) newErrors.passengers = '请至少选择一位乘车人'
```

And update the `passengers` field in the config from `passengers: []` to:
```tsx
passengers,
```

- [ ] **Step 3: Commit**

```bash
git add packages/extension/src/dashboard/task-form.tsx
git commit -m "feat: wire passenger picker into task form and handleSubmit"
```

---

### Task 6: Add visual companion waiting screen and verify

**Files:**
- Create: `.superpowers/brainstorm/23665-1778385386/content/waiting-final.html`

- [ ] **Step 1: Push waiting screen**

```html
<div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
  <p class="subtitle">Design complete — continuing in terminal...</p>
</div>
```

- [ ] **Step 2: Verify the build compiles**

```bash
cd packages/extension && npx plasmo build 2>&1 | tail -20
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add .superpowers/brainstorm/23665-1778385386/content/waiting-final.html
git commit -m "chore: add visual companion waiting screen"
```

---

### Verification

1. Open the extension dashboard (`npm run dev` in `packages/extension`)
2. Click "+ 新建任务" to open the task form
3. **Required markers:** verify all labels except 车次 have red `*`
4. **Inline errors:** click "保存并开始" with empty form → red borders + error text on all required fields
5. **Error clearing:** fill in a field → its error disappears immediately
6. **Passenger picker — logged out:** click "选择乘车人" → shows "未检测到 12306 登录状态" with two buttons
7. **Passenger picker — no 12306 tab:** verify timeout message "请先打开 12306 官网并登录" appears
8. **Passenger picker — logged in:** open 12306, login, go back to form, click "选择乘车人" → passenger list appears, multi-select works, tags show selected names
9. **Manual fallback:** click "手动输入" → name/ID inputs appear → add a passenger
10. **Submit success:** fill all required fields, select a passenger, click "保存并开始" → form closes, task appears in list
