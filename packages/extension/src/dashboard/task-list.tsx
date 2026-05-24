import React from 'react'

interface TaskItem {
  id: string
  name: string
  fromStation: string
  toStation: string
  travelDate: string
  status: string
}

export function TaskList({ tasks, onSelect, selectedId, onDelete }: { tasks: TaskItem[]; onSelect: (id: string) => void; selectedId: string | null; onDelete?: (id: string) => void }) {
  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-gap-2">
      {tasks.map(t => (
        <div key={t.id}
          onClick={() => onSelect(t.id)}
          className={`plasmo-p-4 plasmo-rounded-xl plasmo-cursor-pointer plasmo-border plasmo-transition-colors ${
            selectedId === t.id
              ? 'plasmo-border-primary plasmo-bg-canvas'
              : 'plasmo-border-border plasmo-bg-canvas hover:plasmo-border-primary/30'
          }`}>
          <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
            <div className="plasmo-w-8 plasmo-h-8 plasmo-rounded-lg plasmo-bg-canvas-soft plasmo-border plasmo-border-border plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-sm plasmo-flex-shrink-0">
              🚄
            </div>
            <div className="plasmo-flex-1 plasmo-min-w-0">
              <div className="plasmo-flex plasmo-justify-between plasmo-items-center">
                <span className="plasmo-text-sm plasmo-font-medium plasmo-text-white plasmo-truncate">
                  {t.name || `${t.fromStation}→${t.toStation}`}
                </span>
                <span
                  className="plasmo-w-1.5 plasmo-h-1.5 plasmo-rounded-full plasmo-flex-shrink-0 plasmo-ml-2"
                  style={{
                    backgroundColor: t.status === 'active' ? '#3ecf8e' : '#707070',
                    boxShadow: t.status === 'active' ? '0 0 5px #3ecf8e88' : 'none',
                  }}
                />
              </div>
              <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-mt-1">
                <span className="plasmo-text-xs plasmo-text-text-muted">{t.travelDate}</span>
                <span className="plasmo-text-xs" style={{ color: t.status === 'active' ? '#3ecf8e' : '#707070' }}>
                  {t.status === 'active' ? '监控中' : t.status === 'scanning' ? '轮询中' : t.status === 'ordered' ? '已下单' : '等待中'}
                </span>
                {onDelete && <button onClick={e => { e.stopPropagation(); onDelete(t.id) }} className="plasmo-ml-auto plasmo-text-xs plasmo-text-red-500 hover:plasmo-text-red-400">删除</button>}
              </div>
            </div>
          </div>
        </div>
      ))}
      {tasks.length === 0 && (
        <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-gap-3 plasmo-py-12">
          <div className="plasmo-w-12 plasmo-h-12 plasmo-rounded-full plasmo-bg-canvas plasmo-border plasmo-border-border plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-xl">
            🎫
          </div>
          <div className="plasmo-text-text-muted plasmo-text-sm">暂无监控任务</div>
          <div className="plasmo-text-[#707070] plasmo-text-xs">点击"+ 新建任务"开始抢票监控</div>
        </div>
      )}
    </div>
  )
}
