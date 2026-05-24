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

const running = new Map<string, boolean>()

export function startPolling(cfg: PollerConfig, onTicket: (strategy: GenStrategy, ticket: ParsedTicket) => void) {
  stopPolling(cfg.taskId)
  running.set(cfg.taskId, true)
  pollLoop(cfg, onTicket)
}

export function stopPolling(taskId: string) {
  running.set(taskId, false)
}

export interface ParsedTicket {
  secretStr: string           // [0] 下单Token
  buttonText: string           // [1] 预订/候补
  trainCode: string            // [2] train_no内部编号
  trainNo: string              // [3] 车次
  startStationCode: string     // [4] 始发站电报码
  endStationCode: string       // [5] 终点站电报码
  fromStationCode: string      // [6] 出发站电报码
  toStationCode: string        // [7] 到达站电报码
  departTime: string           // [8] 出发时间
  arriveTime: string           // [9] 到达时间
  duration: string             // [10] 历时
  controlledFlag: string       // [11] 控制标志 Y/N
  verifyToken: string          // [12] 校验Token
  travelDate: string           // [13] 乘车日期
  ctrl1: string                // [14] 内部控制位
  ctrl2: string                // [15] 内部控制位
  fromStationSeq: string       // [16] 出发站序号
  toStationSeq: string         // [17] 到达站序号
  canChooseSeat: string        // [18] 是否允许选座
  ctrl3: string                // [19]
  highSoftSleeper: string      // [20] 高级软卧
  softSeat: string             // [21] 软座
  specialSeat: string          // [22] 特等座
  softSleeper: string          // [23] 软卧/一等卧
  otherSeat1: string           // [24]
  otherSeat2: string           // [25]
  noSeat: string               // [26] 无座
  ctrl4: string                // [27]
  hardSleeper: string          // [28] 硬卧/二等卧
  hardSeat: string             // [29] 硬座
  secondClass: string          // [30] 二等座
  firstClass: string           // [31] 一等座
  businessClass: string        // [32] 商务座
  sleeperSeat: string          // [33] 动卧
  seatComboCode: string        // [34] 席别类型组合Code
  priceCtrl: string            // [35] 票价控制字
  canChooseSeatCtrl: string    // [36] 是否支持选座控制位
  canWaitlist: string          // [37] 是否支持候补
  inventoryId: string          // [38] 内部流水ID
  ctrl5: string                // [39]
  seatDetailCtrl: string       // [40] 细分座位控制串
  regionCtrl: string           // [41] 地区控制
  waitlistDetail: string       // [42] 候补控制详情
  stationSeqCombo: string      // [43] 车站代码组合序列
  saleTime: string             // [44] 起售时间(YYYYMMDDHHmm)
  saleActiveFlag: string       // [45] 可售状态 Y/N

  // computed
  rawParts: string[]
  seatDiscountInfo: string
  seats: Record<string, string>  // 所有席别余票
}

const SEAT_FIELD_MAP: [string, number][] = [
  ['高级软卧', 20], ['软座', 21], ['特等座', 22], ['软卧', 23],
  ['无座', 26], ['硬卧', 28], ['硬座', 29], ['二等座', 30],
  ['一等座', 31], ['商务座', 32], ['动卧', 33],
]

