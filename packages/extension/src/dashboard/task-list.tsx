import React, { useState, useEffect, useRef } from 'react'
import type { StoredTask } from '../lib/storage'
import type { ParsedTicket } from '../content/poller'

const ALL_SEATS = ['商务座', '一等座', '二等座', '软卧', '硬卧', '硬座', '无座']

function TaskDetail({ task }: { task: StoredTask }) {
  const [ticket, setTicket] = useState<ParsedTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()
  const fetchData = () => {
    chrome.tabs.query({ url: 'https://kyfw.12306.cn/*' }, (tabs) => {
      const tab = tabs.find(t => !t.discarded)
      if (!tab?.id) { setLoading(false); return }
      chrome.tabs.sendMessage(tab.id, {
        type: 'QUERY_DETAIL',
        trainNo: task.trainNo,
        date: task.travelDate,
        fromStationName: task.fromStation,
        toStationName: task.toStation,
      }, (response) => {
        setLoading(false)
        if (chrome.runtime.lastError || !response) return
        setTicket(response.ticket || null)
      })
    })
  }

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 2000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [task.id])

  return (
    <div className="plasmo-mt-3 plasmo-pt-3 plasmo-border-t plasmo-border-border">
      {loading && !ticket ? (
        <div className="plasmo-text-xs plasmo-text-text-muted plasmo-py-4 plasmo-text-center">加载中...</div>
      ) : !ticket ? (
        <div className="plasmo-text-xs plasmo-text-text-muted plasmo-py-4 plasmo-text-center">暂无数据，请确保已登录12306</div>
      ) : (
        <>
          {/* schedule info */}
          <div className="plasmo-flex plasmo-items-center plasmo-gap-4 plasmo-mb-3 plasmo-text-sm">
            <span className="plasmo-text-white">{ticket.departTime}</span>
            <span className="plasmo-text-text-muted">→</span>
            <span className="plasmo-text-white">{ticket.arriveTime}</span>
            <span className="plasmo-text-text-muted">{ticket.duration}</span>
            {ticket.saleTime && (
              <span className="plasmo-text-xs plasmo-text-text-muted">
                起售: {ticket.saleTime.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3 $4:$5')}
              </span>
            )}
          </div>

          {/* seat grid */}
          <div className="plasmo-grid plasmo-grid-cols-7 plasmo-gap-1.5 plasmo-mb-3">
            {ALL_SEATS.map(name => {
              const val = ticket.seats[name] || '--'
              const hasTicket = val !== '无' && val !== '--' && val !== ''
              const isTarget = task.seatTypes.includes(name)
              return (
                <div key={name} className="plasmo-p-1.5 plasmo-rounded-md plasmo-text-center"
                  style={{ backgroundColor: hasTicket ? 'rgba(62,207,142,0.1)' : '#1a1a1a', borderWidth: 1, borderStyle: 'solid', borderColor: isTarget ? 'rgba(62,207,142,0.4)' : 'transparent' }}>
                  <div className="plasmo-text-[10px] plasmo-text-text-muted">{name}</div>
                  <div className="plasmo-text-sm plasmo-font-semibold" style={{ color: hasTicket ? '#3ecf8e' : '#555' }}>{val}</div>
                </div>
              )
            })}
          </div>

          {/* strategies */}
          <div className="plasmo-space-y-1.5">
            {task.strategies.map((s, i) => (
              <div key={i} className="plasmo-flex plasmo-justify-between plasmo-items-center plasmo-p-2 plasmo-rounded-md plasmo-bg-[#111] plasmo-text-sm">
                <div>
                  <span className="plasmo-text-white">{s.label}</span>
                  <span className="plasmo-text-xs plasmo-text-text-muted plasmo-ml-1.5">
                    [{s.type === 'direct' ? '直达' : s.type === 'split' ? '上车补票' : s.type === 'longer1' ? '多买一站' : '多买两站'}]
                  </span>
                </div>
                <div>
                  <span style={{ color: '#3ecf8e' }}>¥{s.totalPrice}</span>
                  {s.extraFee > 0 && <span className="plasmo-text-xs plasmo-text-yellow-500 plasmo-ml-1">+{s.extraFee}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface TaskItem {
  id: string
  name: string
  fromStation: string
  toStation: string
  travelDate: string
  status: string
}

export function TaskList({ tasks, onSelect, selectedId, onDelete, getFullTask }: {
  tasks: TaskItem[]
  onSelect: (id: string) => void
  selectedId: string | null
  onDelete?: (id: string) => void
  getFullTask?: (id: string) => StoredTask | undefined
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-gap-2">
      {tasks.map(t => {
        const isExpanded = expandedId === t.id
        const full = getFullTask?.(t.id)
        return (
          <div key={t.id}>
            <div onClick={() => { onSelect(t.id); setExpandedId(isExpanded ? null : t.id) }}
              className={`plasmo-p-4 plasmo-rounded-xl plasmo-cursor-pointer plasmo-border plasmo-transition-colors ${selectedId === t.id ? 'plasmo-border-primary plasmo-bg-canvas' : 'plasmo-border-border plasmo-bg-canvas hover:plasmo-border-primary/30'}`}>
              <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
                <div className="plasmo-w-8 plasmo-h-8 plasmo-rounded-lg plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-sm plasmo-flex-shrink-0">
                  🚄
                </div>
                <div className="plasmo-flex-1 plasmo-min-w-0">
                  <div className="plasmo-flex plasmo-justify-between plasmo-items-center">
                    <span className="plasmo-text-sm plasmo-font-medium plasmo-text-white plasmo-truncate">{t.name}</span>
                    <span className="plasmo-w-1.5 plasmo-h-1.5 plasmo-rounded-full plasmo-flex-shrink-0 plasmo-ml-2"
                      style={{ backgroundColor: (t.status === 'scanning' || t.status === 'active') ? '#3ecf8e' : t.status === 'ordered' ? '#f59e0b' : '#707070', boxShadow: (t.status === 'scanning' || t.status === 'active') ? '0 0 5px #3ecf8e88' : 'none' }} />
                  </div>
                  <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-mt-1">
                    <span className="plasmo-text-xs plasmo-text-text-muted">{t.travelDate}</span>
                    <span className="plasmo-text-xs" style={{ color: t.status === 'scanning' ? '#3ecf8e' : t.status === 'ordered' ? '#f59e0b' : '#707070' }}>
                      {t.status === 'scanning' ? '轮询中' : t.status === 'ordered' ? '已下单' : t.status === 'active' ? '监控中' : '等待中'}
                    </span>
                    <span className="plasmo-text-xs plasmo-text-text-muted">{isExpanded ? '收起 ▲' : '展开 ▼'}</span>
                    {onDelete && <button onClick={e => { e.stopPropagation(); onDelete(t.id) }} className="plasmo-ml-auto plasmo-text-xs plasmo-text-red-500 hover:plasmo-text-red-400">删除</button>}
                  </div>
                </div>
              </div>
            </div>
            {isExpanded && full && <TaskDetail task={full} />}
          </div>
        )
      })}
      {tasks.length === 0 && (
        <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-gap-3 plasmo-py-12">
          <div className="plasmo-w-12 plasmo-h-12 plasmo-rounded-full plasmo-bg-canvas plasmo-border plasmo-border-border plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-xl">🎫</div>
          <div className="plasmo-text-text-muted plasmo-text-sm">暂无监控任务</div>
          <div className="plasmo-text-[#707070] plasmo-text-xs">点击"+ 新建任务"开始抢票监控</div>
        </div>
      )}
    </div>
  )
}
