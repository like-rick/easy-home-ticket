import React from "react"
import "~style.css"

function IndexPopup() {
  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('tabs/dashboard.html') })
  }

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-justify-center plasmo-p-4 plasmo-w-56 plasmo-bg-canvas">
      <h2 className="plasmo-text-base plasmo-font-semibold plasmo-mb-3 plasmo-text-white">EasyHome</h2>
      <button
        onClick={openDashboard}
        className="plasmo-px-4 plasmo-py-2 plasmo-bg-primary plasmo-text-black plasmo-rounded-md plasmo-text-sm plasmo-font-medium plasmo-w-full">
        打开控制台
      </button>
    </div>
  )
}

export default IndexPopup
