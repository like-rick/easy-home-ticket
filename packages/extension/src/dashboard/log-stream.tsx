import React, { useRef, useEffect } from 'react'

interface LogEntry { time: string; event: string; detail: string }

export function LogStream({ logs }: { logs: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [logs])

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
}
