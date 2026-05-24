interface StopInfo {
  station_train_code: string
  station_name: string
  arrive_time: string
  start_time: string
}

export interface GenStrategy {
  type: 'direct' | 'split' | 'longer1' | 'longer2'
  label: string
  fromStation: string
  toStation: string
  fromStationName: string
  toStationName: string
  extraFee: number
  totalPrice: number
}

export function generateStrategies(
  stops: StopInfo[],
  fromCode: string,
  toCode: string,
  fromName: string,
  toName: string,
  trainNo: string,
  splitEnabled: boolean,
  extraOne: boolean,
  extraTwo: boolean,
): GenStrategy[] {
  const result: GenStrategy[] = []

  // Resolve indices
  let fromIdx = -1, toIdx = -1
  for (let i = 0; i < stops.length; i++) {
    const c = stops[i].station_train_code
    if (c === fromCode && fromIdx === -1) fromIdx = i
    if (c === toCode) toIdx = i
  }
  if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) return result

  const directPrice = (stops[toIdx] as any).price || 0

  // Direct
  result.push({
    type: 'direct', label: `${fromName}→${toName} 直达`,
    fromStation: fromCode, toStation: toCode,
    fromStationName: fromName, toStationName: toName,
    extraFee: 0, totalPrice: directPrice,
  })

  // 上车补票 — split via each intermediate stop
  if (splitEnabled) {
    for (let mid = fromIdx + 1; mid < toIdx; mid++) {
      const midStop = stops[mid]
      const seg1Price = ((midStop as any).price || 0) - ((stops[fromIdx] as any).price || 0)
      const seg2Price = ((stops[toIdx] as any).price || 0) - ((midStop as any).price || 0)
      const total = Math.max(seg1Price, 0) + Math.max(seg2Price, 0)
      const extra = total - directPrice
      const midName = midStop.station_name
      result.push({
        type: 'split',
        label: `${fromName}→${midName} + ${midName}→${toName}`,
        fromStation: fromCode, toStation: midStop.station_train_code,
        fromStationName: fromName, toStationName: midName,
        extraFee: Math.max(extra, 0), totalPrice: total,
      })
    }
  }

  // 多买一站
  if (extraOne && toIdx + 1 < stops.length) {
    const next = stops[toIdx + 1]
    const price = (next as any).price || 0
    result.push({
      type: 'longer1',
      label: `多买一站到${next.station_name}（${toName}下车）`,
      fromStation: fromCode, toStation: next.station_train_code,
      fromStationName: fromName, toStationName: next.station_name,
      extraFee: Math.max(price - directPrice, 0), totalPrice: price,
    })
  }

  // 多买两站
  if (extraTwo && toIdx + 2 < stops.length) {
    const next2 = stops[toIdx + 2]
    const price = (next2 as any).price || 0
    result.push({
      type: 'longer2',
      label: `多买两站到${next2.station_name}（${toName}下车）`,
      fromStation: fromCode, toStation: next2.station_train_code,
      fromStationName: fromName, toStationName: next2.station_name,
      extraFee: Math.max(price - directPrice, 0), totalPrice: price,
    })
  }

  return result
}
