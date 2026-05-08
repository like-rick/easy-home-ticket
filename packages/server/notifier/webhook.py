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
