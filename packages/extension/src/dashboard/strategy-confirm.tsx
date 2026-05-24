import React, { useState, useEffect } from 'react'
import type { StoredTask, StrategyOption } from '../lib/storage'
import { saveTask } from '../lib/storage'

export function StrategyConfirm({ task, onDone }: { task: StoredTask; onDone: () => void }) {
  const [strategies, setStrategies] = useState<StrategyOption[]>([])
  const [splitTicket, setSplitTicket] = useState(false)
  const [extraOne, setExtraOne] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    chrome.tabs.query({ url: 'https://kyfw.12306.cn/*' }, (tabs) => {
      const tab = tabs.find(t => !t.discarded)
      if (!tab?.id) { setLoading(false); setError('请先打开 12306 页面并登录'); return }
      chrome.tabs.sendMessage(tab.id, {
        type: 'PREVIEW_STRATEGIES',
        trainNo: task.trainNo,
        fromCode: task.fromCode,
        toCode: task.toCode,
        fromStationName: task.fromStation,
        toStationName: task.toStation,
        date: task.travelDate,
      }, (response) => {
        setLoading(false)
        if (chrome.runtime.lastError || !response) { setError('无法连接到 12306 页面'); return }
        if (response.error) { setError(response.error); return }
        setStrategies(response.strategies || [])
      })
    })
  }, [task.id])

  const direct = strategies.find(s => s.type === 'direct')
  const splits = strategies.filter(s => s.type === 'split')
  const longer1 = strategies.find(s => s.type === 'longer1')

  const confirm = () => {
    const enabled: StrategyOption[] = []
    if (direct) enabled.push({ ...direct, enabled: true })
    if (splitTicket) enabled.push(...splits.map(s => ({ ...s, enabled: true })))
    if (extraOne && longer1) enabled.push({ ...longer1, enabled: true })

    const updated: StoredTask = {
      ...task,
      splitTicket,
      extraOneStop: extraOne,
      strategies: enabled,
      status: 'scanning',
    }
    saveTask(updated).then(() => {
      // start polling
      chrome.tabs.query({ url: 'https://kyfw.12306.cn/*' }, (tabs) => {
        const tab = tabs.find(t => !t.discarded)
        if (!tab?.id) return
        chrome.tabs.sendMessage(tab.id, {
          type: 'START_POLLING',
          config: {
            taskId: task.id,
            fromCode: task.fromCode,
            toCode: task.toCode,
            trainNo: task.trainNo,
            travelDate: task.travelDate,
            seatTypes: task.seatTypes,
            strategies: enabled,
            passengers: task.passengers,
            splitTicket,
            extraOneStop: extraOne,
            extraTwoStop: false,
            fromStationName: task.fromStation,
            toStationName: task.toStation,
          },
        })
      })
      chrome.runtime.sendMessage({ type: 'TASK_UPDATED', task: updated }).catch(() => {})
      onDone()
    })
  }

  return (
    <div className="plasmo-fixed plasmo-inset-0 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-z-50" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="plasmo-bg-canvas plasmo-rounded-xl plasmo-w-[480px] plasmo-flex plasmo-flex-col plasmo-border plasmo-border-border">
        <h2 className="plasmo-text-lg plasmo-font-semibold plasmo-text-white plasmo-p-6 plasmo-pb-2">选择监控策略</h2>
        <p className="plasmo-text-sm plasmo-text-text-muted plasmo-px-6 plasmo-pb-4">{task.trainNo} {task.fromStation}→{task.toStation} {task.travelDate}</p>

        <div className="plasmo-px-6 plasmo-pb-4 plasmo-flex-1 plasmo-overflow-auto">
          {loading ? (
            <div className="plasmo-text-sm plasmo-text-text-muted plasmo-py-8 plasmo-text-center">正在查询经停站信息...</div>
          ) : error ? (
            <div className="plasmo-text-sm plasmo-text-red-500 plasmo-py-4 plasmo-text-center">{error}</div>
          ) : !direct ? (
            <div className="plasmo-text-sm plasmo-text-text-muted plasmo-py-8 plasmo-text-center">未找到该车次信息</div>
          ) : (
            <div className="plasmo-space-y-3">
              {/* direct — always enabled */}
              <label className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-p-3 plasmo-rounded-lg plasmo-bg-[#111] plasmo-cursor-pointer plasmo-border plasmo-border-primary/30">
                <div>
                  <span className="plasmo-text-white plasmo-text-sm">直达 {task.fromStation}→{task.toStation}</span>
                </div>
                <span className="plasmo-text-sm" style={{ color: '#3ecf8e' }}>¥{direct.totalPrice}</span>
              </label>

              {/* split */}
              {splits.length > 0 && (
                <label className={`plasmo-flex plasmo-items-center plasmo-justify-between plasmo-p-3 plasmo-rounded-lg plasmo-bg-[#111] plasmo-cursor-pointer plasmo-border ${splitTicket ? 'plasmo-border-primary/30' : 'plasmo-border-border'}`}>
                  <div className="plasmo-flex-1" onClick={() => setSplitTicket(!splitTicket)}>
                    <span className="plasmo-text-white plasmo-text-sm">上车补票</span>
                    <div className="plasmo-mt-1 plasmo-space-y-0.5">
                      {splits.map((s, i) => (
                        <div key={i} className="plasmo-text-xs plasmo-text-text-muted">
                          {s.label}
                          <span className="plasmo-ml-2" style={{ color: s.extraFee > 0 ? '#f59e0b' : '#3ecf8e' }}>
                            ¥{s.totalPrice} {s.extraFee > 0 ? `(+¥${s.extraFee})` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <input type="checkbox" checked={splitTicket} onChange={e => setSplitTicket(e.target.checked)} />
                </label>
              )}

              {/* longer1 */}
              {longer1 && (
                <label className={`plasmo-flex plasmo-items-center plasmo-justify-between plasmo-p-3 plasmo-rounded-lg plasmo-bg-[#111] plasmo-cursor-pointer plasmo-border ${extraOne ? 'plasmo-border-primary/30' : 'plasmo-border-border'}`}>
                  <div className="plasmo-flex-1" onClick={() => setExtraOne(!extraOne)}>
                    <span className="plasmo-text-white plasmo-text-sm">多买一站</span>
                    <div className="plasmo-text-xs plasmo-text-text-muted plasmo-mt-1">
                      {longer1.label}
                      <span className="plasmo-ml-2" style={{ color: longer1.extraFee > 0 ? '#f59e0b' : '#3ecf8e' }}>
                        ¥{longer1.totalPrice} {longer1.extraFee > 0 ? `(+¥${longer1.extraFee})` : ''}
                      </span>
                    </div>
                  </div>
                  <input type="checkbox" checked={extraOne} onChange={e => setExtraOne(e.target.checked)} />
                </label>
              )}
            </div>
          )}
        </div>

        <div className="plasmo-flex plasmo-gap-3 plasmo-justify-end plasmo-p-6 plasmo-border-t plasmo-border-border">
          <button onClick={onDone} className="plasmo-px-5 plasmo-py-2 plasmo-bg-transparent plasmo-border plasmo-border-border plasmo-text-text-muted plasmo-rounded-md plasmo-text-sm">跳过</button>
          <button onClick={confirm} className="plasmo-px-5 plasmo-py-2 plasmo-bg-primary plasmo-text-black plasmo-rounded-md plasmo-text-sm plasmo-font-medium" disabled={loading || !!error}>确认并开始</button>
        </div>
      </div>
    </div>
  )
}
