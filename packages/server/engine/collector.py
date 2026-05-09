import random
import httpx
from config import USER_AGENTS

BASE_URL = "https://kyfw.12306.cn"

class TicketCollector:
    def __init__(self):
        self._client = httpx.AsyncClient(
            base_url=BASE_URL,
            headers=self._headers(),
            timeout=10.0,
        )

    @staticmethod
    def _headers() -> dict:
        return {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "application/json",
            "Referer": "https://kyfw.12306.cn/otn/leftTicket/init",
        }

    async def query_tickets(self, from_station: str, to_station: str, date: str,
                            train_no: str | None = None, seat_types: list[str] | None = None,
                            purpose: str = "ADULT") -> list[dict]:
        params = {
            "leftTicketDTO.train_date": date,
            "leftTicketDTO.from_station": from_station,
            "leftTicketDTO.to_station": to_station,
            "purpose_codes": purpose,
        }
        resp = await self._client.get("/otn/leftTicket/queryZ", params=params)
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") != True:
            return []
        raw = data.get("data", {}).get("result", [])
        return [self._parse_ticket(r, seat_types or []) for r in raw if isinstance(r, str)]

    def _parse_ticket(self, raw: str, seat_types: list[str]) -> dict:
        parts = raw.split("|")
        return {
            "train_no": parts[2],
            "from_station": parts[6],
            "to_station": parts[7],
            "depart_time": parts[8],
            "arrive_time": parts[9],
            "duration": parts[10],
            "seats": self._parse_seats(parts, seat_types),
        }

    def _parse_seats(self, parts: list[str], wanted: list[str]) -> dict:
        seat_map = {
            "二等座": 30, "一等座": 31, "商务座": 32,
            "硬卧": 28, "软卧": 23, "硬座": 29,
            "无座": 26,
        }
        result = {}
        for name, idx in seat_map.items():
            if not wanted or name in wanted:
                val = parts[idx] if idx < len(parts) else ""
                result[name] = {"count": val if val else "无", "price": parts[idx + 1] if idx + 1 < len(parts) else "0"}
        return result

    async def query_train_schedule(self, train_no: str, from_station: str,
                                    to_station: str, date: str) -> list[dict]:
        params = {
            "train_no": train_no,
            "from_station_telecode": from_station,
            "to_station_telecode": to_station,
            "depart_date": date,
        }
        resp = await self._client.get("/otn/czxx/queryByTrainNo", params=params)
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") != True:
            return []
        return data.get("data", {}).get("data", [])

    async def close(self):
        await self._client.aclose()
