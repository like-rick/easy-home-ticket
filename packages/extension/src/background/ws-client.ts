import { createWsClient } from '../lib/api'
import type { WsMessage } from '../lib/types'
import { routeMessage } from './state'

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
  if (msg.type === 'SEND_WS' && msg.payload) {
    sendFn?.(msg.payload as Record<string, unknown>)
  }
})
