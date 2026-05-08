import React, { useRef, useEffect } from 'react'

interface LogEntry { time: string; event: string; detail: string }

export function LogStream({ logs }: { logs: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [logs])

  return (
    <div ref={ref} className="plasmo-h-full plasmo-overflow-auto plasmo-bg-gray-900 plasmo-text-green-400 plasmo-font-mono plasmo-text-xs plasmo-p-3 plasmo-rounded">
      {logs.map((l, i) => (
        <div key={i} className="plasmo-py-0.5">
          <span className="plasmo-text-gray-500">{l.time}</span>{' '}
          <span className={l.event === 'ticket_found' ? 'plasmo-text-yellow-300 plasmo-font-bold' : ''}>
            [{l.event}]
          </span>{' '}
          {l.detail}
        </div>
      ))}
      {logs.length === 0 && <div className="plasmo-text-gray-500">等待日志...</div>}
    </div>
  )
}
