import React, { useState, useEffect, useCallback } from 'react'
import { TaskList } from './dashboard/task-list'
import { SolutionBoard } from './dashboard/solution-board'
import { LogStream } from './dashboard/log-stream'
import { TaskForm } from './dashboard/task-form'
import type { WsMessage, SolutionData } from './lib/types'
import { subscribe } from './background/state'

type Panel = 'tasks' | 'board' | 'log'

export default function Dashboard() {
  const [wsConnected, setWsConnected] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [solutions, setSolutions] = useState<SolutionData[]>([])
  const [logs, setLogs] = useState<Array<{ time: string; event: string; detail: string }>>([])
  const [showForm, setShowForm] = useState(false)
  const [activePanel, setActivePanel] = useState<Panel>('tasks')

  useEffect(() => {
    const unsub1 = subscribe('SOLUTION_UPDATE', (data) => {
      const msg = data as WsMessage & { solutions?: SolutionData[] }
      if (msg.solutions) setSolutions(msg.solutions)
    })
    const unsub2 = subscribe('SCAN_LOG', (data) => {
      const msg = data as WsMessage & { event: string; detail: string }
      setLogs(prev => [...prev.slice(-200), {
        time: new Date().toLocaleTimeString(),
        event: msg.event || '',
        detail: typeof msg.detail === 'string' ? msg.detail : JSON.stringify(msg.detail)
      }])
    })
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'WS_STATUS') setWsConnected(msg.connected)
    })
    return () => { unsub1(); unsub2() }
  }, [])

  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId)
    setActivePanel('board')
  }, [])

  return (
    <div className="plasmo-h-screen plasmo-flex plasmo-flex-col plasmo-bg-gray-50">
      <header className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-px-4 plasmo-py-2 plasmo-bg-white plasmo-border-b plasmo-shadow-sm">
        <h1 className="plasmo-text-lg plasmo-font-bold">EasyHome Ticket</h1>
        <div className="plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-text-sm">
          <span className={`plasmo-inline-block plasmo-w-2 plasmo-h-2 plasmo-rounded-full ${wsConnected ? 'plasmo-bg-green-500' : 'plasmo-bg-red-500'}`} />
          <span>{wsConnected ? 'Server 已连接' : '已断开'}</span>
        </div>
      </header>
      <nav className="plasmo-flex plasmo-gap-2 plasmo-px-4 plasmo-py-2 plasmo-bg-white plasmo-border-b">
        {(['tasks', 'board', 'log'] as Panel[]).map(p => (
          <button key={p} onClick={() => setActivePanel(p)}
            className={`plasmo-px-4 plasmo-py-1 plasmo-rounded plasmo-text-sm ${activePanel === p ? 'plasmo-bg-blue-500 plasmo-text-white' : 'plasmo-bg-gray-100'}`}>
            {{ tasks: '任务', board: '方案', log: '日志' }[p]}
          </button>
        ))}
        <button onClick={() => setShowForm(true)}
          className="plasmo-px-4 plasmo-py-1 plasmo-ml-auto plasmo-bg-green-500 plasmo-text-white plasmo-rounded plasmo-text-sm">
          + 新建任务
        </button>
      </nav>
      <main className="plasmo-flex-1 plasmo-overflow-auto plasmo-p-4">
        {activePanel === 'tasks' && <TaskList onSelect={handleSelectTask} selectedId={selectedTaskId} />}
        {activePanel === 'board' && <SolutionBoard solutions={solutions} />}
        {activePanel === 'log' && <LogStream logs={logs} />}
      </main>
      {showForm && <TaskForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
