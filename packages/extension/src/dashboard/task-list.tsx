import React, { useState, useEffect } from 'react'
import type { WsMessage } from '../lib/types'
import { subscribe } from '../background/state'

interface TaskItem {
  id: string
  name: string
  fromStation: string
  toStation: string
  travelDate: string
  status: string
}

export function TaskList({ onSelect, selectedId }: { onSelect: (id: string) => void; selectedId: string | null }) {
  const [tasks, setTasks] = useState<TaskItem[]>([])

  useEffect(() => {
    const unsub = subscribe('TASK_SYNCED', (data) => {
      const msg = data as WsMessage & { taskId: string }
      setTasks(prev => prev.map(t => t.id === msg.taskId ? { ...t } : t))
    })
    return () => unsub()
  }, [])

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-gap-2">
      {tasks.map(t => (
        <div key={t.id}
          onClick={() => onSelect(t.id)}
          className={`plasmo-p-4 plasmo-rounded-xl plasmo-cursor-pointer plasmo-border plasmo-transition-colors ${
            selectedId === t.id
              ? 'plasmo-border-primary plasmo-bg-canvas'
              : 'plasmo-border-border plasmo-bg-canvas hover:plasmo-border-[#555]'
          }`}>
          <div className="plasmo-flex plasmo-justify-between plasmo-items-center">
            <span className="plasmo-text-sm plasmo-font-medium plasmo-text-white">
              {t.name || `${t.fromStation}→${t.toStation}`}
            </span>
            <span
              className="plasmo-w-1.5 plasmo-h-1.5 plasmo-rounded-full"
              style={{
                backgroundColor: t.status === 'active' ? '#3ecf8e' : '#707070',
                boxShadow: t.status === 'active' ? '0 0 5px #3ecf8e88' : 'none',
              }}
            />
          </div>
          <div className="plasmo-text-xs plasmo-text-text-muted plasmo-mt-1">{t.travelDate}</div>
          <div className="plasmo-text-xs plasmo-mt-1" style={{ color: t.status === 'active' ? '#3ecf8e' : '#707070' }}>
            {t.status === 'active' ? '监控中' : '已完成'}
          </div>
        </div>
      ))}
      {tasks.length === 0 && (
        <div className="plasmo-text-text-muted plasmo-text-center plasmo-py-8 plasmo-text-sm">暂无任务，点击"+ 新建任务"开始</div>
      )}
    </div>
  )
}
