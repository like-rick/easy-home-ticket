import re
import httpx
from sqlalchemy import select
from models import async_session
from models.station import Station

STATION_JS_URL = "https://kyfw.12306.cn/otn/resources/js/framework/station_name.js"


class StationMapper:
    def __init__(self):
        self._name_to_code: dict[str, str] = {}
        self._code_to_name: dict[str, str] = {}

    async def load(self):
        """Load station mappings from the database."""
        async with async_session() as db:
            rows = (await db.execute(select(Station))).scalars().all()
            if not rows:
                await self._seed_from_12306(db)
                rows = (await db.execute(select(Station))).scalars().all()
            for s in rows:
                self._name_to_code[s.name] = s.code
                self._code_to_name[s.code] = s.name

    async def _seed_from_12306(self, db):
        """Fetch station data from 12306 and populate the stations table."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(STATION_JS_URL)
            resp.raise_for_status()
        text = resp.text
        stations: list[Station] = []
        for match in re.finditer(r"@([^|]+)\|([^|]+)\|([A-Z]+)\|([^|]+)\|", text):
            pinyin_abbr = match.group(1)
            name = match.group(2)
            code = match.group(3)
            full_pinyin = match.group(4)
            stations.append(Station(name=name, code=code, pinyin=pinyin_abbr, full_pinyin=full_pinyin))
        db.add_all(stations)
        await db.commit()

    async def refresh(self):
        """Force refresh station data from 12306."""
        async with async_session() as db:
            from sqlalchemy import delete
            await db.execute(delete(Station))
            await db.commit()
            await self._seed_from_12306(db)
        self._name_to_code.clear()
        self._code_to_name.clear()
        await self.load()

    def to_code(self, name: str) -> str:
        return self._name_to_code.get(name, name)

    def to_name(self, code: str) -> str:
        return self._code_to_name.get(code, code)


station_mapper = StationMapper()
