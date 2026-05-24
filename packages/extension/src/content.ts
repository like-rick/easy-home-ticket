import type { PlasmoCSConfig } from "plasmo"
import type { Passenger } from "./lib/types"
import { startPolling, stopPolling, queryTrainSchedule, queryTickets, submitOrder, submitWaitlist } from "./content/poller"
import type { GenStrategy } from "./content/strategy"
import type { PollerConfig } from "./content/poller"

export const config: PlasmoCSConfig = {
  matches: ["https://kyfw.12306.cn/*"]
}

let loginCache: { loggedIn: boolean; ts: number } | null = null
const LOGIN_CACHE_TTL = 6 * 3600_000

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.type === 'CHECK_LOGIN_STATUS') {
    if (loginCache && Date.now() - loginCache.ts < LOGIN_CACHE_TTL) {
      sendResponse({ loggedIn: loginCache.loggedIn })
      return true
    }
    fetch('https://kyfw.12306.cn/otn/login/conf', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).then(r => r.json()).then(d => {
      const isLogin = (!!(d.status && d.httpstatus === 200)) && d.data?.is_login === 'Y';
      loginCache = { loggedIn: isLogin, ts: Date.now() }
      sendResponse({ loggedIn: loginCache.loggedIn })
    }).catch(() => sendResponse({ error: 'fetch_failed' }))
    return true
  }

  if (msg.type === 'FETCH_PASSENGERS') {
    fetchPassengers().then(p => sendResponse({ passengers: p }))
      .catch(e => sendResponse({ error: e.message || 'fetch_failed' }))
    return true
  }

  if (msg.type === 'FETCH_STATIONS') {
    fetchStations().then(stations => sendResponse({ stations }))
      .catch(e => sendResponse({ error: e.message }))
    return true
  }

  if (msg.type === 'QUERY_SCHEDULE') {
    queryTrainSchedule(msg.trainNo, msg.fromCode, msg.toCode, msg.date)
      .then(stops => sendResponse({ stops }))
      .catch(e => sendResponse({ error: e.message }))
    return true
  }

  if (msg.type === 'START_POLLING') {
    buildAndStart(msg.config, sendResponse)
    return true
  }

  if (msg.type === 'STOP_POLLING') {
    stopPolling(msg.taskId)
    sendResponse({ ack: true })
    return true
  }

  if (msg.type === 'PREVIEW_STRATEGIES') {
    previewStrategies(msg.trainNo, msg.fromCode, msg.toCode, msg.fromStationName, msg.toStationName, msg.date)
      .then(strategies => sendResponse({ strategies }))
      .catch(e => sendResponse({ error: e.message }))
    return true
  }

  if (msg.type === 'QUERY_DETAIL') {
    getTrainDetail(msg.trainNo, msg.date, msg.fromStationName, msg.toStationName)
      .then(ticket => sendResponse({ ticket: ticket || null }))
      .catch(e => sendResponse({ error: e.message }))
    return true
  }

  if (msg.type === 'SUBMIT_WAITLIST') {
    submitWaitlist(msg.strategy, msg.passengers, msg.trainNo, msg.travelDate)
      .then(r => sendResponse(r))
    return true
  }
})

