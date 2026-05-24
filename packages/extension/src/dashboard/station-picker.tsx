import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { StationInfo } from '../lib/types'
import { searchStations } from '../lib/storage'

export function StationPicker({
  value, onChange, placeholder, error, onClearError,
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
      setOptions(await searchStations(q))
      setHighlightIdx(-1)
    } finally { setLoading(false) }
  }, [])

  const onInput = (v: string) => {
    setQuery(v); setOpen(true)
    if (value && v !== value.name) onChange(null)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(v), 200)
  }

  const select = (s: StationInfo) => {
    onChange(s); setQuery(s.name); setOpen(false); onClearError?.()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (highlightIdx >= 0 && options[highlightIdx]) select(options[highlightIdx]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  useEffect(() => { if (open && !options.length && !loading) doSearch('') }, [open])
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node) && listRef.current && !listRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="plasmo-relative">
      <input ref={inputRef} type="text" value={query}
        onChange={e => onInput(e.target.value)} onFocus={() => setOpen(true)} onKeyDown={onKey}
        placeholder={placeholder} autoComplete="off"
        className={`plasmo-w-full plasmo-bg-canvas-soft plasmo-border ${error ? 'plasmo-border-red-500' : 'plasmo-border-border'} plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white placeholder:plasmo-text-[#707070] focus:plasmo-border-primary plasmo-outline-none`} />
      {open && (
        <div ref={listRef} className="plasmo-absolute plasmo-top-full plasmo-mt-1 plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-overflow-auto plasmo-z-50" style={{ maxHeight: 240 }}>
          {loading ? <div className="plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-text-muted">加载中...</div>
            : options.length === 0 ? <div className="plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-text-muted">无匹配车站</div>
              : options.map((s, i) => (
                <div key={s.code} onClick={() => select(s)}
                  className="plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-cursor-pointer plasmo-flex plasmo-justify-between"
                  style={{ backgroundColor: i === highlightIdx ? 'rgba(62,207,142,0.12)' : 'transparent' }}
                  onMouseEnter={() => setHighlightIdx(i)}>
                  <span className="plasmo-text-white">{s.name}</span>
                  <span className="plasmo-text-xs plasmo-text-text-muted">{s.pinyin}</span>
                </div>
              ))}
        </div>
      )}
      {error && <p className="plasmo-text-red-500 plasmo-text-xs plasmo-mt-1">{error}</p>}
    </div>
  )
}
