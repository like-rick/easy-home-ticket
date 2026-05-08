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
    <div className="plasmo-fixed plasmo-inset-0 plasmo-bg-black/50 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-z-50">
      <div className="plasmo-bg-white plasmo-rounded-lg plasmo-p-6 plasmo-w-[480px] plasmo-max-h-[80vh] plasmo-overflow-auto">
        <h2 className="plasmo-text-lg plasmo-font-bold plasmo-mb-4">新建监控任务</h2>

        <div className="plasmo-grid plasmo-grid-cols-2 plasmo-gap-3">
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">出发站</label>
            <select value={from} onChange={e => setFrom(e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm">
              <option value="">选择</option>
              {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">目的站</label>
            <select value={to} onChange={e => setTo(e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm">
              <option value="">选择</option>
              {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">日期</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm" />
          </div>
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">溢价上限(元)</label>
            <input type="number" value={maxExtra} onChange={e => setMaxExtra(+e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm" />
          </div>
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">时段开始</label>
            <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm" />
          </div>
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">时段结束</label>
            <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm" />
          </div>
        </div>

        <div className="plasmo-mt-3">
          <label className="plasmo-text-xs plasmo-text-gray-500">席别</label>
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2">
            {SEAT_TYPES.map(s => (
              <button key={s} onClick={() => setSeatTypes(toggleArr(seatTypes, s))}
                className={`plasmo-px-2 plasmo-py-0.5 plasmo-rounded plasmo-text-xs ${seatTypes.includes(s) ? 'plasmo-bg-blue-500 plasmo-text-white' : 'plasmo-bg-gray-100'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="plasmo-mt-3">
          <label className="plasmo-text-xs plasmo-text-gray-500">策略</label>
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2">
            {STRATEGIES.map(s => (
              <button key={s.key} onClick={() => setStrategies(toggleArr(strategies, s.key))}
                className={`plasmo-px-2 plasmo-py-0.5 plasmo-rounded plasmo-text-xs ${strategies.includes(s.key) ? 'plasmo-bg-green-500 plasmo-text-white' : 'plasmo-bg-gray-100'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="plasmo-mt-3">
          <label className="plasmo-text-xs plasmo-text-gray-500">固定车次 (逗号分隔，可选)</label>
          <input type="text" value={trainNos} onChange={e => setTrainNos(e.target.value)} placeholder="G123,G321"
            className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm" />
        </div>

        <div className="plasmo-mt-3 plasmo-grid plasmo-grid-cols-2 plasmo-gap-2">
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">乘车人</label>
            <input type="text" value={passengerName} onChange={e => setPassengerName(e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm" />
          </div>
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">身份证号</label>
            <input type="text" value={passengerId} onChange={e => setPassengerId(e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm" />
          </div>
        </div>

        <div className="plasmo-flex plasmo-gap-3 plasmo-mt-6 plasmo-justify-end">
          <button onClick={onClose} className="plasmo-px-4 plasmo-py-1.5 plasmo-bg-gray-100 plasmo-rounded plasmo-text-sm">取消</button>
          <button onClick={handleSubmit} className="plasmo-px-4 plasmo-py-1.5 plasmo-bg-blue-500 plasmo-text-white plasmo-rounded plasmo-text-sm">保存并开始</button>
        </div>
      </div>
    </div>
  )
}
