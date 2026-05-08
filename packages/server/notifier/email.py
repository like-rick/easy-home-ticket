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
