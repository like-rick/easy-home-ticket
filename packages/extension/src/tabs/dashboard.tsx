import '~style.css'
import React, { useState, useEffect, useCallback } from 'react'
import { TaskList } from '../dashboard/task-list'
import { SolutionBoard } from '../dashboard/solution-board'
import { LogStream } from '../dashboard/log-stream'
import { TaskForm } from '../dashboard/task-form'
import type { WsMessage, SolutionData, TaskConfig } from '../lib/types'
import { subscribe } from '../background/state'

type Panel = 'tasks' | 'board' | 'log'

interface TaskItem {
  id: string
  name: string
  fromStation: string
  toStation: string
  travelDate: string
  status: string
}

export default function Dashboard() {
  const [wsConnected, setWsConnected] = useState(false)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [solutions, setSolutions] = useState<SolutionData[]>([])
  const [logs, setLogs] = useState<Array<{ time: string; event: string; detail: string }>>([])
  const [showForm, setShowForm] = useState(false)
  const [activePanel, setActivePanel] = useState<Panel>('tasks')

  useEffect(() => {
    const unsub1 = subscribe('TASK_SYNCED', (data) => {
      const msg = data as WsMessage & { taskId: string }
      setTasks(prev => prev.map(t => t.id === msg.taskId ? { ...t, status: 'active' } : t))
    })
    const unsub2 = subscribe('TASK_CREATED', (data) => {
      const cfg = data as TaskConfig & { id: string }
      setTasks(prev => [...prev, {
        id: cfg.id,
        name: cfg.name,
        fromStation: cfg.fromStation,
        toStation: cfg.toStation,
        travelDate: cfg.travelDate,
        status: 'pending',
      }])
    })
    const unsub3 = subscribe('SOLUTION_UPDATE', (data) => {
      const msg = data as WsMessage & { solutions?: SolutionData[] }
      if (msg.solutions) setSolutions(msg.solutions)
    })
    const unsub4 = subscribe('SCAN_LOG', (data) => {
      const msg = data as WsMessage & { event: string; detail: string }
      setLogs(prev => [...prev.slice(-200), {
        time: new Date().toLocaleTimeString(),
        event: msg.event || '',
        detail: typeof msg.detail === 'string' ? msg.detail : JSON.stringify(msg.detail)
      }])
    })
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'WS_STATUS') setWsConnected(msg.connected)
      if (msg.type === 'HEARTBEAT') {
        setLogs(prev => [...prev.slice(-200), {
          time: new Date().toLocaleTimeString(),
          event: 'heartbeat',
          detail: 'pong'
        }])
      }
    })
    chrome.runtime.sendMessage({ type: 'GET_WS_STATUS' }).then((res) => {
      if (res?.connected !== undefined) setWsConnected(res.connected)
    }).catch(() => {})
    return () => { unsub1(); unsub2(); unsub3(); unsub4() }
  }, [])

  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId)
    setActivePanel('board')
  }, [])

  return (
    <div className="plasmo-h-screen plasmo-flex plasmo-flex-col plasmo-bg-canvas-soft">
      <header className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-px-6 plasmo-py-3 plasmo-bg-canvas plasmo-border-b plasmo-border-border">
        <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
          <h1 className="plasmo-text-base plasmo-font-semibold plasmo-tracking-tight">EasyHome Ticket</h1>
          <span className="plasmo-text-xs plasmo-px-1.5 plasmo-py-px plasmo-rounded-full plasmo-bg-primary/20 plasmo-text-primary plasmo-border plasmo-border-primary/40">v0.1</span>
        </div>
        <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-text-xs">
          <span
            className="plasmo-inline-block plasmo-w-1.5 plasmo-h-1.5 plasmo-rounded-full"
            style={{
              backgroundColor: wsConnected ? '#3ecf8e' : '#ff2201',
              boxShadow: wsConnected ? '0 0 6px #3ecf8e88' : '0 0 6px #ff220188',
            }}
          />
          <span className="plasmo-text-text-muted">{wsConnected ? 'Server 已连接' : '已断开'}</span>
        </div>
      </header>
      <nav className="plasmo-flex plasmo-gap-1 plasmo-px-6 plasmo-py-2.5 plasmo-bg-canvas plasmo-border-b plasmo-border-border">
        {(['tasks', 'board', 'log'] as Panel[]).map(p => (
          <button key={p} onClick={() => setActivePanel(p)}
            className={`plasmo-px-4 plasmo-py-1.5 plasmo-rounded-md plasmo-text-sm plasmo-font-medium plasmo-transition-colors ${
              activePanel === p
                ? 'plasmo-bg-primary plasmo-text-black'
                : 'plasmo-text-text-muted hover:plasmo-text-white'
            }`}>
            {{ tasks: '任务', board: '方案', log: '日志' }[p]}
          </button>
        ))}
        <button onClick={() => setShowForm(true)}
          className="plasmo-px-4 plasmo-py-1.5 plasmo-ml-auto plasmo-bg-primary plasmo-text-black plasmo-rounded-md plasmo-text-sm plasmo-font-medium">
          + 新建任务
        </button>
      </nav>
      <main className="plasmo-flex-1 plasmo-overflow-auto plasmo-p-6">
        {activePanel === 'tasks' && <TaskList tasks={tasks} onSelect={handleSelectTask} selectedId={selectedTaskId} />}
        {activePanel === 'board' && <SolutionBoard solutions={solutions} />}
        {activePanel === 'log' && <LogStream logs={logs} />}
      </main>
      {showForm && <TaskForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
