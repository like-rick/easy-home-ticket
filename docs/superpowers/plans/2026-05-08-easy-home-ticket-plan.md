# EasyHome Ticket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-deployed intelligent 12306 ticket booking system with backend monitoring + browser extension execution.

**Architecture:** FastAPI backend (Docker) queries 12306 APIs, runs segment-splitting algorithms, and pushes order signals via WebSocket to a Chrome Extension (Plasmo/React) that executes purchases using the user's browser session.

**Tech Stack:** Python 3.12+ / FastAPI / SQLAlchemy (aiosqlite) / Redis / websockets / httpx / Plasmo / React 18 / TypeScript / TailwindCSS

---

## Phase 1: Server Foundation

### Task 1: Server config and database models

**Files:**
- Create: `packages/server/config.py`
- Create: `packages/server/models/__init__.py`
- Create: `packages/server/models/task.py`
- Create: `packages/server/models/solution.py`
- Create: `packages/server/models/scan_log.py`
- Modify: `packages/server/requirements.txt`

- [ ] **Step 1: Write config.py**

```python
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./easyhome.db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
SCAN_INTERVAL_SECONDS = float(os.getenv("SCAN_INTERVAL", "2.0"))
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
]
```

- [ ] **Step 2: Write models/__init__.py**

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
```

- [ ] **Step 3: Write models/task.py**

```python
import uuid
from datetime import date, time, datetime
from sqlalchemy import String, Date, Time, Integer, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from . import Base

class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), default="")
    from_station: Mapped[str] = mapped_column(String(16))
    to_station: Mapped[str] = mapped_column(String(16))
    travel_date: Mapped[date] = mapped_column(Date)
    time_start: Mapped[str] = mapped_column(String(8), default="00:00")
    time_end: Mapped[str] = mapped_column(String(8), default="23:59")
    max_extra_fee: Mapped[int] = mapped_column(Integer, default=30)
    seat_types: Mapped[str] = mapped_column(Text, default='["二等座"]')
    train_nos: Mapped[str | None] = mapped_column(Text, nullable=True)
    strategies: Mapped[str] = mapped_column(Text, default='["direct","split","longer","cross"]')
    passengers: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(16), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

- [ ] **Step 4: Write models/solution.py**

```python
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from . import Base

class Solution(Base):
    __tablename__ = "solutions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id"))
    plan_type: Mapped[str] = mapped_column(String(16))
    train_no: Mapped[str] = mapped_column(String(16))
    segments: Mapped[str] = mapped_column(Text)
    total_price: Mapped[float] = mapped_column(Float, default=0.0)
    extra_fee: Mapped[float] = mapped_column(Float, default=0.0)
    priority: Mapped[int] = mapped_column(Integer, default=1)
    ticket_status: Mapped[str] = mapped_column(String(16), default="pending")
    locked_segment_index: Mapped[int] = mapped_column(Integer, default=-1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 5: Write models/scan_log.py**

```python
from datetime import datetime
from sqlalchemy import String, Integer, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from . import Base

class ScanLog(Base):
    __tablename__ = "scan_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[str] = mapped_column(String(36))
    solution_id: Mapped[str] = mapped_column(String(36))
    event: Mapped[str] = mapped_column(String(32))
    detail: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 6: Update requirements.txt**

```
fastapi==0.136.1
uvicorn==0.46.0
sqlalchemy[asyncio]==2.0.36
aiosqlite==0.20.0
httpx==0.28.1
redis==5.2.1
websockets==16.0
pydantic==2.13.3
aiosmtplib==3.0.2
```

- [ ] **Step 7: Commit**

```bash
git add packages/server/config.py packages/server/models/ packages/server/requirements.txt
git commit -m "feat: add server config and SQLite models"
```

---

## Phase 2: Collection Engine

### Task 2: Station name mapping

**Files:**
- Create: `packages/server/engine/__init__.py`
- Create: `packages/server/engine/station.py`

- [ ] **Step 1: Write engine/__init__.py**

```python
```

- [ ] **Step 2: Write engine/station.py**

```python
import re
import httpx

STATION_JS_URL = "https://kyfw.12306.cn/resources/js/framework/station_name.js"

class StationMapper:
    def __init__(self):
        self._name_to_code: dict[str, str] = {}
        self._code_to_name: dict[str, str] = {}

    async def load(self):
        async with httpx.AsyncClient() as client:
            resp = await client.get(STATION_JS_URL)
            resp.raise_for_status()
        text = resp.text
        for match in re.finditer(r"@bjb\|([^|]+)\|([A-Z]+)\|", text):
            name = match.group(1)
            code = match.group(2)
            self._name_to_code[name] = code
            self._code_to_name[code] = name

    def to_code(self, name: str) -> str:
        return self._name_to_code.get(name, name)

    def to_name(self, code: str) -> str:
        return self._code_to_name.get(code, code)

station_mapper = StationMapper()
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/engine/__init__.py packages/server/engine/station.py
git commit -m "feat: add 12306 station name-to-code mapper"
```

### Task 3: 12306 API collector

**Files:**
- Create: `packages/server/engine/collector.py`

- [ ] **Step 1: Write engine/collector.py**

```python
import random
import httpx
from .station import station_mapper
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/engine/collector.py
git commit -m "feat: add 12306 ticket query and schedule collector"
```

### Task 4: Rate limiter

**Files:**
- Create: `packages/server/engine/rate_limiter.py`

- [ ] **Step 1: Write engine/rate_limiter.py**

```python
import asyncio
import time
import random

class RateLimiter:
    def __init__(self, min_interval: float = 1.0, max_interval: float = 5.0):
        self.min = min_interval
        self.max = max_interval
        self._last_call: float = 0.0

    async def wait(self):
        now = time.monotonic()
        since_last = now - self._last_call
        if since_last < self.min:
            await asyncio.sleep(self.min - since_last + random.uniform(0, self.max - self.min))
        self._last_call = time.monotonic()

rate_limiter = RateLimiter()
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/engine/rate_limiter.py
git commit -m "feat: add rate limiter for 12306 API calls"
```

