import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { TaskConfig, StationInfo } from '../lib/types'
import { createTask, fetchStations } from '../lib/api'
import { getSendFn } from '../background/ws-client'
import { routeMessage } from '../background/state'

const SEAT_TYPES = ['二等座', '一等座', '商务座', '硬卧', '软卧', '硬座']
const STRATEGIES = [
  { key: 'direct', label: '直达' },
  { key: 'split', label: '同车换乘' },
  { key: 'longer', label: '买长乘短' },
  { key: 'cross', label: '非同车换乘' },
]

function StationPicker({
  value,
  onChange,
  placeholder,
  error,
  onClearError,
}: {
  value: StationInfo | null
  onChange: (s: StationInfo | null) => void
  placeholder: string
  error?: string
  onClearError?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<StationInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const doSearch = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const stations = await fetchStations(q)
      setOptions(stations)
      setHighlightIdx(-1)
    } finally {
      setLoading(false)
    }
  }, [])

  const onInputChange = (v: string) => {
    setQuery(v)
    setOpen(true)
    if (value && v !== value.name) onChange(null)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(v), 200)
  }

  const select = (s: StationInfo) => {
    onChange(s)
    setQuery(s.name)
    setOpen(false)
    setHighlightIdx(-1)
    onClearError?.()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(i => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIdx >= 0 && options[highlightIdx]) {
        select(options[highlightIdx])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  useEffect(() => {
    if (open && !options.length && !loading) doSearch('')
  }, [open])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node) &&
          listRef.current && !listRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const highlightMatch = (text: string) => {
    if (!query) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx < 0) return text
    return (
      <>
        {text.slice(0, idx)}
        <span className="plasmo-text-primary">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    )
  }

  return (
    <div className="plasmo-relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => onInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={`plasmo-w-full plasmo-bg-canvas-soft plasmo-border ${error ? 'plasmo-border-red-500' : 'plasmo-border-border'} plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white placeholder:plasmo-text-[#707070] focus:plasmo-border-primary plasmo-outline-none`}
      />
      {open && (
        <div
          ref={listRef}
          className="plasmo-absolute plasmo-top-full plasmo-mt-1 plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-overflow-auto plasmo-z-50"
          style={{ maxHeight: 240 }}
        >
          {loading ? (
            <div className="plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-text-muted">加载中...</div>
          ) : options.length === 0 ? (
            <div className="plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-text-muted">无匹配车站</div>
          ) : (
            options.map((s, i) => (
              <div
                key={s.code}
                onClick={() => select(s)}
                className="plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-cursor-pointer plasmo-flex plasmo-justify-between plasmo-items-center"
                style={{ backgroundColor: i === highlightIdx ? 'rgba(62,207,142,0.12)' : 'transparent' }}
                onMouseEnter={() => setHighlightIdx(i)}
              >
                <span className="plasmo-text-white">{highlightMatch(s.name)}</span>
                <span className="plasmo-text-xs plasmo-text-text-muted">{s.pinyin}</span>
              </div>
            ))
          )}
        </div>
      )}
      {error && <p className="plasmo-text-red-500 plasmo-text-xs plasmo-mt-1">{error}</p>}
    </div>
  )
}

