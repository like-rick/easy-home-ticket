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
    <div className="plasmo-space-y-2">
      {tasks.map(t => (
        <div key={t.id}
          onClick={() => onSelect(t.id)}
          className={`plasmo-p-3 plasmo-rounded plasmo-cursor-pointer plasmo-border ${selectedId === t.id ? 'plasmo-border-blue-500 plasmo-bg-blue-50' : 'plasmo-border-gray-200 plasmo-bg-white'}`}>
          <div className="plasmo-flex plasmo-justify-between plasmo-items-center">
            <span className="plasmo-font-medium">{t.name || `${t.fromStation}→${t.toStation}`}</span>
            <span className={`plasmo-w-2 plasmo-h-2 plasmo-rounded-full ${t.status === 'active' ? 'plasmo-bg-green-500' : 'plasmo-bg-gray-400'}`} />
          </div>
          <div className="plasmo-text-sm plasmo-text-gray-500">{t.travelDate}</div>
        </div>
      ))}
      {tasks.length === 0 && (
        <div className="plasmo-text-gray-400 plasmo-text-center plasmo-py-8">暂无任务，点击"新建任务"开始</div>
      )}
    </div>
  )
}