async function fetchPassengers(): Promise<Passenger[]> {
  const resp = await fetch('https://kyfw.12306.cn/otn/passengers/query', {
    method: 'POST',
    body: new URLSearchParams({ pageIndex: '1', pageSize: '10' }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  if (!resp.ok) throw new Error('fetch_failed')
  const data = await resp.json()
  if (!data.status && data.httpstatus !== 200) throw new Error('not_logged_in')
  const list = data.data?.datas || []
  return list.map((p: any) => ({
    id: p.passenger_id || p.passenger_uuid || '',
    name: p.passenger_name || '',
    idType: p.passenger_id_type_name || '成人',
    idNumber: p.passenger_id_no || '',
    sexCode: p.sex_code || '',
    sexName: p.sex_name || '',
    bornDate: p.born_date || '',
    countryCode: p.country_code || '',
    idTypeCode: p.passenger_id_type_code || '',
    passengerType: p.passenger_type || '',
    passengerTypeName: p.passenger_type_name || '',
    mobileNo: p.mobile_no || '',
    phoneNo: p.phone_no || '',
    email: p.email || '',
    address: p.address || '',
    postalcode: p.postalcode || '',
    firstLetter: p.first_letter || '',
    recordCount: p.recordCount || '',
    isUserSelf: p.isUserSelf || '',
    totalTimes: p.total_times || '',
    deleteTime: p.delete_time || '',
    allEncStr: p.allEncStr || '',
    isAdult: p.isAdult || '',
    isYongThan10: p.isYongThan10 || '',
    isYongThan14: p.isYongThan14 || '',
    isOldThan60: p.isOldThan60 || '',
    ifReceive: p.if_receive || '',
    isActive: p.is_active || '',
    isBuyTicket: p.is_buy_ticket || '',
    lastTime: p.last_time || '',
    passengerUuid: p.passenger_uuid || '',
    ifPreferential: p.if_preferential || '',
    mobileCode: p.mobile_code || '',
    temporaryAge60: p.temporay_age60 || '',
    gatBornDate: p.gat_born_date || '',
    gatValidDateStart: p.gat_valid_date_start || '',
    gatValidDateEnd: p.gat_valid_date_end || '',
    gatVersion: p.gat_version || '',
  }))
}

async function fetchStations(): Promise<{ name: string; code: string; pinyin: string }[]> {
  const resp = await fetch('https://kyfw.12306.cn/otn/resources/js/framework/station_name.js', { credentials: 'include' })
  if (!resp.ok) throw new Error('fetch_failed')
  const text = await resp.text()
  // parse: @pinyin|name|code|full_pinyin|...
  const re = /@([^|]+)\|([^|]+)\|([A-Z]+)\|([^|]+)\|/g
  const stations: { name: string; code: string; pinyin: string }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    stations.push({ pinyin: m[1], name: m[2], code: m[3] })
  }
  return stations
}

async function buildAndStart(rawCfg: any, sendResponse: (r: any) => void) {
  const { taskId, fromCode, toCode, trainNo, travelDate, seatTypes, passengers, splitTicket, extraOneStop } = rawCfg

  // 1. generate strategies from 12306
  const strategies: GenStrategy[] = []
  try {
    const stops = await queryTrainSchedule(trainNo, fromCode, toCode, travelDate)
    if (stops.length > 0) {
      const fromStationName = rawCfg.fromStationName || ''
      const toStationName = rawCfg.toStationName || ''
      const stopNames = stops.map((s: any) => s.station_name)
      const fromIdx = stopNames.indexOf(fromStationName)
      let toIdx = stopNames.lastIndexOf(toStationName)
      // fallback: if destination not on this train, use the last stop
      if (toIdx === -1) toIdx = stops.length - 1
      console.log('[EasyHome] fromIdx=', fromIdx, 'toIdx=', toIdx, 'stops:', stopNames)
      if (fromIdx !== -1 && fromIdx < toIdx) {
        const directPrice = stops[toIdx]?.price || 0
        strategies.push({ type: 'direct', label: '直达', extraFee: 0, totalPrice: directPrice, fromStation: fromCode, toStation: toCode, fromStationName: rawCfg.fromStationName || '', toStationName: rawCfg.toStationName || '' })
        if (splitTicket) {
          for (let mid = fromIdx + 1; mid < toIdx; mid++) {
            const s = stops[mid] as any
            const p = s.price || 0
            const seg1 = p - (stops[fromIdx] as any)?.price || 0
            const seg2 = directPrice - p
            strategies.push({ type: 'split', label: `分段: ${stops[mid].station_name}`, extraFee: Math.max(seg1, 0) + Math.max(seg2, 0) - directPrice, totalPrice: Math.max(seg1, 0) + Math.max(seg2, 0), fromStation: fromCode, toStation: s.station_train_code || s.station_name || '', fromStationName: rawCfg.fromStationName || '', toStationName: rawCfg.toStationName || '' })
          }
        }
        if (extraOneStop && toIdx + 1 < stops.length) {
          const s = stops[toIdx + 1] as any
          strategies.push({ type: 'longer1', label: `多买一站: ${s.station_name}`, extraFee: Math.max((s.price || 0) - directPrice, 0), totalPrice: s.price || 0, fromStation: fromCode, toStation: s.station_train_code || s.station_name || '', fromStationName: rawCfg.fromStationName || '', toStationName: rawCfg.toStationName || '' })
        }
      }
    }
  } catch (e) {
    console.error('[EasyHome] strategy generation failed:', e)
  }

  console.log('[EasyHome] generated strategies:', strategies.length, strategies.map(s => s.type))

  if (strategies.length === 0) {
    sendResponse({ ack: false, error: 'no_strategies' })
    return
  }

  const cfg: PollerConfig = { taskId, fromCode, toCode, trainNo, travelDate, seatTypes, strategies, passengers }

  chrome.runtime.sendMessage({
    type: 'SCAN_LOG', taskId, event: 'polling_start',
    detail: `开始轮询 ${trainNo}，${strategies.length}个策略`,
  }).catch(() => {})

  startPolling(cfg, (strategy, ticket) => {
    const today = new Date().toISOString().slice(0, 10)
    chrome.runtime.sendMessage({
      type: 'SCAN_LOG', taskId, event: 'ticket_found',
      detail: `${ticket.trainNo} 有票！正在下单...`,
    }).catch(() => {})
    submitOrder(ticket.secretStr, cfg.travelDate, today, strategy.fromStationName, strategy.toStationName, ticket.seatDiscountInfo)
      .then(result => {
        chrome.runtime.sendMessage({
          type: 'ORDER_RESULT', taskId, trainNo: ticket.trainNo,
          ok: result.ok, message: result.message || '',
        })
      })
  })

  sendResponse({ ack: true })
}

async function previewStrategies(
  trainNo: string, fromCode: string, toCode: string,
  fromStationName: string, toStationName: string, date: string,
): Promise<any[]> {
  const stops = await queryTrainSchedule(trainNo, fromCode, toCode, date)
  if (!stops.length) return []

  const stopNames = stops.map((s: any) => s.station_name)
  const fromIdx = stopNames.indexOf(fromStationName)
  let toIdx = stopNames.lastIndexOf(toStationName)
  if (toIdx === -1) toIdx = stops.length - 1
  if (fromIdx === -1 || fromIdx >= toIdx) return []

  const directPrice = (stops[toIdx] as any)?.price || 0
  const result: any[] = []

  // direct
  result.push({ type: 'direct', label: `${fromStationName}→${toStationName} 直达`, totalPrice: directPrice, extraFee: 0, fromStation: fromCode, toStation: toCode, fromStationName, toStationName })

  // split
  for (let mid = fromIdx + 1; mid < toIdx; mid++) {
    const s = stops[mid] as any
    const p = s.price || 0
    const seg1 = p - ((stops[fromIdx] as any)?.price || 0)
    const seg2 = directPrice - p
    const total = Math.max(seg1, 0) + Math.max(seg2, 0)
    const extra = total - directPrice
    result.push({ type: 'split', label: `${fromStationName}→${s.station_name} + ${s.station_name}→${toStationName}`, totalPrice: total, extraFee: Math.max(extra, 0), fromStation: fromCode, toStation: s.station_train_code || s.station_name || '', fromStationName, toStationName })
  }

  // longer1
  if (toIdx + 1 < stops.length) {
    const s = stops[toIdx + 1] as any
    const price = s.price || 0
    result.push({ type: 'longer1', label: `多买一站到${s.station_name}（${toStationName}下车）`, totalPrice: price, extraFee: Math.max(price - directPrice, 0), fromStation: fromCode, toStation: s.station_train_code || s.station_name || '', fromStationName, toStationName })
  }

  return result
}

async function getTrainDetail(trainNo: string, date: string, fromName: string, toName: string) {
  // resolve station names -> codes from cache
  const stations: { name: string; code: string }[] = await (async () => {
    const cached = await new Promise<{ name: string; code: string }[]>(resolve => {
      chrome.storage.local.get('easyticket_stations', data => resolve(data.easyticket_stations || []))
    })
    if (cached.length > 0) return cached
    return fetchStations()
  })()

  const fromCode = stations.find(s => s.name === fromName)?.code || ''
  const toCode = stations.find(s => s.name === toName)?.code || ''
  if (!fromCode || !toCode) return null

  const tickets = await queryTickets(fromCode, toCode, date)
  return tickets.find(t => t.trainNo === trainNo) || null
}
