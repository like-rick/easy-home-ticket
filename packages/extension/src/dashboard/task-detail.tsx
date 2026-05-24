import React, { useState, useEffect, useRef } from 'react'
import type { StoredTask } from '../lib/storage'
import type { ParsedTicket } from '../content/poller'

const ALL_SEATS = ['商务座', '一等座', '二等座', '软卧', '硬卧', '硬座', '无座']

export function TaskDetail({ task, onClose }: { task: StoredTask; onClose: () => void }) {
  const [ticket, setTicket] = useState<ParsedTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const primaryStrategy = task.strategies[0]

  const fetchData = () => {
    if (!primaryStrategy) return
    chrome.tabs.query({ url: 'https://kyfw.12306.cn/*' }, (tabs) => {
      const tab = tabs.find(t => !t.discarded)
      if (!tab?.id) return
      chrome.tabs.sendMessage(tab.id, {
        type: 'QUERY_DETAIL',
        fromCode: primaryStrategy.fromStation,
        toCode: primaryStrategy.toStation,
        trainNo: task.trainNo,
        date: task.travelDate,
      }, (response) => {
        setLoading(false)
        if (chrome.runtime.lastError || !response || response.error) return
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
    <div className="plasmo-fixed plasmo-inset-0 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-z-50" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="plasmo-bg-canvas plasmo-rounded-xl plasmo-w-[640px] plasmo-max-h-[85vh] plasmo-flex plasmo-flex-col plasmo-border plasmo-border-border">
        {/* header */}
        <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-p-6 plasmo-pb-4">
          <div>
            <h2 className="plasmo-text-lg plasmo-font-semibold plasmo-text-white">{task.trainNo} {task.fromStation}→{task.toStation}</h2>
            <p className="plasmo-text-sm plasmo-text-text-muted plasmo-mt-1">{task.travelDate} | 状态: {task.status === 'scanning' ? '轮询中' : task.status === 'ordered' ? '已下单' : task.status}</p>
          </div>
          <button onClick={onClose} className="plasmo-text-text-muted hover:plasmo-text-white plasmo-text-xl">&times;</button>
        </div>

        <div className="plasmo-overflow-auto plasmo-p-6 plasmo-pt-0 plasmo-flex-1">
          {loading && !ticket ? (
            <div className="plasmo-text-sm plasmo-text-text-muted plasmo-text-center plasmo-py-8">加载中...</div>
          ) : !ticket ? (
            <div className="plasmo-text-sm plasmo-text-text-muted plasmo-text-center plasmo-py-8">暂无数据</div>
          ) : (
            <>
              {/* seat availability */}
              <div className="plasmo-mb-4">
                <h3 className="plasmo-text-sm plasmo-font-medium plasmo-text-white plasmo-mb-2">
                  余票情况（{ticket.departTime}→{ticket.arriveTime} {ticket.duration}）
                </h3>
                <div className="plasmo-grid plasmo-grid-cols-4 plasmo-gap-2">
                  {ALL_SEATS.map(name => {
                    const val = ticket.seats[name] || '--'
                    const hasTicket = val !== '无' && val !== '--' && val !== ''
                    const isTarget = task.seatTypes.includes(name)
                    return (
                      <div key={name} className="plasmo-p-2 plasmo-rounded-lg plasmo-text-center"
                        style={{
                          backgroundColor: hasTicket ? 'rgba(62,207,142,0.1)' : '#1a1a1a',
                          borderColor: isTarget ? 'rgba(62,207,142,0.4)' : 'transparent',
                          borderWidth: 1,
                        }}>
                        <div className="plasmo-text-xs plasmo-text-text-muted">{name}</div>
                        <div className="plasmo-text-lg plasmo-font-semibold" style={{ color: hasTicket ? '#3ecf8e' : '#707070' }}>
                          {val}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {ticket.canWaitlist === '1' && (
                  <div className="plasmo-text-xs plasmo-text-yellow-500 plasmo-mt-2">该车次支持候补</div>
                )}
              </div>

              {/* strategies */}
              <div>
                <h3 className="plasmo-text-sm plasmo-font-medium plasmo-text-white plasmo-mb-2">监控策略</h3>
                {task.strategies.map((s, i) => (
                  <div key={i} className="plasmo-p-3 plasmo-mb-2 plasmo-rounded-lg plasmo-bg-[#1a1a1a] plasmo-border plasmo-border-border">
                    <div className="plasmo-flex plasmo-justify-between plasmo-items-center">
                      <div>
                        <span className="plasmo-text-sm plasmo-text-white">{s.label}</span>
                        <span className="plasmo-text-xs plasmo-text-text-muted plasmo-ml-2">
                          [{s.type === 'direct' ? '直达' : s.type === 'split' ? '上车补票' : s.type === 'longer1' ? '多买一站' : '多买两站'}]
                        </span>
                      </div>
                      <div className="plasmo-text-right">
                        <span className="plasmo-text-sm" style={{ color: '#3ecf8e' }}>¥{s.totalPrice}</span>
                        {s.extraFee > 0 && <span className="plasmo-text-xs plasmo-text-yellow-500 plasmo-ml-1">+{s.extraFee}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* segment detail: show per-segment tickets */}
              {task.strategies.some(s => s.type === 'split') && (
                <div className="plasmo-mt-4">
                  <h3 className="plasmo-text-sm plasmo-font-medium plasmo-text-white plasmo-mb-2">分段监控</h3>
                  <p className="plasmo-text-xs plasmo-text-text-muted plasmo-mb-2">
                    上车补票策略同时监控以下区段，任一区段有票即下单
                  </p>
                  {task.strategies.filter(s => s.type === 'split').map((s, i) => (
                    <div key={i} className="plasmo-p-2 plasmo-mb-1 plasmo-rounded plasmo-bg-[#111] plasmo-text-sm">
                      <span className="plasmo-text-text-muted">{s.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* sale time */}
              {ticket.saleTime && (
                <div className="plasmo-mt-4 plasmo-text-xs plasmo-text-text-muted">
                  起售时间: {ticket.saleTime.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3 $4:$5')}
                </div>
              )}
            </>
          )}
        </div>

        <div className="plasmo-flex plasmo-gap-3 plasmo-justify-end plasmo-p-6 plasmo-border-t plasmo-border-border plasmo-shrink-0">
          <button onClick={onClose} className="plasmo-px-5 plasmo-py-2 plasmo-bg-transparent plasmo-border plasmo-border-border plasmo-text-text-muted plasmo-rounded-md plasmo-text-sm">关闭</button>
        </div>
      </div>
    </div>
  )
}
