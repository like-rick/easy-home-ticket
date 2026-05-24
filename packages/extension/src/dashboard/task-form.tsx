import React, { useState, useEffect, useCallback } from 'react'
import type { StationInfo, Passenger } from '../lib/types'
import { saveTask } from '../lib/storage'
import type { StoredTask } from '../lib/storage'
import { StationPicker } from './station-picker'
import { PassengerPicker } from './passenger-picker'

const SEAT_TYPES = ['二等座', '一等座', '商务座', '硬卧', '软卧', '硬座']

export function TaskForm({ onClose }: { onClose: () => void }) {
  const [from, setFrom] = useState<StationInfo | null>(null)
  const [to, setTo] = useState<StationInfo | null>(null)
  const [trainNo, setTrainNo] = useState('')
  const [date, setDate] = useState('')
  const [seatTypes, setSeatTypes] = useState<string[]>(['二等座'])
  const [passengers, setPassengers] = useState<Passenger[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const toggleArr = (arr: string[], item: string) => arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
  const clearField = (f: string) => setErrors(prev => { const n = { ...prev }; delete n[f]; return n })

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {}
    if (!from) newErrors.from = '请选择出发站'
    if (!to) newErrors.to = '请选择到达站'
    if (!trainNo) newErrors.trainNo = '请输入车次'
    if (!date) newErrors.date = '请选择出行日期'
    if (seatTypes.length === 0) newErrors.seatTypes = '请至少选择一种座位类型'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }

    const finalPassengers = passengers.length > 0 ? passengers : [
      { id: 'mock_1', name: '测试用户', idType: '居民身份证', idNumber: '110101199001011234' },
    ]

    const stored: StoredTask = {
      id: Date.now().toString(),
      name: `${trainNo} ${from!.name}→${to!.name}`,
      fromStation: from!.name, toStation: to!.name,
      fromCode: from!.code, toCode: to!.code,
      trainNo, travelDate: date, seatTypes,
      passengers: finalPassengers,
      splitTicket: false, extraOneStop: false,
      status: 'pending',
      strategies: [],
      createdAt: Date.now(),
    }

    saveTask(stored).then(() => {
      chrome.runtime.sendMessage({ type: 'TASK_CREATED', task: stored }).catch(() => {})
      onClose()
    })
  }

  return (
    <div className="plasmo-fixed plasmo-inset-0 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-z-50" style={{ backgroundColor: 'rgba(0,0,0,0.53)' }}>
      <div className="plasmo-bg-canvas plasmo-rounded-xl plasmo-w-[480px] plasmo-flex plasmo-flex-col plasmo-border plasmo-border-border">
        <h2 className="plasmo-text-lg plasmo-font-semibold plasmo-text-white plasmo-p-6 plasmo-pb-0">新建抢票任务</h2>
        <div className="plasmo-overflow-auto plasmo-p-6 plasmo-flex-1">
          <div className="plasmo-grid plasmo-grid-cols-2 plasmo-gap-3">
            <div>
              <label className="plasmo-text-sm plasmo-text-text-muted plasmo-mb-1 plasmo-block"><span className="plasmo-text-red-500">* </span>出发站</label>
              <StationPicker value={from} onChange={setFrom} placeholder="输入拼音或站名" error={errors.from} onClearError={() => clearField('from')} />
            </div>
            <div>
              <label className="plasmo-text-sm plasmo-text-text-muted plasmo-mb-1 plasmo-block"><span className="plasmo-text-red-500">* </span>到达站</label>
              <StationPicker value={to} onChange={setTo} placeholder="输入拼音或站名" error={errors.to} onClearError={() => clearField('to')} />
            </div>
            <div>
              <label className="plasmo-text-sm plasmo-text-text-muted plasmo-mb-1 plasmo-block"><span className="plasmo-text-red-500">* </span>车次</label>
              <input type="text" value={trainNo} onChange={e => { setTrainNo(e.target.value); clearField('trainNo') }} placeholder="G123"
                className={`plasmo-w-full plasmo-bg-canvas-soft plasmo-border ${errors.trainNo ? 'plasmo-border-red-500' : 'plasmo-border-border'} plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none`} />
              {errors.trainNo && <p className="plasmo-text-red-500 plasmo-text-xs plasmo-mt-1">{errors.trainNo}</p>}
            </div>
            <div>
              <label className="plasmo-text-sm plasmo-text-text-muted plasmo-mb-1 plasmo-block"><span className="plasmo-text-red-500">* </span>日期</label>
              <input type="date" value={date} onChange={e => { setDate(e.target.value); clearField('date') }}
                className={`plasmo-w-full plasmo-bg-canvas-soft plasmo-border ${errors.date ? 'plasmo-border-red-500' : 'plasmo-border-border'} plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-white focus:plasmo-border-primary plasmo-outline-none`} />
            </div>
          </div>
          <div className="plasmo-mt-4">
            <label className="plasmo-text-sm plasmo-text-text-muted plasmo-mb-2 plasmo-block"><span className="plasmo-text-red-500">* </span>席别</label>
            <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2">
              {SEAT_TYPES.map(s => (
                <button key={s} onClick={() => setSeatTypes(toggleArr(seatTypes, s))}
                  className="plasmo-px-3 plasmo-py-1 plasmo-rounded-md plasmo-text-sm plasmo-border plasmo-transition-colors"
                  style={{ backgroundColor: seatTypes.includes(s) ? 'rgba(62,207,142,0.15)' : '#202020', borderColor: seatTypes.includes(s) ? 'rgba(62,207,142,0.27)' : '#333', color: seatTypes.includes(s) ? '#3ecf8e' : '#9a9a9a' }}>{s}</button>
              ))}
            </div>
          </div>
          <div className="plasmo-mt-4">
            <label className="plasmo-text-sm plasmo-text-text-muted plasmo-mb-1 plasmo-block"><span className="plasmo-text-red-500">* </span>乘车人</label>
            <PassengerPicker passengers={passengers} onChange={setPassengers} error={errors.passengers} onClearError={() => clearField('passengers')} />
          </div>
        </div>
        <div className="plasmo-flex plasmo-gap-3 plasmo-justify-end plasmo-p-6 plasmo-border-t plasmo-border-border plasmo-shrink-0">
          <button onClick={onClose} className="plasmo-px-5 plasmo-py-2 plasmo-bg-transparent plasmo-border plasmo-border-border plasmo-text-text-muted plasmo-rounded-md plasmo-text-sm">取消</button>
          <button onClick={handleSubmit} className="plasmo-px-5 plasmo-py-2 plasmo-bg-primary plasmo-text-black plasmo-rounded-md plasmo-text-sm plasmo-font-medium">下一步</button>
        </div>
      </div>
    </div>
  )
}
