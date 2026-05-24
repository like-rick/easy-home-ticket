import type { GenStrategy } from './strategy'

// ---- logging ----

const DEBUG = true

function log(method: string, params: Record<string, string>, data: any) {
  if (!DEBUG) return
  console.group(`[EasyHome] ${method}`)
  console.log('入参:', JSON.stringify(params, null, 2))
  console.log('响应:', data)
  console.groupEnd()
}

// ---- types ----

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

export function startPolling(cfg: PollerConfig, onTicket: (strategy: GenStrategy, ticket: ParsedTicket) => void) {
  stopPolling(cfg.taskId)
  timers.set(cfg.taskId, setInterval(() => poll(cfg, onTicket), 2000))
}

export function stopPolling(taskId: string) {
  const t = timers.get(taskId)
  if (t) { clearInterval(t); timers.delete(taskId) }
}

interface ParsedTicket {
  secretStr: string
  train_no: string
  from_station: string
  to_station: string
  depart_time: string
  arrive_time: string
  seatDiscountInfo: string
  rawParts: string[]
}

function parseRow(raw: string): ParsedTicket | null {
  try {
    const p = raw.split('|')
    if (p.length < 10) return null
    const re = /^(\d{5}[A-Z]\d{4}[A-Z]\d{4}[A-Z]\d{4})$/
    let discount = ''
    for (let i = p.length - 2; i >= Math.max(35, p.length - 10); i--) {
      if (re.test(p[i])) { discount = p[i]; break }
    }
    return {
      secretStr: decodeURIComponent(p[0]),
      train_no: p[3],
      from_station: p[6],
      to_station: p[7],
      depart_time: p[8],
      arrive_time: p[9],
      seatDiscountInfo: discount,
      rawParts: p,
    }
  } catch {
    return null
  }
}

async function poll(cfg: PollerConfig, onTicket: (s: GenStrategy, t: ParsedTicket) => void) {
  for (const strategy of cfg.strategies) {
    try {
      const tickets = await queryTickets(strategy.fromStation, strategy.toStation, cfg.travelDate)
      const match = tickets.find(t =>
        t.train_no === cfg.trainNo && hasSeat(t, cfg.seatTypes),
      )
      if (match) {
        stopPolling(cfg.taskId)
        onTicket(strategy, match)
        return
      }
    } catch {
      // next tick
    }
  }
}

export async function queryTickets(
  fromCode: string, toCode: string, date: string,
): Promise<ParsedTicket[]> {
  const params = {
    'leftTicketDTO.train_date': date,
    'leftTicketDTO.from_station': fromCode,
    'leftTicketDTO.to_station': toCode,
    'purpose_codes': 'ADULT',
  }
  const resp = await fetch('https://kyfw.12306.cn/otn/leftTicket/queryZ?' + new URLSearchParams(params), {
    credentials: 'include',
    headers: { 'Referer': 'https://kyfw.12306.cn/otn/leftTicket/init' },
  })

  if (!resp.ok) { log('queryZ', params, { error: `HTTP ${resp.status}` }); return [] }
  const data = await resp.json()
  const tickets = (data?.data?.result || []).filter(r => typeof r === 'string').map(parseRow).filter(Boolean) as ParsedTicket[]
  log('queryZ', params, { count: tickets.length, trains: tickets.map(t => t.train_no) })
  return tickets
}

function hasSeat(ticket: ParsedTicket, seatTypes: string[]): boolean {
  const seatMap: Record<string, number> = { '二等座': 30, '一等座': 31, '商务座': 32, '硬卧': 28, '软卧': 23, '硬座': 29, '无座': 26 }
  for (const name of seatTypes) {
    const idx = seatMap[name]
    if (idx === undefined) continue
    const val = ticket.rawParts[idx] || ''
    if (val && val !== '无' && val !== '' && val !== '*') return true
  }
  return false
}

export async function queryTrainSchedule(
  trainNo: string, fromCode: string, toCode: string, date: string,
): Promise<any[]> {
  const params = { train_no: trainNo, from_station_telecode: fromCode, to_station_telecode: toCode, depart_date: date }
  const resp = await fetch('https://kyfw.12306.cn/otn/czxx/queryByTrainNo?' + new URLSearchParams(params), {
    credentials: 'include',
    headers: { 'Referer': 'https://kyfw.12306.cn/otn/leftTicket/init' },
  })
  if (!resp.ok) { log('queryByTrainNo', params, { error: `HTTP ${resp.status}` }); return [] }
  const data = await resp.json()
  const stops = data?.data?.data || []
  log('queryByTrainNo', params, { stops: stops.length })
  return stops
}

export async function submitOrder(
  secretStr: string,
  trainDate: string,
  backTrainDate: string,
  fromStationName: string,
  toStationName: string,
  seatDiscountInfo: string,
): Promise<{ ok: boolean; message?: string }> {
  const params: Record<string, string> = {
    secretStr: secretStr.slice(0, 50) + '...',
    train_date: trainDate,
    back_train_date: backTrainDate,
    tour_flag: 'dc',
    purpose_codes: 'ADULT',
    query_from_station_name: fromStationName,
    query_to_station_name: toStationName,
    seat_discount_info: seatDiscountInfo,
  }
  try {
    const body = new URLSearchParams()
    body.set('secretStr', secretStr)
    body.set('train_date', trainDate)
    body.set('back_train_date', backTrainDate)
    body.set('tour_flag', 'dc')
    body.set('purpose_codes', 'ADULT')
    body.set('query_from_station_name', fromStationName)
    body.set('query_to_station_name', toStationName)
    body.set('bed_level_info', '')
    body.set('seat_discount_info', seatDiscountInfo)

    const resp = await fetch('https://kyfw.12306.cn/otn/leftTicket/submitOrderRequest', {
      method: 'POST',
      body,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://kyfw.12306.cn/otn/leftTicket/init',
      },
    })
    const data = await resp.json()
    log('submitOrderRequest', params, data)
    return {
      ok: data.status === true,
      message: data.data?.errMsg || data.messages || '',
    }
  } catch (e: any) {
    log('submitOrderRequest', params, { error: e.message })
    return { ok: false, message: e.message }
  }
}

export async function submitWaitlist(
  strategy: GenStrategy, passengers: any[], trainNo: string, travelDate: string,
): Promise<{ ok: boolean }> {
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
