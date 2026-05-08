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
