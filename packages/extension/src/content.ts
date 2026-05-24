import type { PlasmoCSConfig } from "plasmo"
import type { Passenger } from "./lib/types"
import { generateStrategies } from "./content/strategy"
import { startPolling, stopPolling, queryTrainSchedule, submitOrder, submitWaitlist } from "./content/poller"
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
    const cfg = msg.config as PollerConfig
    startPolling(cfg, (strategy: GenStrategy, ticket) => {
      // ticket found — auto submit order
      const today = new Date().toISOString().slice(0, 10)
      submitOrder(
        ticket.secretStr, cfg.travelDate, today,
        strategy.fromStationName, strategy.toStationName,
        ticket.seatDiscountInfo,
      ).then(result => {
        chrome.runtime.sendMessage({
          type: 'ORDER_RESULT',
          taskId: cfg.taskId,
          trainNo: ticket.train_no,
          ok: result.ok,
          message: result.message || '',
        })
      })
    })
    sendResponse({ ack: true })
    return true
  }

  if (msg.type === 'STOP_POLLING') {
    stopPolling(msg.taskId)
    sendResponse({ ack: true })
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
