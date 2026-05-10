import type { PlasmoCSConfig } from "plasmo"
import type { OrderSignal, Passenger } from "./lib/types"
import { executeOrder } from "./content/executor"

export const config: PlasmoCSConfig = {
  matches: ["https://kyfw.12306.cn/*"]
}

let loginCache: { loggedIn: boolean; ts: number; ttl: number } | null = null

function cacheTtl() {
  return (25 + Math.random() * 10) * 60_000 // 25–35 min
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'ORDER_SIGNAL') {
    executeOrder(msg as OrderSignal).then(result => {
      chrome.runtime.sendMessage({ type: 'ORDER_RESULT', taskId: msg.taskId, result })
    })
    sendResponse({ ack: true })
    return true
  }

  if (msg.type === 'CHECK_LOGIN_STATUS') {
    if (loginCache && Date.now() - loginCache.ts < loginCache.ttl) {
      sendResponse({ loggedIn: loginCache.loggedIn })
      return true
    }
    fetch('https://kyfw.12306.cn/otn/confirmPassenger/getPassengerDTOs', { credentials: 'include' })
      .then(resp => resp.json())
      .then(data => {
        loginCache = { loggedIn: !!(data.status || data.httpstatus === 200), ts: Date.now(), ttl: cacheTtl() }
        sendResponse({ loggedIn: loginCache.loggedIn })
      })
      .catch(() => { sendResponse({ loggedIn: false }) })
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
  const onPassengerPage = location.href.includes('passengers') || location.href.includes('passenger')
  if (!onPassengerPage) {
    const resp = await fetch('https://kyfw.12306.cn/otn/confirmPassenger/getPassengerDTOs', { credentials: 'include' })
    if (!resp.ok) throw new Error('fetch_failed')
    const data = await resp.json()
    if (!data.status && data.httpstatus !== 200) throw new Error('not_logged_in')
    const list = data.data?.normal_passengers || data.data?.passenger_info_dto_list || data.data?.list || []
    if (!list.length) return []
    return list.map((p: any) => ({
      id: p.passenger_id || p.passenger_uuid || p.allEncStr || p.code || '',
      name: p.passenger_name || p.name || '',
      idType: p.passenger_id_type_name || p.id_type_name || '成人',
      idNumber: p.passenger_id_no || p.id_number || '',
    }))
  }

  // DOM scraping fallback on passenger list page
  const rows = document.querySelectorAll('#passenger_list li, .passenger-item, [id*="passenger"] li, tr[class*="passenger"]')
  const result: Passenger[] = []
  rows.forEach(row => {
    const nameEl = row.querySelector('[class*="name"], .passenger-name, td:nth-child(2)')
    const idEl = row.querySelector('[class*="id"], .passenger-id, td:nth-child(3)')
    if (nameEl && idEl) {
      result.push({
        id: idEl.textContent?.trim() || '',
        name: nameEl.textContent?.trim() || '',
        idType: '成人',
        idNumber: idEl.textContent?.trim() || '',
      })
    }
  })
  return result
}
