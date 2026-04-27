const CLOUD_UPGRADE_URL = "https://kiagenda.com.br";

const elements = {
  openOptionsButton: document.getElementById("openOptionsButton"),
  upgradeButton: document.getElementById("upgradeButton")
};

function openOptions() {
  chrome.runtime.openOptionsPage();
}

function openUpgradePage() {
  chrome.tabs.create({
    url: CLOUD_UPGRADE_URL
  });
}

elements.openOptionsButton.addEventListener("click", openOptions);
elements.upgradeButton.addEventListener("click", openUpgradePage);
