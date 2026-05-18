import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from models import init_db, get_db, async_session
from models.task import Task
from models.solution import Solution
from models.station import Station
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/stations")
async def get_stations(q: str = Query(default="", max_length=32)):
    async with async_session() as db:
        if q:
            stmt = (
                select(Station)
                .where(
                    Station.name.contains(q)
                    | Station.pinyin.startswith(q.lower())
                    | Station.full_pinyin.startswith(q.lower())
                )
                .order_by(Station.pinyin)
                .limit(50)
            )
        else:
            stmt = select(Station).order_by(Station.pinyin).limit(200)
        rows = (await db.execute(stmt)).scalars().all()
        return [{"name": s.name, "code": s.code, "pinyin": s.pinyin} for s in rows]


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

    log_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "()": "uvicorn.logging.DefaultFormatter",
                "format": "%(asctime)s  %(levelprefix)s %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "access": {
                "()": "uvicorn.logging.AccessFormatter",
                "format": '%(asctime)s  %(levelprefix)s %(client_addr)s - "%(request_line)s" %(status_code)s',
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "default": {
                "formatter": "default",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            },
            "access": {
                "formatter": "access",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            },
        },
        "loggers": {
            "uvicorn": {"handlers": ["default"], "level": "INFO"},
            "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": False},
            "uvicorn.error": {"level": "INFO"},
        },
    }

    uvicorn.run(app, host="0.0.0.0", port=8000, log_config=log_config)