export function TaskForm({ onClose }: { onClose: () => void }) {
  const [from, setFrom] = useState<StationInfo | null>(null)
  const [to, setTo] = useState<StationInfo | null>(null)
  const [date, setDate] = useState('')
  const [timeStart, setTimeStart] = useState('00:00')
  const [timeEnd, setTimeEnd] = useState('23:59')
  const [maxExtra, setMaxExtra] = useState(30)
  const [seatTypes, setSeatTypes] = useState<string[]>(['二等座'])
  const [trainNos, setTrainNos] = useState('')
  const [strategies, setStrategies] = useState<string[]>(['direct', 'split', 'longer', 'cross'])
  const [passengerName, setPassengerName] = useState('')
  const [passengerId, setPassengerId] = useState('')
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

  const toggleArr = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]

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

  return (
    <div className="plasmo-fixed plasmo-inset-0 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-z-50" style={{ backgroundColor: 'rgba(0,0,0,0.53)' }}>
      <div className="plasmo-bg-canvas plasmo-rounded-xl plasmo-p-6 plasmo-w-[480px] plasmo-max-h-[80vh] plasmo-overflow-auto plasmo-border plasmo-border-border">
        <h2 className="plasmo-text-lg plasmo-font-semibold plasmo-text-white plasmo-mb-4">新建监控任务</h2>

        <div className="plasmo-grid plasmo-grid-cols-2 plasmo-gap-3">
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block"><span className="plasmo-text-red-500">* </span>出发站</label>
            <StationPicker value={from} onChange={setFrom} placeholder="必填 — 输入拼音或站名搜索" error={errors.from} onClearError={() => clearFieldError('from')} />
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block"><span className="plasmo-text-red-500">* </span>目的站</label>
            <StationPicker value={to} onChange={setTo} placeholder="必填 — 输入拼音或站名搜索" error={errors.to} onClearError={() => clearFieldError('to')} />
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block"><span className="plasmo-text-red-500">* </span>日期</label>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); clearFieldError('date') }}
              className={`plasmo-w-full plasmo-bg-canvas-soft plasmo-border ${fieldErrorClass('date')} plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none`} />
            {errors.date && <p className="plasmo-text-red-500 plasmo-text-xs plasmo-mt-1">{errors.date}</p>}
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block"><span className="plasmo-text-red-500">* </span>溢价上限(元)</label>
            <input type="number" value={maxExtra} onChange={e => { setMaxExtra(+e.target.value); clearFieldError('maxExtra') }}
              className={`plasmo-w-full plasmo-bg-canvas-soft plasmo-border ${fieldErrorClass('maxExtra')} plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none`} />
            {errors.maxExtra && <p className="plasmo-text-red-500 plasmo-text-xs plasmo-mt-1">{errors.maxExtra}</p>}
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block"><span className="plasmo-text-red-500">* </span>时段开始</label>
            <input type="time" value={timeStart} onChange={e => { setTimeStart(e.target.value); clearFieldError('timeStart') }}
              className={`plasmo-w-full plasmo-bg-canvas-soft plasmo-border ${fieldErrorClass('timeStart')} plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none`} />
            {errors.timeStart && <p className="plasmo-text-red-500 plasmo-text-xs plasmo-mt-1">{errors.timeStart}</p>}
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block"><span className="plasmo-text-red-500">* </span>时段结束</label>
            <input type="time" value={timeEnd} onChange={e => { setTimeEnd(e.target.value); clearFieldError('timeEnd') }}
              className={`plasmo-w-full plasmo-bg-canvas-soft plasmo-border ${fieldErrorClass('timeEnd')} plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none`} />
            {errors.timeEnd && <p className="plasmo-text-red-500 plasmo-text-xs plasmo-mt-1">{errors.timeEnd}</p>}
          </div>
        </div>

        <div className="plasmo-mt-4">
          <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-2 plasmo-block"><span className="plasmo-text-red-500">* </span>席别</label>
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2">
            {SEAT_TYPES.map(s => (
              <button key={s} onClick={() => { setSeatTypes(toggleArr(seatTypes, s)); clearFieldError('seatTypes') }}
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
          {errors.seatTypes && <p className="plasmo-text-red-500 plasmo-text-xs plasmo-mt-1">{errors.seatTypes}</p>}
        </div>

        <div className="plasmo-mt-4">
          <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-2 plasmo-block"><span className="plasmo-text-red-500">* </span>策略</label>
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2">
            {STRATEGIES.map(s => (
              <button key={s.key} onClick={() => { setStrategies(toggleArr(strategies, s.key)); clearFieldError('strategies') }}
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
          {errors.strategies && <p className="plasmo-text-red-500 plasmo-text-xs plasmo-mt-1">{errors.strategies}</p>}
        </div>

        <div className="plasmo-mt-4">
          <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">固定车次 <span className="plasmo-text-text-muted">(可选)</span></label>
          <input type="text" value={trainNos} onChange={e => setTrainNos(e.target.value)} placeholder="G123,G321"
            className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white placeholder:plasmo-text-[#707070] focus:plasmo-border-primary plasmo-outline-none" />
        </div>

        <div className="plasmo-mt-4 plasmo-grid plasmo-grid-cols-2 plasmo-gap-3">
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block"><span className="plasmo-text-red-500">* </span>乘车人</label>
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
}
