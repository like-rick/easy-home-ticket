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
    return <div className="plasmo-text-text-muted plasmo-text-center plasmo-py-8 plasmo-text-sm">选择左侧任务查看方案</div>
  }

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-gap-2">
      {solutions.map(s => {
        const st = STATUS_MAP[s.ticketStatus] || STATUS_MAP.pending
        return (
          <div key={s.id}
            className="plasmo-p-5 plasmo-rounded-xl plasmo-bg-canvas plasmo-border"
            style={{ borderColor: s.ticketStatus === 'available' ? 'rgba(62,207,142,0.27)' : '#333' }}>
            <div className="plasmo-flex plasmo-justify-between plasmo-items-center plasmo-mb-3">
              <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
                <span className="plasmo-text-lg plasmo-font-semibold plasmo-text-white">{s.trainNo}</span>
                <span className="plasmo-text-xs plasmo-px-2 plasmo-py-0.5 plasmo-rounded-full plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-text-text-muted">
                  {PLAN_LABELS[s.planType] || s.planType}
                </span>
                <span className="plasmo-text-xs plasmo-px-2 plasmo-py-0.5 plasmo-rounded-full" style={{ backgroundColor: st.bg, color: st.text }}>
                  {st.label}
                </span>
              </div>
              <span className="plasmo-text-xl plasmo-font-semibold" style={{ color: '#3ecf8e' }}>¥{s.totalPrice}</span>
            </div>
            <div className="plasmo-text-sm plasmo-text-text-muted plasmo-pt-3 plasmo-border-t plasmo-border-border">
              {s.segments.map((seg, i) => (
                <span key={i}>
                  {seg.fromStation} {seg.fromTime} → {seg.toStation} {seg.toTime} {seg.seatType} ¥{seg.price}
                  {i < s.segments.length - 1 ? ' + ' : ''}
                </span>
              ))}
            </div>
            {s.extraFee > 0 && (
              <div className="plasmo-text-xs plasmo-mt-2" style={{ color: '#ffdb13' }}>溢价 ¥{s.extraFee}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
