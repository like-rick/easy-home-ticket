import React from 'react'

export default function Popup() {
  return (
    <div style={{ width: 320, padding: 16, fontFamily: 'system-ui', background: '#0d0d0d', color: '#fff' }}>
      <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>EasyHome Ticket</h2>
      <button onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('tabs/dashboard.html') })}
        style={{ width: '100%', padding: '10px 0', background: '#3ecf8e', color: '#000', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
        打开控制台
      </button>
    </div>
  )
}
