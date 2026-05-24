import '~style.css'
import React, { useState, useEffect, useCallback } from 'react'
import { TaskList } from '../dashboard/task-list'
import { TaskForm } from '../dashboard/task-form'
import { StrategyConfirm } from '../dashboard/strategy-confirm'
import { loadTasks, saveTask, removeTask } from '../lib/storage'
import type { StoredTask } from '../lib/storage'

function stopPollingForTask(taskId: string) {
  chrome.tabs.query({ url: 'https://kyfw.12306.cn/*' }, (tabs) => {
    const tab = tabs.find(t => !t.discarded)
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'STOP_POLLING', taskId })
  })
}

type Panel = 'tasks' | 'log'

export default function Dashboard() {
  const [tasks, setTasks] = useState<StoredTask[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Array<{ time: string; event: string; detail: string }>>([])
  const [showForm, setShowForm] = useState(false)
  const [confirmTask, setConfirmTask] = useState<StoredTask | null>(null)
  const [activePanel, setActivePanel] = useState<Panel>('tasks')
  const [loginLoggedIn, setLoginLoggedIn] = useState<boolean | null>(null)
  const [loginToastDismissed, setLoginToastDismissed] = useState(false)

  const refreshTasks = () => loadTasks().then(setTasks)

  const checkLogin = () => {
    chrome.tabs.query({ url: 'https://kyfw.12306.cn/*' }, (tabs) => {
      const tab = tabs.find(t => !t.discarded)
      if (!tab?.id) return
      chrome.tabs.sendMessage(tab.id, { type: 'CHECK_LOGIN_STATUS' }, (res) => {
        if (chrome.runtime.lastError || !res || res.error) return
        setLoginLoggedIn(res.loggedIn === true)
      })
    })
  }

  useEffect(() => { checkLogin(); refreshTasks() }, [])
  useEffect(() => { if (loginLoggedIn !== false) setLoginToastDismissed(false) }, [loginLoggedIn])

  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.type === 'LOGIN_STATUS') setLoginLoggedIn(msg.loggedIn)
      if (msg.type === 'TASK_CREATED') {
        console.log('[Dashboard] TASK_CREATED received', msg.task?.status, msg.task)
        refreshTasks()
        if (msg.task?.status === 'pending') {
          console.log('[Dashboard] showing StrategyConfirm')
          setConfirmTask(msg.task as StoredTask)
        }
      }
      if (msg.type === 'TASK_UPDATED') refreshTasks()
      if (msg.type === 'ORDER_RESULT') {
        const status = msg.ok ? 'ordered' : 'scanning'
        loadTasks().then(tasks => {
          const task = tasks.find(t => t.id === msg.taskId)
          if (task) {
            task.status = status
            saveTask(task).then(refreshTasks)
          }
        })
        setLogs(prev => [...prev.slice(-200), {
          time: new Date().toLocaleTimeString(),
          event: msg.ok ? '下单成功' : '下单失败',
          detail: msg.ok ? `${msg.trainNo} 已下单，请付款` : (msg.message || ''),
        }])
        if (msg.ok) {
          stopPollingForTask(msg.taskId)
        }
      }
      if (msg.type === 'SCAN_LOG') {
        setLogs(prev => [...prev.slice(-200), { time: new Date().toLocaleTimeString(), event: msg.event || '', detail: msg.detail || '' }])
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  const handleDeleteTask = useCallback((taskId: string) => {
    removeTask(taskId).then(refreshTasks)
  }, [])

  return (
    <div className="plasmo-h-screen plasmo-flex plasmo-flex-col plasmo-bg-canvas-soft">
      <header className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-px-6 plasmo-py-3 plasmo-bg-canvas plasmo-border-b plasmo-border-border">
        <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
          <h1 className="plasmo-text-base plasmo-font-semibold plasmo-tracking-tight">EasyHome Ticket</h1>
          <span className="plasmo-text-xs plasmo-px-1.5 plasmo-py-px plasmo-rounded-full plasmo-bg-primary/20 plasmo-text-primary plasmo-border plasmo-border-primary/40">MVP</span>
        </div>
        <button onClick={checkLogin} className="plasmo-flex plasmo-items-center plasmo-gap-1.5 plasmo-cursor-pointer hover:plasmo-opacity-80" title="点击刷新">
          <span className="plasmo-inline-block plasmo-w-1.5 plasmo-h-1.5 plasmo-rounded-full"
            style={{ backgroundColor: loginLoggedIn === true ? '#3ecf8e' : loginLoggedIn === false ? '#f59e0b' : '#6b7280',
              boxShadow: loginLoggedIn === true ? '0 0 6px #3ecf8e88' : loginLoggedIn === false ? '0 0 6px #f59e0b88' : 'none' }} />
          <span className="plasmo-text-xs plasmo-text-text-muted">{loginLoggedIn === null ? '检测中...' : loginLoggedIn ? '12306 已登录' : '12306 未登录'}</span>
        </button>
      </header>
      {loginLoggedIn === false && !loginToastDismissed && (
        <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-gap-3 plasmo-bg-yellow-500/10 plasmo-border-b plasmo-border-yellow-500/20 plasmo-text-yellow-400 plasmo-px-6 plasmo-py-2 plasmo-text-sm">
          <span>未检测到 12306 登录状态，请前往官网登录</span>
          <button onClick={() => chrome.tabs.create({ url: 'https://kyfw.12306.cn/otn/login/init' })} className="plasmo-px-2 plasmo-py-0.5 plasmo-bg-yellow-500/20 plasmo-text-yellow-300 plasmo-rounded plasmo-text-xs hover:plasmo-bg-yellow-500/30">前往登录</button>
          <button onClick={() => setLoginToastDismissed(true)} className="plasmo-text-yellow-400 hover:plasmo-text-yellow-300 plasmo-text-lg plasmo-leading-none">&times;</button>
        </div>
      )}
      <nav className="plasmo-flex plasmo-gap-1 plasmo-px-6 plasmo-py-2.5 plasmo-bg-canvas plasmo-border-b plasmo-border-border">
        {(['tasks', 'log'] as Panel[]).map(p => (
          <button key={p} onClick={() => setActivePanel(p)}
            className={`plasmo-px-4 plasmo-py-1.5 plasmo-rounded-md plasmo-text-sm plasmo-font-medium plasmo-transition-colors ${activePanel === p ? 'plasmo-bg-primary plasmo-text-black' : 'plasmo-text-text-muted hover:plasmo-text-white'}`}>
            {{ tasks: '任务', log: '日志' }[p]}
          </button>
        ))}
        <button onClick={() => setShowForm(true)} className="plasmo-px-4 plasmo-py-1.5 plasmo-ml-auto plasmo-bg-primary plasmo-text-black plasmo-rounded-md plasmo-text-sm plasmo-font-medium">+ 新建任务</button>
      </nav>
      <main className="plasmo-flex-1 plasmo-overflow-auto plasmo-p-6">
        {activePanel === 'tasks' && <TaskList tasks={tasks.map(t => ({ id: t.id, name: t.name, fromStation: t.fromStation, toStation: t.toStation, travelDate: t.travelDate, status: t.status }))} onSelect={id => setSelectedTaskId(id)} selectedId={selectedTaskId} onDelete={handleDeleteTask} getFullTask={(id) => tasks.find(t => t.id === id)} />}
        {activePanel === 'log' && <div className="plasmo-space-y-1">
          {logs.map((l, i) => <div key={i} className="plasmo-text-sm plasmo-text-text-muted">{l.time} {l.event} {l.detail}</div>)}
        </div>}
      </main>
      {showForm && <TaskForm onClose={() => { setShowForm(false); refreshTasks() }} />}
      {confirmTask && <StrategyConfirm task={confirmTask} onDone={() => { setConfirmTask(null); refreshTasks() }} />}
    </div>
  )
}