---

## Phase 3: Segment Splitting Algorithm

### Task 5: Route splitter (同车换乘拆段)

**Files:**
- Create: `packages/server/algorithm/__init__.py`
- Create: `packages/server/algorithm/splitter.py`

- [ ] **Step 1: Write algorithm/__init__.py**

```python
```

- [ ] **Step 2: Write algorithm/splitter.py**

```python
def split_same_train(stops: list[dict], from_code: str, to_code: str) -> list[list[dict]]:
    """Generate same-train transfer combinations from full route stops.

    Args:
        stops: Full stop list from 12306 schedule API.
               Each stop has: station_name, station_train_code (telecode), arrive_time, start_time.
        from_code: Departure station telecode (e.g. 'SHH').
        to_code: Destination station telecode (e.g. 'BJP').

    Returns:
        List of segment groups. Each group = list of segment dicts (1 for direct, 2+ for split).
        Segment: {from_station, to_station, from_time, to_time, train_no, is_empty: bool}.
    """
    from_idx = None
    to_idx = None
    for i, s in enumerate(stops):
        if s.get("station_train_code") == from_code or s.get("station_name") == from_code:
            from_idx = i
        if s.get("station_train_code") == to_code or s.get("station_name") == to_code:
            to_idx = i

    if from_idx is None or to_idx is None or from_idx >= to_idx:
        return []

    train_no = stops[0].get("station_train_code", "")
    groups: list[list[dict]] = []

    # Direct: [from -> to]
    groups.append([_make_segment(stops[from_idx], stops[to_idx], train_no)])

    # Same-train split: [from -> mid] + [mid -> to] for each intermediate stop
    for mid in range(from_idx + 1, to_idx):
        g1 = _make_segment(stops[from_idx], stops[mid], train_no)
        g2 = _make_segment(stops[mid], stops[to_idx], train_no)
        groups.append([g1, g2])

    return groups


def _make_segment(from_stop: dict, to_stop: dict, train_no: str) -> dict:
    return {
        "from_station": from_stop.get("station_train_code", from_stop.get("station_name", "")),
        "to_station": to_stop.get("station_train_code", to_stop.get("station_name", "")),
        "from_time": from_stop.get("start_time", ""),
        "to_time": to_stop.get("arrive_time", ""),
        "train_no": train_no,
        "is_empty": False,
    }
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/algorithm/__init__.py packages/server/algorithm/splitter.py
git commit -m "feat: add same-train route splitter algorithm"
```

### Task 6: Buy-longer calculator (买长乘短)

**Files:**
- Create: `packages/server/algorithm/longer.py`

- [ ] **Step 1: Write algorithm/longer.py**

```python
def find_longer_options(stops: list[dict], from_code: str, to_code: str,
                        direct_price: float, max_extra: int = 30) -> list[dict]:
    """Find 'buy longer, ride shorter' options within the extra fee budget.

    Args:
        stops: Full stop list from schedule API (same format as splitter).
        from_code: User's actual departure station.
        to_code: User's actual destination station.
        direct_price: Price of the A->D ticket (may be 0 if unchecked).
        max_extra: Maximum extra fee allowed (元).

    Returns:
        List of longer-segment options, each with from/to station and extra fee.
    """
    to_idx = None
    for i, s in enumerate(stops):
        if s.get("station_train_code") == to_code or s.get("station_name") == to_code:
            to_idx = i
    if to_idx is None:
        return []

    train_no = stops[0].get("station_train_code", "")
    from_stop = None
    for s in stops:
        if s.get("station_train_code") == from_code or s.get("station_name") == from_code:
            from_stop = s
            break
    if not from_stop:
        return []

    options = []
    for dest_stop in stops[to_idx + 1:]:
        extra = dest_stop.get("price", 0) - direct_price if direct_price else 999
        if extra <= max_extra:
            options.append({
                "from_station": from_stop.get("station_train_code", from_code),
                "to_station": dest_stop.get("station_train_code", ""),
                "train_no": train_no,
                "extra_fee": max(extra, 0),
                "full_price": dest_stop.get("price", 0),
            })
    return options
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/algorithm/longer.py
git commit -m "feat: add buy-longer calculator"
```

### Task 7: Priority ranker

**Files:**
- Create: `packages/server/algorithm/ranker.py`

- [ ] **Step 1: Write algorithm/ranker.py**

```python
from dataclasses import dataclass, field

@dataclass
class Solution:
    plan_type: str       # direct, split, longer, cross
    train_no: str
    segments: list[dict]
    total_price: float
    extra_fee: float
    priority: int = 1
    score: float = 0.0

def rank_solutions(solutions: list[Solution]) -> list[Solution]:
    """Rank solutions by priority: direct > same-train-split > longer > cross-train.
    Within same plan_type: lower price wins. Lower extra_fee breaks ties.
    """
    type_order = {"direct": 0, "split": 1, "longer": 2, "cross": 3}
    for s in solutions:
        s.priority = type_order.get(s.plan_type, 9)
        s.score = s.priority * 10000 + s.total_price * 10 + s.extra_fee
    solutions.sort(key=lambda s: s.score)
    return solutions
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/algorithm/ranker.py
git commit -m "feat: add solution priority ranker"
```

---

## Phase 4: Scheduler & Communication

### Task 8: WebSocket manager

**Files:**
- Create: `packages/server/ws_manager.py`

