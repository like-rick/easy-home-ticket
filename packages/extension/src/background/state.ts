let lastKnownLoginState: boolean | null = null
let loginTimer: ReturnType<typeof setInterval> | null = null
const CHECK_INTERVAL = 3 * 3600_000 // 3 hours

export function startLoginMonitor() {
  tick()
  loginTimer = setInterval(tick, CHECK_INTERVAL)
}

function tick() {
  chrome.tabs.query({ url: 'https://kyfw.12306.cn/*' }, (tabs) => {
    const tab = tabs.find(t => !t.discarded)
    if (!tab?.id) {
      if (lastKnownLoginState !== false) {
        lastKnownLoginState = false
        notifyLoginExpired()
      }
      return
    }
    chrome.tabs.sendMessage(tab.id, { type: 'CHECK_LOGIN_STATUS' }, (res) => {
      if (chrome.runtime.lastError || !res || res.error) return
      const loggedIn = res.loggedIn === true
      if (loggedIn !== lastKnownLoginState) {
        lastKnownLoginState = loggedIn
        chrome.runtime.sendMessage({ type: 'LOGIN_STATUS', loggedIn }).catch(() => {})
        if (!loggedIn) notifyLoginExpired()
      }
    })
  })
}

function notifyLoginExpired() {
  fetch('http://localhost:8000/api/send-mail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: (process.env as any).NOTIFY_EMAIL || '',
      subject: '[EasyHome] 12306 登录已过期',
      html: '<p>12306 登录态已过期，请打开浏览器刷新登录。</p>',
    }),
  }).catch(() => {})
}

export function sendTicketMail(email: string, trainNo: string, from: string, to: string) {
  fetch('http://localhost:8000/api/send-mail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: email,
      subject: `[EasyHome] 抢票成功 - ${trainNo} ${from}→${to}`,
      html: `<p>已成功下单 <b>${trainNo}</b> ${from}→${to}，请在 12306 APP 中完成付款。</p>`,
    }),
  }).catch(() => {})
}
