import type { GenStrategy } from './strategy'

export interface PollerConfig {
  taskId: string
  fromCode: string
  toCode: string
  trainNo: string
  travelDate: string
  seatTypes: string[]
  strategies: GenStrategy[]
  passengers: { id: string; name: string; idType: string; idNumber: string }[]
}

const timers = new Map<string, ReturnType<typeof setInterval>>()

export function startPolling(cfg: PollerConfig, onTicket: (strategy: GenStrategy) => void) {
  stopPolling(cfg.taskId)
  timers.set(cfg.taskId, setInterval(() => poll(cfg, onTicket), 2000))
}

export function stopPolling(taskId: string) {
  const t = timers.get(taskId)
  if (t) { clearInterval(t); timers.delete(taskId) }
}

async function poll(cfg: PollerConfig, onTicket: (s: GenStrategy) => void) {
  for (const strategy of cfg.strategies) {
    try {
      const tickets = await queryTickets(
        strategy.fromStation, strategy.toStation, cfg.trainNo, cfg.travelDate,
      )
      const match = tickets.find((t: any) =>
        t.train_no === cfg.trainNo && hasSeat(t, cfg.seatTypes),
      )
      if (match) {
        onTicket(strategy)
        return
      }
    } catch {
      // next tick
    }
  }
}

export async function queryTickets(
  fromCode: string, toCode: string, trainNo: string, date: string,
): Promise<any[]> {
  const resp = await fetch('https://kyfw.12306.cn/otn/leftTicket/queryZ?' + new URLSearchParams({
    'leftTicketDTO.train_date': date,
    'leftTicketDTO.from_station': fromCode,
    'leftTicketDTO.to_station': toCode,
    'purpose_codes': 'ADULT',
  }), { credentials: 'include' })

  if (!resp.ok) return []
  const data = await resp.json()
  const raw: string[] = data?.data?.result || []
  return raw.filter(r => typeof r === 'string').map(r => {
    const p = r.split('|')
    return {
      train_no: p[2],
      from_station: p[6],
      to_station: p[7],
      depart_time: p[8],
      arrive_time: p[9],
      raw: p,
    }
  }).filter(t => t.train_no === trainNo)
}

function hasSeat(ticket: any, seatTypes: string[]): boolean {
  const seatMap: Record<string, number> = { '二等座': 30, '一等座': 31, '商务座': 32, '硬卧': 28, '软卧': 23, '硬座': 29, '无座': 26 }
  for (const name of seatTypes) {
    const idx = seatMap[name]
    if (idx !== undefined && ticket.raw[idx] && ticket.raw[idx] !== '无' && ticket.raw[idx] !== '') {
      return true
    }
  }
  return false
}

export async function queryTrainSchedule(
  trainNo: string, fromCode: string, toCode: string, date: string,
): Promise<any[]> {
  const resp = await fetch('https://kyfw.12306.cn/otn/czxx/queryByTrainNo?' + new URLSearchParams({
    train_no: trainNo, from_station_telecode: fromCode, to_station_telecode: toCode, depart_date: date,
  }), { credentials: 'include' })
  if (!resp.ok) return []
  const data = await resp.json()
  return data?.data?.data || []
}

export async function submitOrder(
  strategy: GenStrategy, passengers: any[], trainNo: string, travelDate: string,
): Promise<{ ok: boolean; orderId?: string }> {
  try {
    const resp = await fetch('https://kyfw.12306.cn/otn/leftTicket/submitOrderRequest', {
      method: 'POST',
      body: new URLSearchParams({
        secretStr: '',
        train_date: travelDate,
        back_train_date: travelDate,
        purpose_codes: 'ADULT',
        query_from_station_name: strategy.fromStationName,
        query_to_station_name: strategy.toStationName,
      }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    const data = await resp.json()
    return { ok: data.status === true, orderId: data.data?.orderId }
  } catch {
    return { ok: false }
  }
}

export async function submitWaitlist(
  strategy: GenStrategy, passengers: any[], trainNo: string, travelDate: string,
): Promise<{ ok: boolean }> {
  // 12306 waitlist API — placeholder for actual implementation
  try {
    const resp = await fetch('https://kyfw.12306.cn/otn/afterNate/submitOrderRequest', {
      method: 'POST',
      body: new URLSearchParams({
        train_no: trainNo,
        fromStation: strategy.fromStation,
        toStation: strategy.toStation,
        travelDate,
        seatType: 'O',
        passengerIds: passengers.map((p: any) => p.id).join(','),
      }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    const data = await resp.json()
    return { ok: data.status === true }
  } catch {
    return { ok: false }
  }
}
