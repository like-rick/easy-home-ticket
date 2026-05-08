import { createWsClient } from '../lib/api'
import type { WsMessage } from '../lib/types'
import { routeMessage } from './state'

let sendFn: ((msg: Record<string, unknown>) => void) | null = null

export function startWsClient() {
  const { connect, send } = createWsClient(
    (msg: WsMessage) => routeMessage(msg),
    (connected: boolean) => {
      chrome.runtime.sendMessage({ type: 'WS_STATUS', connected }).catch(() => {})
    }
  )
  sendFn = send
  connect()
}

export function getSendFn() {
  return sendFn
}
