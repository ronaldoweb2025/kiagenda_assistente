const { processCampaignQueue } = require("./campaignService");

const WORKER_INTERVAL_MS = Math.max(15000, Number(process.env.CAMPAIGN_WORKER_INTERVAL_MS || 60000));
let workerTimer = null;
let workerRunning = false;

async function runWorkerCycle() {
  if (workerRunning) {
    return;
  }

  workerRunning = true;

  try {
    await processCampaignQueue();
  } catch (error) {
    console.error("Erro no worker de campanhas:", error);
  } finally {
    workerRunning = false;
  }
}

function startCampaignWorker() {
  if (workerTimer) {
    return;
  }

  workerTimer = setInterval(() => {
    runWorkerCycle().catch((error) => {
      console.error("Erro ao executar ciclo do worker de campanhas:", error);
    });
  }, WORKER_INTERVAL_MS);
}

function stopCampaignWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}

module.exports = {
  runWorkerCycle,
  startCampaignWorker,
  stopCampaignWorker,
  WORKER_INTERVAL_MS
};
