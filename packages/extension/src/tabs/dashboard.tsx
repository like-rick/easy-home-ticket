import '~style.css'
import React, { useState, useEffect, useCallback } from 'react'
import { TaskList } from '../dashboard/task-list'
import { SolutionBoard } from '../dashboard/solution-board'
import { LogStream } from '../dashboard/log-stream'
import { TaskForm } from '../dashboard/task-form'
import type { SolutionData, TaskItem } from '../lib/types'

type Panel = 'tasks' | 'board' | 'log'

export default function Dashboard() {
  const [wsConnected, setWsConnected] = useState(false)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [solutions, setSolutions] = useState<SolutionData[]>([])
  const [logs, setLogs] = useState<Array<{ time: string; event: string; detail: string }>>([])
  const [showForm, setShowForm] = useState(false)
  const [activePanel, setActivePanel] = useState<Panel>('tasks')
  const [loginLoggedIn, setLoginLoggedIn] = useState<boolean | null>(null)
  const [loginToastDismissed, setLoginToastDismissed] = useState(false)

  // ---- helpers for querying content script & background ----

  const sendToContent = <T,>(type: string, cb: (res: T) => void) => {
    chrome.tabs.query({ url: 'https://kyfw.12306.cn/*' }, (tabs) => {
      const tab = tabs.find(t => !t.discarded)
      if (!tab?.id) return
      chrome.tabs.sendMessage(tab.id, { type }, (res) => {
        if (chrome.runtime.lastError || !res) return
        cb(res as T)
      })
    })
  }

  const sendWs = (payload: Record<string, unknown>) => {
    chrome.runtime.sendMessage({ type: 'SEND_WS', payload }).catch(() => {})
  }

  const checkLogin = () => sendToContent<{ loggedIn: boolean; error?: string }>('CHECK_LOGIN_STATUS', (res) => {
    if (!res.error) setLoginLoggedIn(res.loggedIn === true)
  })

  const checkWs = () => {
    chrome.runtime.sendMessage({ type: 'GET_WS_STATUS' }).then((res) => {
      if (res?.connected !== undefined) setWsConnected(res.connected)
    }).catch(() => {})
  }

  // ---- init: listeners + load data ----

  useEffect(() => {
    if (loginLoggedIn !== false) setLoginToastDismissed(false)
  }, [loginLoggedIn])

  useEffect(() => {
    checkLogin()
    checkWs()
    sendWs({ type: 'GET_TASKS' })
  }, [])

  useEffect(() => {
    const handler = (msg: any) => {
      switch (msg.type) {
        case 'WS_STATUS':
          setWsConnected(msg.connected)
          break
        case 'LOGIN_STATUS':
          setLoginLoggedIn(msg.loggedIn)
          break
        case 'HEARTBEAT':
          setLogs(prev => [...prev.slice(-200), { time: new Date().toLocaleTimeString(), event: 'heartbeat', detail: 'pong' }])
          break
        case 'TASKS_LIST':
          if (msg.tasks) setTasks(msg.tasks.map((t: any) => ({ id: t.id, name: t.name, fromStation: t.fromStation, toStation: t.toStation, travelDate: t.travelDate, status: t.status })))
          break
        case 'TASK_SYNCED':
          if (msg.task) {
            const t = msg.task
            setTasks(prev => {
              const exists = prev.find(p => p.id === msg.taskId)
              if (exists) return prev.map(p => p.id === msg.taskId ? { ...p, status: t.status } : p)
              return [...prev, { id: t.id, name: t.name, fromStation: t.fromStation, toStation: t.toStation, travelDate: t.travelDate, status: t.status }]
            })
          } else {
            setTasks(prev => prev.map(p => p.id === msg.taskId ? { ...p, status: 'active' } : p))
          }
          break
        case 'SOLUTION_UPDATE':
          if (msg.solutions) setSolutions(msg.solutions)
          break
        case 'SCAN_LOG':
          setLogs(prev => [...prev.slice(-200), { time: new Date().toLocaleTimeString(), event: msg.event || '', detail: typeof msg.detail === 'string' ? msg.detail : JSON.stringify(msg.detail) }])
          break
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  // ---- handlers ----

  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId)
    setActivePanel('board')
    sendWs({ type: 'GET_SOLUTIONS', taskId })
  }, [])

  return (
    <div className="plasmo-h-screen plasmo-flex plasmo-flex-col plasmo-bg-canvas-soft">
      <header className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-px-6 plasmo-py-3 plasmo-bg-canvas plasmo-border-b plasmo-border-border">
        <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
          <h1 className="plasmo-text-base plasmo-font-semibold plasmo-tracking-tight">EasyHome Ticket</h1>
          <span className="plasmo-text-xs plasmo-px-1.5 plasmo-py-px plasmo-rounded-full plasmo-bg-primary/20 plasmo-text-primary plasmo-border plasmo-border-primary/40">v0.1</span>
        </div>
        <div className="plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-text-xs">
          <div className="plasmo-flex plasmo-items-center plasmo-gap-1.5">
            <span
              className="plasmo-inline-block plasmo-w-1.5 plasmo-h-1.5 plasmo-rounded-full"
              style={{
                backgroundColor: wsConnected ? '#3ecf8e' : '#ff2201',
                boxShadow: wsConnected ? '0 0 6px #3ecf8e88' : '0 0 6px #ff220188',
              }}
            />
            <span className="plasmo-text-text-muted">{wsConnected ? 'Server 已连接' : '已断开'}</span>
          </div>
          <button
            onClick={checkLogin}
            className="plasmo-flex plasmo-items-center plasmo-gap-1.5 plasmo-cursor-pointer hover:plasmo-opacity-80"
            title="点击刷新"
          >
            <span
              className="plasmo-inline-block plasmo-w-1.5 plasmo-h-1.5 plasmo-rounded-full"
              style={{
                backgroundColor: loginLoggedIn === true ? '#3ecf8e' : loginLoggedIn === false ? '#f59e0b' : '#6b7280',
                boxShadow: loginLoggedIn === true ? '0 0 6px #3ecf8e88' : loginLoggedIn === false ? '0 0 6px #f59e0b88' : 'none',
              }}
            />
            <span className="plasmo-text-text-muted">
              {loginLoggedIn === null ? '检测中...' : loginLoggedIn ? '12306 已登录' : '12306 未登录'}
            </span>
          </button>
        </div>
      </header>
      {loginLoggedIn === false && !loginToastDismissed && (
        <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-gap-3 plasmo-bg-yellow-500/10 plasmo-border-b plasmo-border-yellow-500/20 plasmo-text-yellow-400 plasmo-px-6 plasmo-py-2 plasmo-text-sm">
          <span>未检测到 12306 登录状态，请前往官网登录</span>
          <button onClick={() => chrome.tabs.create({ url: 'https://kyfw.12306.cn/otn/login/init' })} className="plasmo-px-2 plasmo-py-0.5 plasmo-bg-yellow-500/20 plasmo-text-yellow-300 plasmo-rounded plasmo-text-xs hover:plasmo-bg-yellow-500/30">前往登录</button>
          <button onClick={() => setLoginToastDismissed(true)} className="plasmo-text-yellow-400 hover:plasmo-text-yellow-300 plasmo-text-lg plasmo-leading-none">&times;</button>
        </div>
      )}
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