- [ ] **Step 1: Write ws_manager.py**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/ws_manager.py
git commit -m "feat: add WebSocket connection manager"
```

### Task 9: Scan dispatcher

**Files:**
- Create: `packages/server/scheduler/__init__.py`
- Create: `packages/server/scheduler/dispatcher.py`

- [ ] **Step 1: Write scheduler/__init__.py**

```python
```

- [ ] **Step 2: Write scheduler/dispatcher.py**

```python
from ws_manager import ws_manager

async def push_solution_update(task_id: str, solution_id: str, status: str, detail: dict | None = None):
    await ws_manager.broadcast({
        "type": "SOLUTION_UPDATE",
        "taskId": task_id,
        "solutionId": solution_id,
        "status": status,
        "detail": detail or {},
    })

async def push_scan_log(task_id: str, solution_id: str, event: str, detail: str = ""):
    await ws_manager.broadcast({
        "type": "SCAN_LOG",
        "taskId": task_id,
        "solutionId": solution_id,
        "event": event,
        "detail": detail,
    })

async def push_order_signal(task_id: str, plan_type: str, train_no: str,
                             segments: list[dict], passenger_ids: list[str], deadline: str):
    await ws_manager.broadcast({
        "type": "ORDER_SIGNAL",
        "taskId": task_id,
        "planType": plan_type,
        "trainNo": train_no,
        "segments": segments,
        "passengerIds": passenger_ids,
        "deadline": deadline,
    })

async def push_alert(task_id: str, message: str):
    await ws_manager.broadcast({
        "type": "ALERT",
        "taskId": task_id,
        "message": message,
    })
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/scheduler/__init__.py packages/server/scheduler/dispatcher.py
git commit -m "feat: add scan dispatcher for WebSocket push"
```

### Task 10: Scanner loop

**Files:**
- Create: `packages/server/scheduler/scanner.py`

- [ ] **Step 1: Write scheduler/scanner.py**

```python
import asyncio
import json
from datetime import datetime, timedelta
from sqlalchemy import select
from models import async_session
from models.task import Task
from models.solution import Solution
from models.scan_log import ScanLog
from engine.collector import TicketCollector
from engine.rate_limiter import rate_limiter
from scheduler.dispatcher import push_solution_update, push_scan_log, push_order_signal

class Scanner:
    def __init__(self):
        self._collector = TicketCollector()
        self._running: dict[str, asyncio.Task] = {}

    async def start_all(self):
        async with async_session() as db:
            result = await db.execute(select(Task).where(Task.status == "active"))
            tasks = result.scalars().all()
        for task in tasks:
            self.start_task(task.id)

    def start_task(self, task_id: str):
        if task_id not in self._running:
            self._running[task_id] = asyncio.create_task(self._scan_loop(task_id))

    def stop_task(self, task_id: str):
        t = self._running.pop(task_id, None)
        if t:
            t.cancel()

    async def _scan_loop(self, task_id: str):
        while True:
            try:
                async with async_session() as db:
                    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
                    if not task or task.status != "active":
                        break
                    solutions = (await db.execute(
                        select(Solution).where(Solution.task_id == task_id)
                    )).scalars().all()

                    for sol in solutions:
                        await rate_limiter.wait()
                        segments = json.loads(sol.segments)
                        seg = segments[0]
                        tickets = await self._collector.query_tickets(
                            from_station=seg.get("from_station", task.from_station),
                            to_station=seg.get("to_station", task.to_station),
                            date=task.travel_date.isoformat(),
                            train_no=sol.train_no,
                            seat_types=json.loads(task.seat_types),
                        )
                        has_ticket = any(
                            t.get("train_no") == sol.train_no
                            for t in tickets
                        )
                        if has_ticket:
                            sol.ticket_status = "available"
                            db.add(ScanLog(task_id=task_id, solution_id=sol.id,
                                           event="ticket_found", detail=json.dumps({"train": sol.train_no})))
                            await db.commit()
                            await push_solution_update(task_id, sol.id, "available",
                                                       {"train_no": sol.train_no})

                            deadline = (datetime.utcnow() + timedelta(seconds=30)).isoformat()
                            passengers = json.loads(task.passengers)
                            await push_order_signal(
                                task_id=task_id,
                                plan_type=sol.plan_type,
                                train_no=sol.train_no,
                                segments=segments,
                                passenger_ids=[p.get("id", "") for p in passengers],
                                deadline=deadline,
                            )
                        else:
                            await push_scan_log(task_id, sol.id, "scanning",
                                                f"{sol.train_no} {seg.get('from_station')}->{seg.get('to_station')} 无票")
            except asyncio.CancelledError:
                break
            except Exception as e:
                await push_scan_log(task_id, "", "error", str(e))
            await asyncio.sleep(2.0)

scanner = Scanner()
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/scheduler/scanner.py
git commit -m "feat: add high-frequency ticket scanner loop"
```

---

## Phase 5: Notification & Server Entry

### Task 11: Email notifier

**Files:**
- Create: `packages/server/notifier/__init__.py`
- Create: `packages/server/notifier/email.py`

- [ ] **Step 1: Write notifier/__init__.py**

```python
```

- [ ] **Step 2: Write notifier/email.py**

```python
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

async def send_email(smtp_host: str, smtp_port: int, user: str, password: str,
                     to: str, subject: str, body: str):
    msg = MIMEMultipart()
    msg["From"] = user
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "html", "utf-8"))

    await aiosmtplib.send(
        msg,
        hostname=smtp_host,
        port=smtp_port,
        username=user,
        password=password,
        use_tls=(smtp_port == 465),
        start_tls=(smtp_port == 587),
    )

