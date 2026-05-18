import type { PlasmoCSConfig } from "plasmo"
import type { OrderSignal, Passenger } from "./lib/types"
import { executeOrder } from "./content/executor"

export const config: PlasmoCSConfig = {
  matches: ["https://kyfw.12306.cn/*"]
}

let loginCache: { loggedIn: boolean; ts: number } | null = null
const LOGIN_CACHE_TTL = 6 * 3600_000 // 6 hours

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'ORDER_SIGNAL') {
    executeOrder(msg as OrderSignal).then(result => {
      chrome.runtime.sendMessage({ type: 'ORDER_RESULT', taskId: msg.taskId, result })
    })
    sendResponse({ ack: true })
    return true
  }

  if (msg.type === 'CHECK_LOGIN_STATUS') {
    if (loginCache && Date.now() - loginCache.ts < LOGIN_CACHE_TTL) {
      sendResponse({ loggedIn: loginCache.loggedIn })
      return true
    }
    fetch('https://kyfw.12306.cn/otn/login/conf', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
      .then(resp => resp.json())
      .then(data => {
        loginCache = { loggedIn: !!(data.status || data.httpstatus === 200), ts: Date.now() }
        sendResponse({ loggedIn: loginCache.loggedIn })
      })
      .catch(() => { sendResponse({ error: 'fetch_failed' }) })
    return true
  }

  if (msg.type === 'FETCH_PASSENGERS') {
    fetchPassengers().then(passengers => {
      sendResponse({ passengers })
    }).catch(err => {
      sendResponse({ error: err.message || 'fetch_failed' })
    })
    return true
  }
})

async function fetchPassengers(): Promise<Passenger[]> {
  const resp = await fetch('https://kyfw.12306.cn/otn/passengers/query', {
    method: 'POST',
    body: new URLSearchParams({
      pageIndex: '1',
      pageSize: '10',
    }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  if (!resp.ok) throw new Error('fetch_failed')
  const data = await resp.json()
  if (!data.status && data.httpstatus !== 200) throw new Error('not_logged_in')
  const list = data.data?.datas || []
  if (!list.length) return []
  return list.map((p: any) => ({
    id: p.passenger_id || p.passenger_uuid || p.allEncStr || p.code || '',
    name: p.passenger_name || p.name || '',
    idType: p.passenger_id_type_name || p.id_type_name || '成人',
    idNumber: p.passenger_id_no || p.id_number || '',
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
