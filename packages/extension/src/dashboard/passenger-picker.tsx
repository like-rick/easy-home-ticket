import React, { useState, useEffect, useRef } from 'react'
import type { Passenger } from '../lib/types'

export function PassengerPicker({
  passengers, onChange, error, onClearError,
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
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchPassengers = () => {
    setLoading(true); setFetchError('')
    chrome.tabs.query({ url: 'https://kyfw.12306.cn/*' }, (tabs) => {
      const tab = tabs.find(t => !t.discarded)
      if (!tab?.id) { setLoading(false); setFetchError('请先打开 12306 官网并登录'); return }
      chrome.tabs.sendMessage(tab.id, { type: 'FETCH_PASSENGERS' }, (response) => {
        setLoading(false)
        if (chrome.runtime.lastError || !response) { setFetchError('请先打开 12306 官网并登录'); return }
        if (response.error === 'not_logged_in') { setFetchError('not_logged_in'); return }
        if (response.passengers?.length > 0) { setList(response.passengers) }
        else { setFetchError('未找到常用乘车人') }
      })
    })
  }

  const toggle = (p: Passenger) => {
    onClearError?.()
    if (passengers.find(x => x.id === p.id)) onChange(passengers.filter(x => x.id !== p.id))
    else onChange([...passengers, p])
  }

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="plasmo-relative" ref={containerRef}>
      <div onClick={() => { setOpen(true); if (list.length === 0 && !loading && !fetchError) fetchPassengers() }}
        className={`plasmo-flex plasmo-items-center plasmo-gap-1 plasmo-bg-canvas-soft plasmo-border ${error ? 'plasmo-border-red-500' : 'plasmo-border-border'} plasmo-rounded-md plasmo-px-3 plasmo-py-1.5 plasmo-min-h-[36px] plasmo-cursor-pointer`}>
        {passengers.length === 0 ? <span className="plasmo-text-sm plasmo-text-[#707070]">选择乘车人</span>
          : passengers.map(p => <span key={p.id} className="plasmo-inline-flex plasmo-items-center plasmo-gap-1 plasmo-bg-[#1f2937] plasmo-text-white plasmo-text-xs plasmo-px-2 plasmo-py-0.5 plasmo-rounded">
            {p.name}<button onClick={e => { e.stopPropagation(); onChange(passengers.filter(x => x.id !== p.id)) }} className="plasmo-text-[#9a9a9a] hover:plasmo-text-white plasmo-ml-0.5">&times;</button></span>)}
      </div>
      {error && <p className="plasmo-text-red-500 plasmo-text-xs plasmo-mt-1">{error}</p>}
      {open && (
        <div className="plasmo-absolute plasmo-top-full plasmo-mt-1 plasmo-w-full plasmo-bg-[#161616] plasmo-border plasmo-border-border plasmo-rounded-md plasmo-z-50 plasmo-overflow-hidden">
          {loading ? <div className="plasmo-px-3 plasmo-py-3 plasmo-text-sm plasmo-text-text-muted">加载中...</div>
            : fetchError === 'not_logged_in' ? <div className="plasmo-p-4 plasmo-text-center"><p className="plasmo-text-yellow-500 plasmo-text-sm">未检测到 12306 登录状态</p></div>
              : fetchError ? <div className="plasmo-p-3"><p className="plasmo-text-sm plasmo-text-text-muted">{fetchError}</p></div>
                : list.length === 0 ? <div className="plasmo-px-3 plasmo-py-3 plasmo-text-sm plasmo-text-text-muted">无可用乘车人</div>
                  : <div style={{ maxHeight: 200, overflow: 'auto' }}>
                    {list.map(p => {
                      const sel = !!passengers.find(x => x.id === p.id)
                      return <div key={p.id} onClick={() => toggle(p)} className="plasmo-flex plasmo-items-center plasmo-px-3 plasmo-py-2 plasmo-cursor-pointer hover:plasmo-bg-[#1f2937] plasmo-text-sm">
                        <span className={sel ? 'plasmo-text-primary' : 'plasmo-text-[#4b5563]'} style={{ marginRight: 8 }}>{sel ? '✓' : '○'}</span>
                        <span className="plasmo-text-white plasmo-flex-1">{p.name}</span>
                        <span className="plasmo-text-xs plasmo-px-2 plasmo-py-0.5 plasmo-rounded" style={{ backgroundColor: '#1f2937', color: '#10b981' }}>{p.idType}</span>
                      </div>
                    })}
                  </div>}
        </div>
      )}
    </div>
  )
}
