const cron = require('node-cron');
const { checkForUpdates } = require('./policeMonitor');

// デフォルト: 毎日 9:00 と 15:00 (JST = UTC+9)
const SCHEDULE = process.env.POLICE_MONITOR_CRON || '0 0,6 * * *';

function start() {
  cron.schedule(SCHEDULE, () => {
    checkForUpdates().catch(console.error);
  }, { timezone: 'Asia/Tokyo' });

  console.log(`[scheduler] Police monitor started (cron: "${SCHEDULE}")`);

  // 起動時に初回チェック
  checkForUpdates().catch(console.error);
}

module.exports = { start };
