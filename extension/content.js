(function bootstrapKiagendaExtension() {
  if (!window.location.href.startsWith("https://web.whatsapp.com/")) {
    return;
  }

  console.log("[KiAgenda Assistente] Extensao Essencial ativa no WhatsApp Web.");

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "KIAGENDA_EXTENSION_PING") {
      sendResponse({
        ok: true,
        location: window.location.href
      });
    }
  });
})();
