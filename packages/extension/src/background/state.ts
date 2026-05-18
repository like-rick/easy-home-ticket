import type { WsMessage, OrderSignal } from '../lib/types'

const listeners = new Map<string, Set<(data: unknown) => void>>()

export function subscribe(event: string, callback: (data: unknown) => void) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event)!.add(callback)
  return () => { listeners.get(event)?.delete(callback) }
}

export function routeMessage(msg: WsMessage) {
  chrome.runtime.sendMessage(msg).catch(() => {})

  if (msg.type === 'ORDER_SIGNAL') {
    handleOrderSignal(msg as OrderSignal)
  }

  const subs = listeners.get(msg.type)
  if (subs) {
    for (const cb of subs) cb(msg)
  }
}

export async function forwardToContentScript(
  msg: Record<string, unknown>,
  sendResponse: (response: Record<string, unknown>) => void,
) {
  const tabs = await chrome.tabs.query({ url: 'https://kyfw.12306.cn/*' })
  const tab = tabs.find(t => !t.discarded)
  if (!tab?.id) {
    sendResponse({ error: 'no_12306_tab' })
    return
  }
  chrome.tabs.sendMessage(tab.id, msg, (response) => {
    if (chrome.runtime.lastError) {
      sendResponse({ error: 'content_script_not_ready' })
      return
    }
    sendResponse(response ?? {})
  })
}

async function handleOrderSignal(signal: OrderSignal) {
  const tabs = await chrome.tabs.query({ url: 'https://kyfw.12306.cn/*' })
  const tab = tabs.find(t => !t.discarded)
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, signal).catch(() => {})
  } else {
    chrome.tabs.create({ url: 'https://kyfw.12306.cn/otn/leftTicket/init', active: false }, (newTab) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener)
          chrome.tabs.sendMessage(newTab.id!, signal).catch(() => {})
        }
      })
    })
  }
}

let lastKnownLoginState: boolean | null = null
let loginTimer: ReturnType<typeof setTimeout> | null = null

export function startLoginMonitor() {
  const scheduleNext = () => {
    const delay = 6 * 3600_000 // 6 hours
    loginTimer = setTimeout(tick, delay)
  }

  const tick = () => {
    forwardToContentScript({ type: 'CHECK_LOGIN_STATUS' }, (res) => {
      if (!res || res.error || typeof res.loggedIn !== 'boolean') {
        scheduleNext()
        return
      }
      if (res.loggedIn !== lastKnownLoginState) {
        lastKnownLoginState = res.loggedIn
        chrome.runtime.sendMessage({ type: 'LOGIN_STATUS', loggedIn: res.loggedIn }).catch(() => {})
      }
      scheduleNext()
    })
  }

  tick()
}
