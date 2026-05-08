import type { WsMessage, TaskConfig } from './types'

const WS_URL = 'ws://localhost:8000/ws'

export function createWsClient(
  onMessage: (msg: WsMessage) => void,
  onStatusChange: (connected: boolean) => void
) {
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout>

  function connect() {
    ws = new WebSocket(WS_URL)
    ws.onopen = () => {
      onStatusChange(true)
      ws?.send(JSON.stringify({ type: 'HEARTBEAT' }))
    }
    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data) as WsMessage) } catch {}
    }
    ws.onclose = () => {
      onStatusChange(false)
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
    ws?.close()
  }

  return { connect, send, disconnect }
}

export async function createTask(config: TaskConfig, send: (msg: Record<string, unknown>) => void) {
  send({ type: 'CREATE_TASK', ...config })
}

export async function updateTaskStatus(taskId: string, status: string, send: (msg: Record<string, unknown>) => void) {
  send({ type: 'UPDATE_TASK', taskId, status })
}