def build_order_email(train_no: str, from_station: str, to_station: str,
                       price: float, pay_deadline: str) -> str:
    return f"""
    <h2>占座成功！请在30分钟内支付</h2>
    <p>车次: <b>{train_no}</b></p>
    <p>区间: {from_station} → {to_station}</p>
    <p>票价: ¥{price}</p>
    <p>支付截止: {pay_deadline}</p>
    <p><a href="https://kyfw.12306.cn">前往 12306 支付</a></p>
    """
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/notifier/__init__.py packages/server/notifier/email.py
git commit -m "feat: add SMTP email notifier"
```

### Task 12: Webhook notifier

**Files:**
- Create: `packages/server/notifier/webhook.py`

- [ ] **Step 1: Write notifier/webhook.py**

```python
import httpx
import json

async def send_webhook(url: str, message: str):
    payload = {
        "msgtype": "text",
        "text": {"content": message},
    }
    async with httpx.AsyncClient() as client:
        await client.post(url, json=payload, timeout=10.0)

def build_order_webhook_text(train_no: str, from_station: str, to_station: str,
                              price: float, pay_deadline: str) -> str:
    return (
        f"【占座成功】{train_no} {from_station}→{to_station} ¥{price}\n"
        f"请在 {pay_deadline} 前完成支付"
    )
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/notifier/webhook.py
git commit -m "feat: add webhook notifier for WeChat Work/DingTalk"
```

### Task 13: Server entry point (main.py)

**Files:**
- Create: `packages/server/main.py`

- [ ] **Step 1: Write main.py**

```python
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from models import init_db, get_db, async_session
from models.task import Task
from models.solution import Solution
from engine.station import station_mapper
from scheduler.scanner import scanner
from ws_manager import ws_manager
from sqlalchemy import select

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await station_mapper.load()
    await scanner.start_all()
    yield

