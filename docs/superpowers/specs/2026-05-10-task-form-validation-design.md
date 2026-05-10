# Task Form Validation & Passenger Picker

**Date:** 2026-05-10
**Status:** draft

## Context

The task creation form currently has no user-facing validation — required fields silently fail on submit. Passenger name and ID number are free-text `<input>` fields, requiring users to manually type identity information that is already available in their 12306 account. This spec addresses both gaps.

## Design

### 1. Form Validation

**Required field marking:**
- Every field label prefixed with red `*` (required indicator)
- `trainNos` (车次) label suffixed with gray `(可选)` text
- Required field placeholders prompt "必填 — ...", optional fields show "可选，..."

**Field classification:**

| Field | Required | Default |
|---|---|---|
| 出发站 (from) | Yes | — |
| 到达站 (to) | Yes | — |
| 日期 (date) | Yes | — |
| 时间范围 (timeStart/timeEnd) | Yes | 00:00 / 23:59 |
| 最多加价 (maxExtra) | Yes | 30 |
| 座位类型 (seatTypes) | Yes | 二等座 |
| 策略 (strategies) | Yes | all four |
| 车次 (trainNos) | No | empty |
| 乘车人 (passengers) | Yes | — |

**Validation on submit (`handleSubmit`):**
- Check each required field; if invalid, set `errors[fieldName] = message` and return
- Each field clears its own error on change (`onChange` / `onSelect`)
- Inline error: input border turns red, error text rendered below the input in red 11px

**Error messages:**

| Field | Error message |
|---|---|
| from / to | "请选择出发站" / "请选择到达站" |
| date | "请选择出行日期" |
| timeStart / timeEnd | "请选择时间范围" |
| maxExtra | "请填写最多加价金额" |
| seatTypes | "请至少选择一种座位类型" |
| strategies | "请至少选择一种监控策略" |
| passengers | "请至少选择一位乘车人" |

### 2. Passenger Picker (12306 Integration)

**Architecture:**
```
task-form  ──chrome.runtime.sendMessage──▶  content.tsx (12306 page)
  {type:'FETCH_PASSENGERS'}                   │
                                          check 12306 cookies
                                              │        │
                                           有效      无效
                                              │        └─▶ {error:'not_logged_in'}
                                          scrape DOM
                                          parse passengers
                                              │
                                              └─▶ {passengers: Passenger[]}
```

**Content Script changes (`content.tsx`):**
- Add `chrome.runtime.onMessage` handler for `FETCH_PASSENGERS`
- Check for 12306 login cookies (e.g., `tk`, `_passport_ct`)
- If not logged in → respond `{ error: 'not_logged_in' }`
- If logged in → navigate to/navigate the 12306 passenger page, scrape the passenger list DOM, extract name / idType / idNumber
- Respond `{ passengers: Passenger[] }`

**Form changes (`task-form.tsx`):**
- Replace `<input>` for passenger name + ID with a "选择乘车人" button
- On click:
  1. Send `chrome.runtime.sendMessage({ type: 'FETCH_PASSENGERS' })` with a timeout (5s)
  2. If timeout or no content script → show "请先打开 12306 官网并登录"
  3. If `not_logged_in` → show warning card with two buttons:
     - "前往 12306 登录" — opens 12306 login page in new tab
     - "手动输入" — fallback to existing text input mode
  4. If success → render a dropdown multi-select list
- Dropdown shows each passenger: name, masked ID (e.g., `110101****1234`), type badge (成人/学生)
- Checkbox multi-select; selected passengers shown as tags in the input area
- "确认选择" button closes dropdown

**Edge cases:**
1. **No 12306 tab open** → Content Script only injects on `kyfw.12306.cn/*`. Message times out → prompt "请先打开 12306 官网并登录"
2. **Scrape failure** → DOM parse error or unexpected page structure → return `{ error: 'fetch_failed' }` → prompt "读取失败，请刷新 12306 页面后重试或手动输入"
3. **Empty passenger list** → Account has no saved passengers → prompt "未找到常用乘车人，请在 12306 添加乘客或手动输入"
4. **Multiple 12306 tabs** → Content script injects in all. First response wins; no conflict.
5. **Existing `Passenger` interface** in `types.ts` has `{ id, name, idType, idNumber }` — confirmed sufficient.

### 3. Files Modified

| File | Changes |
|---|---|
| `packages/extension/src/dashboard/task-form.tsx` | Field labels with required markers, `errors` state, `handleSubmit` validation, inline error rendering, passenger dropdown multi-select, 12306 login check flow |
| `packages/extension/src/content.tsx` | New `FETCH_PASSENGERS` message handler, cookie check, passenger DOM scraping, response |
| `packages/extension/src/lib/types.ts` | No changes needed (existing `Passenger` interface is sufficient) |

## Verification

1. **Form validation:**
   - Open task form, leave all fields empty, click save → all required fields show red border + error text
   - Fill fields one by one → each field's error clears on input
   - Submit with all valid data → form closes, task appears in list

2. **Passenger picker:**
   - Without 12306 tab open → click "选择乘车人" → timeout → "请先打开 12306 官网并登录" shown
   - Open 12306 in another tab, not logged in → click "选择乘车人" → "未检测到登录状态" warning with two buttons
   - Log into 12306 → click "选择乘车人" → dropdown with passenger list → multi-select → confirm
   - Fallback manual input still accessible

3. **Runtime:** `npm run dev` in extension package, open dashboard tab, test the form flow end-to-end
