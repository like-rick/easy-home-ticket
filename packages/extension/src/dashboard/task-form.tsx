import React, { useState } from 'react'
import type { TaskConfig } from '../lib/types'
import { createTask } from '../lib/api'
import { getSendFn } from '../background/ws-client'

const STATIONS = ['上海', '上海虹桥', '北京', '北京南', '武汉', '广州南', '深圳北', '杭州东', '南京南', '成都东', '西安北']
const SEAT_TYPES = ['二等座', '一等座', '商务座', '硬卧', '软卧', '硬座']
const STRATEGIES = [
  { key: 'direct', label: '直达' },
  { key: 'split', label: '同车换乘' },
  { key: 'longer', label: '买长乘短' },
  { key: 'cross', label: '非同车换乘' },
]

export function TaskForm({ onClose }: { onClose: () => void }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState('')
  const [timeStart, setTimeStart] = useState('00:00')
  const [timeEnd, setTimeEnd] = useState('23:59')
  const [maxExtra, setMaxExtra] = useState(30)
  const [seatTypes, setSeatTypes] = useState<string[]>(['二等座'])
  const [trainNos, setTrainNos] = useState('')
  const [strategies, setStrategies] = useState<string[]>(['direct', 'split', 'longer', 'cross'])
  const [passengerName, setPassengerName] = useState('')
  const [passengerId, setPassengerId] = useState('')

  const toggleArr = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]

  const handleSubmit = () => {
    const send = getSendFn()
    if (!send || !from || !to || !date) return
    const config: TaskConfig = {
      name: `${from}→${to}`,
      fromStation: from,
      toStation: to,
      travelDate: date,
      timeStart,
      timeEnd,
      maxExtraFee: maxExtra,
      seatTypes,
      trainNos: trainNos ? trainNos.split(',').map(s => s.trim()) : undefined,
      strategies,
      passengers: passengerName ? [{ id: passengerId || 'p1', name: passengerName, idType: '身份证', idNumber: passengerId }] : [],
    }
    createTask(config, send)
    onClose()
  }

  return (
    <div className="plasmo-fixed plasmo-inset-0 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-z-50" style={{ backgroundColor: 'rgba(0,0,0,0.53)' }}>
      <div className="plasmo-bg-canvas plasmo-rounded-xl plasmo-p-6 plasmo-w-[480px] plasmo-max-h-[80vh] plasmo-overflow-auto plasmo-border plasmo-border-border">
        <h2 className="plasmo-text-lg plasmo-font-semibold plasmo-text-white plasmo-mb-4">新建监控任务</h2>

        <div className="plasmo-grid plasmo-grid-cols-2 plasmo-gap-3">
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">出发站</label>
            <select value={from} onChange={e => setFrom(e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none">
              <option value="">选择</option>
              {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">目的站</label>
            <select value={to} onChange={e => setTo(e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none">
              <option value="">选择</option>
              {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">日期</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none" />
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">溢价上限(元)</label>
            <input type="number" value={maxExtra} onChange={e => setMaxExtra(+e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none" />
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">时段开始</label>
            <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none" />
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">时段结束</label>
            <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none" />
          </div>
        </div>

        <div className="plasmo-mt-4">
          <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-2 plasmo-block">席别</label>
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2">
            {SEAT_TYPES.map(s => (
              <button key={s} onClick={() => setSeatTypes(toggleArr(seatTypes, s))}
                className="plasmo-px-3 plasmo-py-1 plasmo-rounded-md plasmo-text-sm plasmo-border plasmo-transition-colors"
                style={{
                  backgroundColor: seatTypes.includes(s) ? 'rgba(62,207,142,0.15)' : '#202020',
                  borderColor: seatTypes.includes(s) ? 'rgba(62,207,142,0.27)' : '#333',
                  color: seatTypes.includes(s) ? '#3ecf8e' : '#9a9a9a',
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="plasmo-mt-4">
          <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-2 plasmo-block">策略</label>
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2">
            {STRATEGIES.map(s => (
              <button key={s.key} onClick={() => setStrategies(toggleArr(strategies, s.key))}
                className="plasmo-px-3 plasmo-py-1 plasmo-rounded-md plasmo-text-sm plasmo-border plasmo-transition-colors"
                style={{
                  backgroundColor: strategies.includes(s.key) ? 'rgba(62,207,142,0.15)' : '#202020',
                  borderColor: strategies.includes(s.key) ? 'rgba(62,207,142,0.27)' : '#333',
                  color: strategies.includes(s.key) ? '#3ecf8e' : '#9a9a9a',
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="plasmo-mt-4">
          <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">固定车次 (逗号分隔，可选)</label>
          <input type="text" value={trainNos} onChange={e => setTrainNos(e.target.value)} placeholder="G123,G321"
            className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white placeholder:plasmo-text-[#707070] focus:plasmo-border-primary plasmo-outline-none" />
        </div>

        <div className="plasmo-mt-4 plasmo-grid plasmo-grid-cols-2 plasmo-gap-3">
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">乘车人</label>
            <input type="text" value={passengerName} onChange={e => setPassengerName(e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none" />
          </div>
          <div>
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-text-muted plasmo-mb-1 plasmo-block">身份证号</label>
            <input type="text" value={passengerId} onChange={e => setPassengerId(e.target.value)}
              className="plasmo-w-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none" />
          </div>
        </div>

        <div className="plasmo-flex plasmo-gap-3 plasmo-mt-6 plasmo-justify-end">
          <button onClick={onClose}
            className="plasmo-px-5 plasmo-py-2 plasmo-bg-transparent plasmo-border plasmo-border-border plasmo-text-text-muted plasmo-rounded-md plasmo-text-sm plasmo-font-medium">
            取消
          </button>
          <button onClick={handleSubmit}
            className="plasmo-px-5 plasmo-py-2 plasmo-bg-primary plasmo-text-black plasmo-rounded-md plasmo-text-sm plasmo-font-medium">
            保存并开始
          </button>
        </div>
      </div>
    </div>
  )
}