function parseRow(raw: string): ParsedTicket | null {
  try {
    const p = raw.split('|')
    if (p.length < 46) return null

    const seats: Record<string, string> = {}
    for (const [name, idx] of SEAT_FIELD_MAP) {
      const v = p[idx] || ''
      seats[name] = v || '--'
    }

    const seatDiscountRe = /^(\d{5}[A-Z]\d{4}[A-Z]\d{4}[A-Z]\d{4})$/
    let discount = ''
    for (let i = p.length - 2; i >= 35; i--) {
      if (seatDiscountRe.test(p[i])) { discount = p[i]; break }
    }

    return {
      secretStr: decodeURIComponent(p[0]),
      buttonText: p[1],
      trainCode: p[2],
      trainNo: p[3],
      startStationCode: p[4],
      endStationCode: p[5],
      fromStationCode: p[6],
      toStationCode: p[7],
      departTime: p[8],
      arriveTime: p[9],
      duration: p[10],
      controlledFlag: p[11],
      verifyToken: p[12],
      travelDate: p[13],
      ctrl1: p[14],
      ctrl2: p[15],
      fromStationSeq: p[16],
      toStationSeq: p[17],
      canChooseSeat: p[18],
      ctrl3: p[19],
      highSoftSleeper: p[20],
      softSeat: p[21],
      specialSeat: p[22],
      softSleeper: p[23],
      otherSeat1: p[24],
      otherSeat2: p[25],
      noSeat: p[26],
      ctrl4: p[27],
      hardSleeper: p[28],
      hardSeat: p[29],
      secondClass: p[30],
      firstClass: p[31],
      businessClass: p[32],
      sleeperSeat: p[33],
      seatComboCode: p[34],
      priceCtrl: p[35],
      canChooseSeatCtrl: p[36],
      canWaitlist: p[37],
      inventoryId: p[38],
      ctrl5: p[39],
      seatDetailCtrl: p[40],
      regionCtrl: p[41],
      waitlistDetail: p[42],
      stationSeqCombo: p[43],
      saleTime: p[44],
      saleActiveFlag: p[45],
      rawParts: p,
      seatDiscountInfo: discount,
      seats,
    }
  } catch {
    return null
  }
}

async function pollLoop(cfg: PollerConfig, onTicket: (s: GenStrategy, t: ParsedTicket) => void) {
  let tick = 0
  console.log('[EasyHome] pollLoop start, taskId:', cfg.taskId,
    'train:', cfg.trainNo, 'date:', cfg.travelDate,
    'strategies:', cfg.strategies.map(s => `${s.type}:${s.fromStation}->${s.toStation}`))

  if (cfg.strategies.length === 0) {
    console.error('[EasyHome] NO STRATEGIES! Polling cannot start.')
    running.delete(cfg.taskId)
    return
  }

  while (running.get(cfg.taskId)) {
    tick++
    for (const strategy of cfg.strategies) {
      if (!running.get(cfg.taskId)) break
      try {
        const from = strategy.fromStation
        const to = strategy.toStation
        if (!from || !to) {
          console.error(`[EasyHome] tick ${tick} BAD STRATEGY: from="${from}" to="${to}" type=${strategy.type}`)
          continue
        }
        const tickets = await queryTickets(from, to, cfg.travelDate)
        const match = tickets.find(t =>
          t.trainNo === cfg.trainNo && hasSeat(t, cfg.seatTypes),
        )
        if (match) {
          running.set(cfg.taskId, false)
          console.log('[EasyHome] TICKET FOUND!', match.trainNo, match.seats)
          onTicket(strategy, match)
          return
        }
      } catch (e) {
        console.error('[EasyHome] poll error:', e)
      }
    }

    if (tick % 5 === 0) {
      console.log(`[EasyHome] tick ${tick}, no tickets yet`)
    }

    await new Promise(r => setTimeout(r, 2000))
  }

  console.log('[EasyHome] pollLoop stop', cfg.taskId)
  running.delete(cfg.taskId)
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
  const resp = await fetch('https://kyfw.12306.cn/otn/leftTicket/queryG?' + new URLSearchParams(params), {
    credentials: 'include',
    headers: { 'Referer': 'https://kyfw.12306.cn/otn/leftTicket/init' },
  })

  if (!resp.ok) { log('queryG', params, { error: `HTTP ${resp.status}` }); return [] }
  const data = await resp.json()
  const tickets = (data?.data?.result || []).filter(r => typeof r === 'string').map(parseRow).filter(Boolean) as ParsedTicket[]
  log('queryG', params, { count: tickets.length, trains: tickets.map(t => t.trainNo) })
  return tickets
}

function hasSeat(ticket: ParsedTicket, seatTypes: string[]): boolean {
  for (const name of seatTypes) {
    const val = ticket.seats[name]
    if (val && val !== '无' && val !== '--' && val !== '' && val !== '*') return true
  }
  return false
}

export async function queryTrainSchedule(
  trainNo: string, fromCode: string, toCode: string, date: string,
): Promise<any[]> {
  // first query tickets to get the coded train_no (e.g. "3b0000G56202")
  const tickets = await queryTickets(fromCode, toCode, date)
  const match = tickets.find(t => t.trainNo === trainNo)
  const codedNo = match?.trainCode || trainNo

  const params = { train_no: codedNo, from_station_telecode: fromCode, to_station_telecode: toCode, depart_date: date }
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
