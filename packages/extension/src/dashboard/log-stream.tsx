import React, { useRef, useEffect } from 'react'

interface LogEntry { time: string; event: string; detail: string }

export function LogStream({ logs }: { logs: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [logs])

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-h-full plasmo-gap-2">
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
        <span className="plasmo-text-xs plasmo-text-text-muted plasmo-font-medium">
          {logs.length > 0 ? `${logs.length} 条日志` : '实时日志'}
        </span>
        {logs.length > 0 && (
          <span className="plasmo-flex plasmo-items-center plasmo-gap-1 plasmo-text-xs plasmo-text-text-muted">
            <span className="plasmo-w-1.5 plasmo-h-1.5 plasmo-rounded-full" style={{ backgroundColor: '#4ade80', boxShadow: '0 0 4px #4ade8088' }} />
            接收中
          </span>
        )}
      </div>
      <div ref={ref} className="plasmo-flex-1 plasmo-overflow-auto plasmo-bg-log-bg plasmo-font-mono plasmo-text-xs plasmo-p-3 plasmo-rounded-lg plasmo-leading-relaxed">
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
        {logs.length === 0 && (
          <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-gap-2 plasmo-py-8">
            <span className="plasmo-text-lg">📡</span>
            <span style={{ color: '#707070' }}>等待日志数据...</span>
            <span style={{ color: '#555', fontSize: '10px' }}>创建任务后将在此显示实时扫描日志</span>
          </div>
        )}
      </div>
    </div>
  )
}
