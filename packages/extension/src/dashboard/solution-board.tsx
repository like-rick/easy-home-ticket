import React from 'react'
import type { SolutionData } from '../lib/types'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '监控中', color: 'plasmo-text-gray-400' },
  available: { label: '有票!', color: 'plasmo-text-green-600' },
  sold: { label: '已售罄', color: 'plasmo-text-red-500' },
  booked: { label: '已占座', color: 'plasmo-text-blue-600' },
}

const PLAN_LABELS: Record<string, string> = {
  direct: '直达', split: '同车换乘', longer: '买长乘短', cross: '非同车换乘',
}

export function SolutionBoard({ solutions }: { solutions: SolutionData[] }) {
  if (solutions.length === 0) {
    return <div className="plasmo-text-gray-400 plasmo-text-center plasmo-py-8">选择左侧任务查看方案</div>
  }

  return (
    <div className="plasmo-space-y-2">
      {solutions.map(s => (
        <div key={s.id} className={`plasmo-p-3 plasmo-rounded plasmo-border ${s.ticketStatus === 'available' ? 'plasmo-border-green-300 plasmo-bg-green-50' : 'plasmo-border-gray-200 plasmo-bg-white'}`}>
          <div className="plasmo-flex plasmo-justify-between plasmo-items-center">
            <div>
              <span className="plasmo-font-medium">{s.trainNo}</span>
              <span className="plasmo-ml-2 plasmo-text-xs plasmo-bg-gray-100 plasmo-px-1.5 plasmo-py-0.5 plasmo-rounded">{PLAN_LABELS[s.planType] || s.planType}</span>
            </div>
            <span className={`plasmo-text-sm plasmo-font-medium ${STATUS_MAP[s.ticketStatus]?.color || ''}`}>
              {STATUS_MAP[s.ticketStatus]?.label || s.ticketStatus}
            </span>
          </div>
          <div className="plasmo-text-sm plasmo-text-gray-600 plasmo-mt-1">
            {s.segments.map((seg, i) => (
              <span key={i}>{seg.fromStation}→{seg.toStation} {seg.seatType} ¥{seg.price}{i < s.segments.length - 1 ? ' + ' : ''}</span>
            ))}
          </div>
          {s.extraFee > 0 && <div className="plasmo-text-xs plasmo-text-orange-500">溢价 ¥{s.extraFee}</div>}
        </div>
      ))}
    </div>
  )
}
