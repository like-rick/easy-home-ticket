import { createWsClient } from '../lib/api'
import type { WsMessage } from '../lib/types'
import { forwardToContentScript, routeMessage } from './state'

let sendFn: ((msg: Record<string, unknown>) => void) | null = null
let wsConnected = false

export function startWsClient() {
  const { connect, send } = createWsClient(
    (msg: WsMessage) => routeMessage(msg),
    (connected: boolean) => {
      wsConnected = connected
      chrome.runtime.sendMessage({ type: 'WS_STATUS', connected }).catch(() => {})
    }
  )
  sendFn = send
  connect()
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_WS_STATUS') {
    sendResponse({ connected: wsConnected })
  }
  if (msg.type === 'FETCH_PASSENGERS' || msg.type === 'CHECK_LOGIN_STATUS') {
    forwardToContentScript(msg, sendResponse)
    return true
  }
})

export function getSendFn() {
  return sendFn
}
