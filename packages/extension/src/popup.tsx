import React from "react"
import "~style.css"

function IndexPopup() {
  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') })
  }

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-justify-center plasmo-p-4 plasmo-w-56">
      <h2 className="plasmo-text-lg plasmo-font-bold plasmo-mb-3">EasyHome</h2>
      <button
        onClick={openDashboard}
        className="plasmo-px-4 plasmo-py-2 plasmo-bg-blue-500 plasmo-text-white plasmo-rounded-lg plasmo-text-sm plasmo-w-full hover:plasmo-bg-blue-600">
        打开控制台
      </button>
    </div>
  )
}

export default IndexPopup
