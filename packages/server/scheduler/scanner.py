import asyncio
import json
from datetime import datetime, timedelta, UTC
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

                            deadline = (datetime.now(UTC) + timedelta(seconds=30)).isoformat()
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
