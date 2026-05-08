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

async function handleOrderSignal(signal: OrderSignal) {
  const [tab] = await chrome.tabs.query({ url: 'https://kyfw.12306.cn/*' })
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
