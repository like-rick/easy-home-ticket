import type { WsMessage, StationInfo } from './types'

const WS_URL = 'ws://localhost:8000/ws'
const API_BASE = 'http://localhost:8000'

export function createWsClient(
  onMessage: (msg: WsMessage) => void,
  onStatusChange: (connected: boolean) => void
) {
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout>
  let heartbeatTimer: ReturnType<typeof setInterval>
  let heartbeatTimeout: ReturnType<typeof setTimeout>

  function sendHeartbeat() {
    if (ws?.readyState !== WebSocket.OPEN) return
    send({ type: 'HEARTBEAT' })
    clearTimeout(heartbeatTimeout)
    heartbeatTimeout = setTimeout(() => {
      ws?.close()
    }, 5000)
  }

  function startHeartbeat() {
    stopHeartbeat()
    sendHeartbeat()
    heartbeatTimer = setInterval(sendHeartbeat, 10_000)
  }

  function stopHeartbeat() {
    clearInterval(heartbeatTimer)
    clearTimeout(heartbeatTimeout)
  }

  function connect() {
    ws = new WebSocket(WS_URL)
    ws.onopen = () => {
      onStatusChange(true)
      startHeartbeat()
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsMessage
        if (msg.type === 'HEARTBEAT') {
          clearTimeout(heartbeatTimeout)
          onMessage(msg)
          return
        }
        onMessage(msg)
      } catch {}
    }
    ws.onclose = () => {
      onStatusChange(false)
      stopHeartbeat()
      reconnectTimer = setTimeout(connect, 3000)
    }
    ws.onerror = () => ws?.close()
  }

  function send(msg: Record<string, unknown>) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  function disconnect() {
    clearTimeout(reconnectTimer)
    stopHeartbeat()
    ws?.close()
  }

  return { connect, send, disconnect }
}

export async function updateTaskStatus(taskId: string, status: string, send: (msg: Record<string, unknown>) => void) {
  send({ type: 'UPDATE_TASK', taskId, status })
}

export async function fetchStations(q = ''): Promise<StationInfo[]> {
  const url = `${API_BASE}/api/stations?q=${encodeURIComponent(q)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`stations fetch failed: ${res.status}`)
  return res.json()
}
