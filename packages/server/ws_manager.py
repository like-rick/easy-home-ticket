from fastapi import WebSocket
import json
import asyncio

class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, WebSocket] = {}

    async def connect(self, client_id: str, ws: WebSocket):
        await ws.accept()
        self._connections[client_id] = ws

    def disconnect(self, client_id: str):
        self._connections.pop(client_id, None)

    async def send(self, client_id: str, message: dict):
        ws = self._connections.get(client_id)
        if ws:
            try:
                await ws.send_text(json.dumps(message, ensure_ascii=False))
            except Exception:
                self.disconnect(client_id)

    async def broadcast(self, message: dict):
        for cid in list(self._connections.keys()):
            await self.send(cid, message)

    @property
    def connected_ids(self) -> list[str]:
        return list(self._connections.keys())

ws_manager = ConnectionManager()
