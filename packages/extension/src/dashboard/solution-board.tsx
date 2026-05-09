import React from 'react'
import type { SolutionData } from '../lib/types'

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  pending:  { label: '待定',  bg: 'rgba(112,112,112,0.15)', text: '#9a9a9a' },
  available:{ label: '可购',  bg: 'rgba(62,207,142,0.15)', text: '#3ecf8e' },
  sold:     { label: '已售罄', bg: 'rgba(255,34,1,0.15)',  text: '#ff2201' },
  booked:   { label: '已占座', bg: 'rgba(107,1,194,0.15)', text: '#6b01c2' },
}

const PLAN_LABELS: Record<string, string> = {
  direct: '直达', split: '同车换乘', longer: '买长乘短', cross: '非同车换乘',
}

export function SolutionBoard({ solutions }: { solutions: SolutionData[] }) {
  if (solutions.length === 0) {
    return (
      <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-gap-3 plasmo-py-12">
        <div className="plasmo-w-12 plasmo-h-12 plasmo-rounded-full plasmo-bg-canvas plasmo-border plasmo-border-border plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-xl">
          🔍
        </div>
        <div className="plasmo-text-text-muted plasmo-text-sm">选择左侧任务查看方案</div>
        <div className="plasmo-text-[#707070] plasmo-text-xs">点击任务卡片后将在此展示抢票方案</div>
      </div>
    )
  }

  const sorted = [...solutions].sort((a, b) => {
    const statusOrder = { available: 0, pending: 1, booked: 2, sold: 3 }
    const aStatus = statusOrder[a.ticketStatus] ?? 99
    const bStatus = statusOrder[b.ticketStatus] ?? 99
    if (aStatus !== bStatus) return aStatus - bStatus
    return a.priority - b.priority
  })

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-gap-2">
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-mb-1">
        <span className="plasmo-text-xs plasmo-text-text-muted plasmo-font-medium">
          {sorted.length} 个方案
        </span>
      </div>
      {sorted.map(s => {
        const st = STATUS_MAP[s.ticketStatus] || STATUS_MAP.pending
        const isAvailable = s.ticketStatus === 'available'
        return (
          <div key={s.id}
            className="plasmo-p-5 plasmo-rounded-xl plasmo-bg-canvas plasmo-border"
            style={{ borderColor: isAvailable ? 'rgba(62,207,142,0.27)' : '#333' }}>
            <div className="plasmo-flex plasmo-justify-between plasmo-items-start plasmo-mb-3">
              <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-flex-wrap">
                <span className="plasmo-text-lg plasmo-font-semibold plasmo-text-white">{s.trainNo}</span>
                <span className="plasmo-text-xs plasmo-px-2 plasmo-py-0.5 plasmo-rounded-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-text-text-muted">
                  {PLAN_LABELS[s.planType] || s.planType}
                </span>
                <span className="plasmo-text-xs plasmo-px-2 plasmo-py-0.5 plasmo-rounded-full" style={{ backgroundColor: st.bg, color: st.text }}>
                  {st.label}
                </span>
                {isAvailable && (
                  <span className="plasmo-text-xs plasmo-px-2 plasmo-py-0.5 plasmo-rounded-full plasmo-bg-primary/20 plasmo-text-primary plasmo-border plasmo-border-primary/40">
                    优先 #{(s.priority || 0) + 1}
                  </span>
                )}
              </div>
              <div className="plasmo-text-right plasmo-flex-shrink-0">
                <span className="plasmo-text-xl plasmo-font-semibold" style={{ color: '#3ecf8e' }}>¥{s.totalPrice}</span>
                {s.extraFee > 0 && (
                  <div className="plasmo-text-xs" style={{ color: '#ffdb13' }}>+¥{s.extraFee}</div>
                )}
              </div>
            </div>
            <div className="plasmo-text-sm plasmo-text-text-muted plasmo-pt-3 plasmo-border-t plasmo-border-border plasmo-space-y-1">
              {s.segments.map((seg, i) => (
                <div key={i} className="plasmo-flex plasmo-items-center plasmo-gap-2">
                  <span className="plasmo-text-xs plasmo-text-[#707070] plasmo-w-12">{seg.fromTime}</span>
                  <span className="plasmo-text-white">{seg.fromStation}</span>
                  <span className="plasmo-text-text-muted">→</span>
                  <span className="plasmo-text-xs plasmo-text-[#707070] plasmo-w-12">{seg.toTime}</span>
                  <span className="plasmo-text-white">{seg.toStation}</span>
                  <span className="plasmo-ml-auto plasmo-text-xs plasmo-px-2 plasmo-py-px plasmo-rounded-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-text-text-muted">
                    {seg.seatType} ¥{seg.price}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
