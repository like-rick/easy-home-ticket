import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from models import init_db, async_session
from models.station import Station
from mailer import send_mail
from sqlalchemy import select

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler("server.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("easyhome")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
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


@app.post("/api/send-mail")
async def api_send_mail(req: Request):
    body = await req.json()
    to = body.get("to", "")
    subject = body.get("subject", "")
    html = body.get("html", "")
    ok = await send_mail(to, subject, html)
    return {"ok": ok}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
