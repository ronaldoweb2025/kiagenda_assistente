chrome.runtime.onInstalled.addListener(() => {
  console.log("[KiAgenda Assistente] Extensao instalada e pronta.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "KIAGENDA_BACKGROUND_PING") {
    sendResponse({
      ok: true
    });
  }
});