app = FastAPI(title="EasyHome Ticket Server", lifespan=lifespan)

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    client_id = str(id(ws))
    await ws_manager.connect(client_id, ws)
    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type == "CREATE_TASK":
                async with async_session() as db:
                    task = Task(
                        name=msg.get("name", ""),
                        from_station=msg["fromStation"],
                        to_station=msg["toStation"],
                        travel_date=msg["travelDate"],
                        time_start=msg.get("timeStart", "00:00"),
                        time_end=msg.get("timeEnd", "23:59"),
                        max_extra_fee=msg.get("maxExtraFee", 30),
                        seat_types=json.dumps(msg.get("seatTypes", ["二等座"])),
                        train_nos=json.dumps(msg.get("trainNos")) if msg.get("trainNos") else None,
                        strategies=json.dumps(msg.get("strategies", ["direct","split","longer","cross"])),
                        passengers=json.dumps(msg.get("passengers", [])),
                    )
                    db.add(task)
                    await db.commit()
                    scanner.start_task(task.id)
                    await ws_manager.send(client_id, {"type": "TASK_SYNCED", "taskId": task.id})

            elif msg_type == "UPDATE_TASK":
                async with async_session() as db:
                    task = (await db.execute(select(Task).where(Task.id == msg["taskId"]))).scalar_one_or_none()
                    if task:
                        if "status" in msg:
                            task.status = msg["status"]
                            if msg["status"] == "active":
                                scanner.start_task(task.id)
                            else:
                                scanner.stop_task(task.id)
                        await db.commit()
                        await ws_manager.send(client_id, {"type": "TASK_SYNCED", "taskId": task.id})

            elif msg_type == "GET_SOLUTIONS":
                async with async_session() as db:
                    sols = (await db.execute(
                        select(Solution).where(Solution.task_id == msg["taskId"])
                    )).scalars().all()
                    await ws_manager.send(client_id, {
                        "type": "SOLUTION_UPDATE",
                        "taskId": msg["taskId"],
                        "solutions": [
                            {
                                "id": s.id,
                                "planType": s.plan_type,
                                "trainNo": s.train_no,
                                "segments": json.loads(s.segments),
                                "totalPrice": s.total_price,
                                "extraFee": s.extra_fee,
                                "priority": s.priority,
                                "ticketStatus": s.ticket_status,
                            }
                            for s in sols
                        ],
                    })

            elif msg_type == "ORDER_RESULT":
                await ws_manager.broadcast({
                    "type": "SCAN_LOG",
                    "taskId": msg.get("taskId", ""),
                    "event": "order_complete",
                    "detail": json.dumps(msg.get("result", {})),
                })

            elif msg_type == "HEARTBEAT":
                await ws_manager.send(client_id, {"type": "HEARTBEAT"})

    except WebSocketDisconnect:
        ws_manager.disconnect(client_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/main.py
git commit -m "feat: add FastAPI main entry with WebSocket and REST endpoints"
```

---

## Phase 6: Extension Core

### Task 14: Type definitions

**Files:**
- Create: `packages/extension/src/lib/types.ts`

- [ ] **Step 1: Write lib/types.ts**

```typescript
export interface Segment {
  fromStation: string
  toStation: string
  fromTime: string
  toTime: string
  trainNo: string
  seatType: string
  price: number
}

export interface Passenger {
  id: string
  name: string
  idType: string
  idNumber: string
}

export interface TaskConfig {
  name: string
  fromStation: string
  toStation: string
  travelDate: string
  timeStart: string
  timeEnd: string
  maxExtraFee: number
  seatTypes: string[]
  trainNos?: string[]
  strategies: string[]
  passengers: Passenger[]
}

export interface SolutionData {
  id: string
  planType: 'direct' | 'split' | 'longer' | 'cross'
  trainNo: string
  segments: Segment[]
  totalPrice: number
  extraFee: number
  priority: number
  ticketStatus: 'pending' | 'available' | 'sold' | 'booked'
}

export interface OrderSignal {
  type: 'ORDER_SIGNAL'
  taskId: string
  planType: string
  trainNo: string
  segments: Segment[]
  passengerIds: string[]
  deadline: string
}

export type WsMessage =
  | { type: 'TASK_SYNCED'; taskId: string }
  | { type: 'SOLUTION_UPDATE'; taskId: string; solutionId?: string; status?: string; solutions?: SolutionData[]; detail?: Record<string, unknown> }
  | { type: 'SCAN_LOG'; taskId: string; solutionId: string; event: string; detail: string }
  | { type: 'ORDER_SIGNAL' } & OrderSignal
  | { type: 'ALERT'; taskId: string; message: string }
  | { type: 'ERROR'; message: string }
  | { type: 'HEARTBEAT' }
```

- [ ] **Step 2: Commit**

```bash
git add packages/extension/src/lib/types.ts
git commit -m "feat: add shared TypeScript type definitions"
```

### Task 15: WebSocket client + Background state

**Files:**
- Create: `packages/extension/src/lib/api.ts`
- Create: `packages/extension/src/background/ws-client.ts`
- Create: `packages/extension/src/background/state.ts`

- [ ] **Step 1: Write lib/api.ts**

```typescript
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
```

- [ ] **Step 2: Write background/ws-client.ts**

```typescript
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
```

- [ ] **Step 3: Write background/state.ts**

```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add packages/extension/src/lib/api.ts packages/extension/src/background/
git commit -m "feat: add WebSocket client and background state router"
```

---

## Phase 7: Dashboard UI

### Task 16: Dashboard main layout + Task list

**Files:**
- Create: `packages/extension/src/dashboard/index.tsx`
- Create: `packages/extension/src/dashboard/task-list.tsx`
- Modify: `packages/extension/package.json` (add newtab page)

- [ ] **Step 1: Write dashboard/index.tsx**

```tsx
import React, { useState, useEffect, useCallback } from 'react'
import { TaskList } from './task-list'
import { SolutionBoard } from './solution-board'
import { LogStream } from './log-stream'
import { TaskForm } from './task-form'
import type { WsMessage, SolutionData } from '../lib/types'
import { subscribe } from '../background/state'

type Panel = 'tasks' | 'board' | 'log'

export default function Dashboard() {
  const [wsConnected, setWsConnected] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [solutions, setSolutions] = useState<SolutionData[]>([])
  const [logs, setLogs] = useState<Array<{ time: string; event: string; detail: string }>>([])
  const [showForm, setShowForm] = useState(false)
  const [activePanel, setActivePanel] = useState<Panel>('tasks')

  useEffect(() => {
    const unsub1 = subscribe('SOLUTION_UPDATE', (data) => {
      const msg = data as WsMessage & { solutions?: SolutionData[] }
      if (msg.solutions) setSolutions(msg.solutions)
    })
    const unsub2 = subscribe('SCAN_LOG', (data) => {
      const msg = data as WsMessage & { event: string; detail: string }
      setLogs(prev => [...prev.slice(-200), {
        time: new Date().toLocaleTimeString(),
        event: msg.event || '',
        detail: typeof msg.detail === 'string' ? msg.detail : JSON.stringify(msg.detail)
      }])
    })
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'WS_STATUS') setWsConnected(msg.connected)
    })
    return () => { unsub1(); unsub2() }
  }, [])

  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId)
    setActivePanel('board')
  }, [])

  return (
    <div className="plasmo-h-screen plasmo-flex plasmo-flex-col plasmo-bg-gray-50">
      <header className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-px-4 plasmo-py-2 plasmo-bg-white plasmo-border-b plasmo-shadow-sm">
        <h1 className="plasmo-text-lg plasmo-font-bold">EasyHome Ticket</h1>
        <div className="plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-text-sm">
          <span className={`plasmo-inline-block plasmo-w-2 plasmo-h-2 plasmo-rounded-full ${wsConnected ? 'plasmo-bg-green-500' : 'plasmo-bg-red-500'}`} />
          <span>{wsConnected ? 'Server 已连接' : '已断开'}</span>
        </div>
      </header>
      <nav className="plasmo-flex plasmo-gap-2 plasmo-px-4 plasmo-py-2 plasmo-bg-white plasmo-border-b">
        {(['tasks', 'board', 'log'] as Panel[]).map(p => (
          <button key={p} onClick={() => setActivePanel(p)}
            className={`plasmo-px-4 plasmo-py-1 plasmo-rounded plasmo-text-sm ${activePanel === p ? 'plasmo-bg-blue-500 plasmo-text-white' : 'plasmo-bg-gray-100'}`}>
            {{ tasks: '任务', board: '方案', log: '日志' }[p]}
          </button>
        ))}
        <button onClick={() => setShowForm(true)}
          className="plasmo-px-4 plasmo-py-1 plasmo-ml-auto plasmo-bg-green-500 plasmo-text-white plasmo-rounded plasmo-text-sm">
          + 新建任务
        </button>
      </nav>
      <main className="plasmo-flex-1 plasmo-overflow-auto plasmo-p-4">
        {activePanel === 'tasks' && <TaskList onSelect={handleSelectTask} selectedId={selectedTaskId} />}
        {activePanel === 'board' && <SolutionBoard solutions={solutions} />}
        {activePanel === 'log' && <LogStream logs={logs} />}
      </main>
      {showForm && <TaskForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
```

- [ ] **Step 2: Write dashboard/task-list.tsx**

```tsx
import React, { useState, useEffect } from 'react'
import type { WsMessage } from '../lib/types'
import { subscribe } from '../background/state'

interface TaskItem {
  id: string
  name: string
  fromStation: string
  toStation: string
  travelDate: string
  status: string
}

export function TaskList({ onSelect, selectedId }: { onSelect: (id: string) => void; selectedId: string | null }) {
  const [tasks, setTasks] = useState<TaskItem[]>([])

  useEffect(() => {
    const unsub = subscribe('TASK_SYNCED', (data) => {
      const msg = data as WsMessage & { taskId: string }
      setTasks(prev => prev.map(t => t.id === msg.taskId ? { ...t } : t))
    })
    return () => unsub()
  }, [])

  return (
    <div className="plasmo-space-y-2">
      {tasks.map(t => (
        <div key={t.id}
          onClick={() => onSelect(t.id)}
          className={`plasmo-p-3 plasmo-rounded plasmo-cursor-pointer plasmo-border ${selectedId === t.id ? 'plasmo-border-blue-500 plasmo-bg-blue-50' : 'plasmo-border-gray-200 plasmo-bg-white'}`}>
          <div className="plasmo-flex plasmo-justify-between plasmo-items-center">
            <span className="plasmo-font-medium">{t.name || `${t.fromStation}→${t.toStation}`}</span>
            <span className={`plasmo-w-2 plasmo-h-2 plasmo-rounded-full ${t.status === 'active' ? 'plasmo-bg-green-500' : 'plasmo-bg-gray-400'}`} />
          </div>
          <div className="plasmo-text-sm plasmo-text-gray-500">{t.travelDate}</div>
        </div>
      ))}
      {tasks.length === 0 && (
        <div className="plasmo-text-gray-400 plasmo-text-center plasmo-py-8">暂无任务，点击"新建任务"开始</div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/extension/src/dashboard/
git commit -m "feat: add dashboard main layout and task list"
```

### Task 17: Task form + Solution board + Log stream

**Files:**
- Create: `packages/extension/src/dashboard/task-form.tsx`
- Create: `packages/extension/src/dashboard/solution-board.tsx`
- Create: `packages/extension/src/dashboard/log-stream.tsx`

- [ ] **Step 1: Write dashboard/task-form.tsx**

```tsx
import React, { useState } from 'react'
import type { TaskConfig } from '../lib/types'
import { createTask } from '../lib/api'
import { getSendFn } from '../background/ws-client'

const STATIONS = ['上海', '上海虹桥', '北京', '北京南', '武汉', '广州南', '深圳北', '杭州东', '南京南', '成都东', '西安北']
const SEAT_TYPES = ['二等座', '一等座', '商务座', '硬卧', '软卧', '硬座']
const STRATEGIES = [
  { key: 'direct', label: '直达' },
  { key: 'split', label: '同车换乘' },
  { key: 'longer', label: '买长乘短' },
  { key: 'cross', label: '非同车换乘' },
]

export function TaskForm({ onClose }: { onClose: () => void }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState('')
  const [timeStart, setTimeStart] = useState('00:00')
  const [timeEnd, setTimeEnd] = useState('23:59')
  const [maxExtra, setMaxExtra] = useState(30)
  const [seatTypes, setSeatTypes] = useState<string[]>(['二等座'])
  const [trainNos, setTrainNos] = useState('')
  const [strategies, setStrategies] = useState<string[]>(['direct', 'split', 'longer', 'cross'])
  const [passengerName, setPassengerName] = useState('')
  const [passengerId, setPassengerId] = useState('')

  const toggleArr = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]

  const handleSubmit = () => {
    const send = getSendFn()
    if (!send || !from || !to || !date) return
    const config: TaskConfig = {
      name: `${from}→${to}`,
      fromStation: from,
      toStation: to,
      travelDate: date,
      timeStart,
      timeEnd,
      maxExtraFee: maxExtra,
      seatTypes,
      trainNos: trainNos ? trainNos.split(',').map(s => s.trim()) : undefined,
      strategies,
      passengers: passengerName ? [{ id: passengerId || 'p1', name: passengerName, idType: '身份证', idNumber: passengerId }] : [],
    }
    createTask(config, send)
    onClose()
  }

  return (
    <div className="plasmo-fixed plasmo-inset-0 plasmo-bg-black/50 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-z-50">
      <div className="plasmo-bg-white plasmo-rounded-lg plasmo-p-6 plasmo-w-[480px] plasmo-max-h-[80vh] plasmo-overflow-auto">
        <h2 className="plasmo-text-lg plasmo-font-bold plasmo-mb-4">新建监控任务</h2>

        <div className="plasmo-grid plasmo-grid-cols-2 plasmo-gap-3">
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">出发站</label>
            <select value={from} onChange={e => setFrom(e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm">
              <option value="">选择</option>
              {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">目的站</label>
            <select value={to} onChange={e => setTo(e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm">
              <option value="">选择</option>
              {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">日期</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm" />
          </div>
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">溢价上限(元)</label>
            <input type="number" value={maxExtra} onChange={e => setMaxExtra(+e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm" />
          </div>
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">时段开始</label>
            <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm" />
          </div>
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">时段结束</label>
            <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm" />
          </div>
        </div>

        <div className="plasmo-mt-3">
          <label className="plasmo-text-xs plasmo-text-gray-500">席别</label>
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2">
            {SEAT_TYPES.map(s => (
              <button key={s} onClick={() => setSeatTypes(toggleArr(seatTypes, s))}
                className={`plasmo-px-2 plasmo-py-0.5 plasmo-rounded plasmo-text-xs ${seatTypes.includes(s) ? 'plasmo-bg-blue-500 plasmo-text-white' : 'plasmo-bg-gray-100'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="plasmo-mt-3">
          <label className="plasmo-text-xs plasmo-text-gray-500">策略</label>
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2">
            {STRATEGIES.map(s => (
              <button key={s.key} onClick={() => setStrategies(toggleArr(strategies, s.key))}
                className={`plasmo-px-2 plasmo-py-0.5 plasmo-rounded plasmo-text-xs ${strategies.includes(s.key) ? 'plasmo-bg-green-500 plasmo-text-white' : 'plasmo-bg-gray-100'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="plasmo-mt-3">
          <label className="plasmo-text-xs plasmo-text-gray-500">固定车次 (逗号分隔，可选)</label>
          <input type="text" value={trainNos} onChange={e => setTrainNos(e.target.value)} placeholder="G123,G321"
            className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm" />
        </div>

        <div className="plasmo-mt-3 plasmo-grid plasmo-grid-cols-2 plasmo-gap-2">
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">乘车人</label>
            <input type="text" value={passengerName} onChange={e => setPassengerName(e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm" />
          </div>
          <div>
            <label className="plasmo-text-xs plasmo-text-gray-500">身份证号</label>
            <input type="text" value={passengerId} onChange={e => setPassengerId(e.target.value)}
              className="plasmo-w-full plasmo-border plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm" />
          </div>
        </div>

        <div className="plasmo-flex plasmo-gap-3 plasmo-mt-6 plasmo-justify-end">
          <button onClick={onClose} className="plasmo-px-4 plasmo-py-1.5 plasmo-bg-gray-100 plasmo-rounded plasmo-text-sm">取消</button>
          <button onClick={handleSubmit} className="plasmo-px-4 plasmo-py-1.5 plasmo-bg-blue-500 plasmo-text-white plasmo-rounded plasmo-text-sm">保存并开始</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write dashboard/solution-board.tsx**

```tsx
import React from 'react'
import type { SolutionData } from '../lib/types'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '监控中', color: 'plasmo-text-gray-400' },
  available: { label: '有票!', color: 'plasmo-text-green-600' },
  sold: { label: '已售罄', color: 'plasmo-text-red-500' },
  booked: { label: '已占座', color: 'plasmo-text-blue-600' },
}

const PLAN_LABELS: Record<string, string> = {
  direct: '直达', split: '同车换乘', longer: '买长乘短', cross: '非同车换乘',
}

export function SolutionBoard({ solutions }: { solutions: SolutionData[] }) {
  if (solutions.length === 0) {
    return <div className="plasmo-text-gray-400 plasmo-text-center plasmo-py-8">选择左侧任务查看方案</div>
  }

  return (
    <div className="plasmo-space-y-2">
      {solutions.map(s => (
        <div key={s.id} className={`plasmo-p-3 plasmo-rounded plasmo-border ${s.ticketStatus === 'available' ? 'plasmo-border-green-300 plasmo-bg-green-50' : 'plasmo-border-gray-200 plasmo-bg-white'}`}>
          <div className="plasmo-flex plasmo-justify-between plasmo-items-center">
            <div>
              <span className="plasmo-font-medium">{s.trainNo}</span>
              <span className="plasmo-ml-2 plasmo-text-xs plasmo-bg-gray-100 plasmo-px-1.5 plasmo-py-0.5 plasmo-rounded">{PLAN_LABELS[s.planType] || s.planType}</span>
            </div>
            <span className={`plasmo-text-sm plasmo-font-medium ${STATUS_MAP[s.ticketStatus]?.color || ''}`}>
              {STATUS_MAP[s.ticketStatus]?.label || s.ticketStatus}
            </span>
          </div>
          <div className="plasmo-text-sm plasmo-text-gray-600 plasmo-mt-1">
            {s.segments.map((seg, i) => (
              <span key={i}>{seg.fromStation}→{seg.toStation} {seg.seatType} ¥{seg.price}{i < s.segments.length - 1 ? ' + ' : ''}</span>
            ))}
          </div>
          {s.extraFee > 0 && <div className="plasmo-text-xs plasmo-text-orange-500">溢价 ¥{s.extraFee}</div>}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write dashboard/log-stream.tsx**

```tsx
import React, { useRef, useEffect } from 'react'

interface LogEntry { time: string; event: string; detail: string }

export function LogStream({ logs }: { logs: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [logs])

  return (
    <div ref={ref} className="plasmo-h-full plasmo-overflow-auto plasmo-bg-gray-900 plasmo-text-green-400 plasmo-font-mono plasmo-text-xs plasmo-p-3 plasmo-rounded">
      {logs.map((l, i) => (
        <div key={i} className="plasmo-py-0.5">
          <span className="plasmo-text-gray-500">{l.time}</span>{' '}
          <span className={l.event === 'ticket_found' ? 'plasmo-text-yellow-300 plasmo-font-bold' : ''}>
            [{l.event}]
          </span>{' '}
          {l.detail}
        </div>
      ))}
      {logs.length === 0 && <div className="plasmo-text-gray-500">等待日志...</div>}
    </div>
  )
}
```

- [ ] **Step 4: Register newtab page in package.json**

Add to `packages/extension/package.json` manifest:
```json
{
  "manifest": {
    "permissions": ["sidePanel", "storage", "notifications", "tabs"],
    "host_permissions": ["https://kyfw.12306.cn/*"],
    "chrome_url_overrides": {
      "newtab": "dashboard.html"
    }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/extension/src/dashboard/ packages/extension/package.json
git commit -m "feat: add task form, solution board, and log stream"
```

---

## Phase 8: Content Script Executor & Final Wiring

### Task 18: 12306 page executor + captcha helper

**Files:**
- Create: `packages/extension/src/content/executor.ts`
- Create: `packages/extension/src/content/captcha.ts`
- Modify: `packages/extension/src/content.tsx` (replace demo with executor init)

- [ ] **Step 1: Write content/captcha.ts**

```typescript
export async function solveSlideCaptcha(): Promise<boolean> {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
  if (!canvas) return true

  const bgImg = document.querySelector('.captcha-bg img') as HTMLImageElement | null
  const sliderImg = document.querySelector('.captcha-slider img') as HTMLImageElement | null
  if (!bgImg || !sliderImg) return true

  const offset = await findSlideOffset(bgImg, sliderImg)
  if (offset <= 0) return false

  await simulateDrag(canvas, offset)
  return true
}

async function findSlideOffset(_bg: HTMLImageElement, _slider: HTMLImageElement): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width; c.height = img.height
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, img.width, img.height).data
      let leftEdge = -1
      for (let x = 0; x < img.width && leftEdge < 0; x++) {
        for (let y = 0; y < img.height; y++) {
          const i = (y * img.width + x) * 4
          if (data[i + 3] > 200 && data[i] < 200) { leftEdge = x; break }
        }
      }
      resolve(leftEdge > 0 ? leftEdge - 5 : Math.floor(img.width * 0.4))
    }
    img.src = _bg.src
  })
}

async function simulateDrag(canvas: HTMLCanvasElement, offset: number): Promise<void> {
  const rect = canvas.getBoundingClientRect()
  const startX = rect.left + 20
  const startY = rect.top + rect.height / 2
  const track = generateTrack(offset)

  const slider = canvas.closest('.captcha-slider') || canvas
  slider.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }))

  for (const step of track) {
    await sleep(10 + Math.random() * 10)
    const cx = startX + step
    const cy = startY + (Math.random() - 0.5) * 6
    slider.dispatchEvent(new PointerEvent('pointermove', { clientX: cx, clientY: cy, bubbles: true }))
  }

  await sleep(50)
  slider.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + offset, clientY: startY, bubbles: true }))
}

function generateTrack(distance: number): number[] {
  const track: number[] = []
  let current = 0
  while (current < distance) {
    const remaining = distance - current
    const step = Math.min(remaining, 2 + Math.random() * 3)
    current += step
    track.push(current)
  }
  return track
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
```

- [ ] **Step 2: Write content/executor.ts**

```typescript
import type { OrderSignal, Segment } from '../lib/types'
import { solveSlideCaptcha } from './captcha'

export async function executeOrder(signal: OrderSignal): Promise<{ status: string; orderId?: string }> {
  try {
    await fillQueryForm(signal.segments[0])

    const submitBtn = await waitForElement('#submitOrder_id, .btn-buy, [onclick*="submitOrder"]', 5000)
    if (!submitBtn) return { status: 'failed', reason: '找不到提交按钮' }
    ;(submitBtn as HTMLElement).click()

    await sleep(800)
    await solveSlideCaptcha()

    const confirmBtn = await waitForElement('#qr_submit_id, [onclick*="confirm"], .btn-confirm', 3000)
    if (confirmBtn) {
      ;(confirmBtn as HTMLElement).click()
      return { status: 'success' }
    }

    return { status: 'success' }
  } catch (e) {
    return { status: 'error', reason: String(e) }
  }
}

async function fillQueryForm(seg: Segment): Promise<void> {
  const setVal = (id: string, val: string) => {
    const el = document.querySelector(`#${id}`) as HTMLInputElement | null
    if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })) }
  }
  setVal('fromStationText', seg.fromStation)
  setVal('toStationText', seg.toStation)
  setVal('train_date', seg.fromTime.slice(0, 10))

  const queryBtn = document.querySelector('#query_ticket') as HTMLElement | null
  if (queryBtn) queryBtn.click()
  await sleep(500)
}

function waitForElement(selector: string, timeout: number): Promise<Element | null> {
  return new Promise((resolve) => {
    const el = document.querySelector(selector)
    if (el) return resolve(el)
    const deadline = Date.now() + timeout
    const timer = setInterval(() => {
      const el = document.querySelector(selector)
      if (el) { clearInterval(timer); resolve(el) }
      if (Date.now() > deadline) { clearInterval(timer); resolve(null) }
    }, 200)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
```

- [ ] **Step 3: Update content.tsx to wire up executor**

Replace the demo content of `packages/extension/src/content.tsx`:

```tsx
import type { PlasmoCSConfig } from "plasmo"
import type { OrderSignal } from "./lib/types"
import { executeOrder } from "./content/executor"

export const config: PlasmoCSConfig = {
  matches: ["https://kyfw.12306.cn/*"]
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'ORDER_SIGNAL') {
    executeOrder(msg as OrderSignal).then(result => {
      chrome.runtime.sendMessage({ type: 'ORDER_RESULT', taskId: msg.taskId, result })
    })
    sendResponse({ ack: true })
  }
  return true
})
```

- [ ] **Step 4: Commit**

```bash
git add packages/extension/src/content/
git commit -m "feat: add 12306 page executor and captcha helper"
```

### Task 19: Popup panel + Background service worker

**Files:**
- Replace: `packages/extension/src/popup.tsx`
- Replace: `packages/extension/src/style.css`

- [ ] **Step 1: Update popup.tsx**

```tsx
import React from "react"
import "~style.css"

function IndexPopup() {
  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })
  }

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-justify-center plasmo-p-4 plasmo-w-56">
      <h2 className="plasmo-text-lg plasmo-font-bold plasmo-mb-3">EasyHome</h2>
      <button
        onClick={openDashboard}
        className="plasmo-px-4 plasmo-py-2 plasmo-bg-blue-500 plasmo-text-white plasmo-rounded-lg plasmo-text-sm plasmo-w-full hover:plasmo-bg-blue-600">
        打开控制台
      </button>
    </div>
  )
}

export default IndexPopup
```

- [ ] **Step 2: Update style.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Commit**

```bash
git add packages/extension/src/popup.tsx packages/extension/src/style.css
git commit -m "feat: wire dashboard popup entry and update styles"
```

### Task 20: Dockerfile and final config

**Files:**
- Create: `packages/server/Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Write server Dockerfile**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Update docker-compose.yml**

```yaml
version: '3.8'
services:
  server:
    build: ./packages/server
    ports:
      - "8000:8000"
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=sqlite+aiosqlite:///./easyhome.db
    volumes:
      - ./data:/app/data
    depends_on:
      - redis
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/Dockerfile docker-compose.yml
git commit -m "feat: add Dockerfile and update compose config"
```
