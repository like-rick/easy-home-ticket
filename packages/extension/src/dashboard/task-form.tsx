import React, { useState, useEffect, useCallback } from 'react'
import type { TaskConfig, StationInfo, Passenger } from '../lib/types'
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
  const [splitTicket, setSplitTicket] = useState(false)
  const [extraOne, setExtraOne] = useState(false)
  const [extraTwo, setExtraTwo] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // strategy cost display
  const [strategies, setStrategies] = useState<any[]>([])
  const [loadingStrategies, setLoadingStrategies] = useState(false)

  const queryStrategies = useCallback(async () => {
    if (!from || !to || !trainNo || !date) return
    setLoadingStrategies(true)
    chrome.tabs.query({ url: 'https://kyfw.12306.cn/*' }, (tabs) => {
      const tab = tabs.find(t => !t.discarded)
      if (!tab?.id) { setLoadingStrategies(false); return }
      chrome.tabs.sendMessage(tab.id, {
        type: 'QUERY_SCHEDULE',
        trainNo, fromCode: from.code, toCode: to.code, date,
      }, (response) => {
        setLoadingStrategies(false)
        if (chrome.runtime.lastError || !response || response.error) return
        const stops = response.stops || []
        if (!stops.length) return
        // Generate strategies from stops
        const result: any[] = []
        const fromIdx = stops.findIndex((s: any) => (s.station_train_code || s.station_name) === from.code)
        const toIdx = stops.findIndex((s: any) => (s.station_train_code || s.station_name) === to.code)
        if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) { setStrategies([]); return }
        const directPrice = stops[toIdx]?.price || 0

        result.push({ type: 'direct', label: `${from.name}→${to.name} 直达`, extraFee: 0, totalPrice: directPrice, fromStation: from.code, toStation: to.code })

        // split options
        for (let mid = fromIdx + 1; mid < toIdx; mid++) {
          const s = stops[mid]
          const p = (s.price || 0)
          const seg1 = p - (stops[fromIdx]?.price || 0)
          const seg2 = directPrice - p
          result.push({
            type: 'split', label: `${from.name}→${s.station_name} + ${s.station_name}→${to.name}`,
            extraFee: Math.max(seg1, 0) + Math.max(seg2, 0) - directPrice,
            totalPrice: Math.max(seg1, 0) + Math.max(seg2, 0),
            fromStation: from.code, toStation: s.station_train_code || s.station_name,
          })
        }

        // longer options
        if (toIdx + 1 < stops.length) {
          const s = stops[toIdx + 1]
          result.push({ type: 'longer1', label: `多买一站到${s.station_name}（${to.name}下车）`, extraFee: Math.max((s.price || 0) - directPrice, 0), totalPrice: s.price || 0, fromStation: from.code, toStation: s.station_train_code || s.station_name })
        }
        if (toIdx + 2 < stops.length) {
          const s = stops[toIdx + 2]
          result.push({ type: 'longer2', label: `多买两站到${s.station_name}（${to.name}下车）`, extraFee: Math.max((s.price || 0) - directPrice, 0), totalPrice: s.price || 0, fromStation: from.code, toStation: s.station_train_code || s.station_name })
        }

        setStrategies(result)
      })
    })
  }, [from, to, trainNo, date])

  useEffect(() => { queryStrategies() }, [from, to, trainNo, date])

  const toggleArr = (arr: string[], item: string) => arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
  const clearField = (f: string) => setErrors(prev => { const n = { ...prev }; delete n[f]; return n })

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {}
    if (!from) newErrors.from = '请选择出发站'
    if (!to) newErrors.to = '请选择到达站'
    if (!trainNo) newErrors.trainNo = '请输入车次'
    if (!date) newErrors.date = '请选择出行日期'
    if (seatTypes.length === 0) newErrors.seatTypes = '请至少选择一种座位类型'
    if (passengers.length === 0) newErrors.passengers = '请至少选择一位乘车人'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }

    const config: TaskConfig = {
      name: `${trainNo} ${from!.name}→${to!.name}`,
      fromStation: from!.name, toStation: to!.name,
      trainNo, travelDate: date, seatTypes,
      passengers, splitTicket, extraOneStop: extraOne, extraTwoStop: extraTwo,
    }

    const stored: StoredTask = {
      id: Date.now().toString(),
      ...config,
      status: 'not_started',
      strategies: strategies.filter((s: any) =>
        s.type === 'direct' ||
        (s.type === 'split' && splitTicket) ||
        (s.type === 'longer1' && extraOne) ||
        (s.type === 'longer2' && extraTwo)
      ),
      createdAt: Date.now(),
    }

    saveTask(stored).then(() => {
      chrome.runtime.sendMessage({ type: 'TASK_CREATED', task: stored }).catch(() => {})
      onClose()
    })
  }

  const splitText = splitTicket && strategies.filter((s: any) => s.type === 'split')
  const longer1Text = extraOne && strategies.find((s: any) => s.type === 'longer1')
  const longer2Text = extraTwo && strategies.find((s: any) => s.type === 'longer2')

  return (
    <div className="plasmo-fixed plasmo-inset-0 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-z-50" style={{ backgroundColor: 'rgba(0,0,0,0.53)' }}>
      <div className="plasmo-bg-canvas plasmo-rounded-xl plasmo-w-[480px] plasmo-max-h-[85vh] plasmo-flex plasmo-flex-col plasmo-border plasmo-border-border">
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

          {/* Strategy options */}
          {strategies.length > 0 && (
            <div className="plasmo-mt-4 plasmo-space-y-2">
              <label className="plasmo-text-sm plasmo-text-text-muted plasmo-block">抢票策略</label>
              {strategies.filter((s: any) => s.type === 'direct').map((s: any) => (
                <div key="direct" className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-text-sm plasmo-text-white">
                  <span>✓ {s.label}</span><span className="plasmo-text-text-muted">¥{s.totalPrice}</span>
                </div>
              ))}
              <label className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-cursor-pointer plasmo-text-sm">
                <input type="checkbox" checked={splitTicket} onChange={e => setSplitTicket(e.target.checked)} />
                <span className="plasmo-text-white">上车补票</span>
                {splitText && splitText.length > 0 && (
                  <span className="plasmo-text-text-muted plasmo-ml-auto">
                    {splitText.map((s: any) => `+¥${s.extraFee}`).join(' / ')}
                  </span>
                )}
              </label>
              <label className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-cursor-pointer plasmo-text-sm">
                <input type="checkbox" checked={extraOne} onChange={e => setExtraOne(e.target.checked)} />
                <span className="plasmo-text-white">多买一站</span>
                {longer1Text && <span className="plasmo-text-text-muted plasmo-ml-auto">+¥{longer1Text.extraFee}</span>}
              </label>
              <label className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-cursor-pointer plasmo-text-sm">
                <input type="checkbox" checked={extraTwo} onChange={e => setExtraTwo(e.target.checked)} />
                <span className="plasmo-text-white">多买两站</span>
                {longer2Text && <span className="plasmo-text-text-muted plasmo-ml-auto">+¥{longer2Text.extraFee}</span>}
              </label>
            </div>
          )}
        </div>

        <div className="plasmo-flex plasmo-gap-3 plasmo-justify-end plasmo-p-6 plasmo-border-t plasmo-border-border plasmo-shrink-0">
          <button onClick={onClose} className="plasmo-px-5 plasmo-py-2 plasmo-bg-transparent plasmo-border plasmo-border-border plasmo-text-text-muted plasmo-rounded-md plasmo-text-sm">取消</button>
          <button onClick={handleSubmit} className="plasmo-px-5 plasmo-py-2 plasmo-bg-primary plasmo-text-black plasmo-rounded-md plasmo-text-sm plasmo-font-medium">保存并开始</button>
        </div>
      </div>
    </div>
  )
}
