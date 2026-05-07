const crypto = require('crypto');
const axios = require('axios');
const db = require('./db');
const line = require('@line/bot-sdk');

const TARGET_URL =
  process.env.POLICE_MONITOR_URL ||
  'https://www.npa.go.jp/policies/application/license_renewal/gaimen.html';

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

function hashContent(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function fetchPage(url) {
  const res = await axios.get(url, {
    timeout: 15000,
    headers: { 'User-Agent': 'LicenseJobBot/1.0 (page-monitor)' },
    responseType: 'text',
  });
  return res.data;
}

async function getStoredHash(url) {
  const result = await db.query(
    'SELECT content_hash FROM page_snapshots WHERE url = $1',
    [url]
  );
  return result.rows[0]?.content_hash ?? null;
}

async function upsertSnapshot(url, hash, changed) {
  const now = new Date();
  await db.query(
    `INSERT INTO page_snapshots (url, content_hash, last_checked, last_changed)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (url) DO UPDATE
       SET content_hash  = EXCLUDED.content_hash,
           last_checked  = EXCLUDED.last_checked,
           last_changed  = CASE WHEN $5 THEN EXCLUDED.last_changed
                                ELSE page_snapshots.last_changed END`,
    [url, hash, now, now, changed]
  );
}

async function notifyUpdate() {
  const targetId = process.env.STAFF_LINE_USER_ID;
  if (!targetId) {
    console.warn('[policeMonitor] STAFF_LINE_USER_ID not set – skipping LINE notify');
    return;
  }

  const message = {
    type: 'flex',
    altText: '【警察庁】外免切替の情報が更新されました',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '【警察庁】外免切替 情報更新',
            weight: 'bold',
            color: '#ffffff',
            size: 'md',
          },
        ],
        backgroundColor: '#0057A8',
        paddingAll: 'md',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: '警察庁ホームページの外国免許切替ページに新しい情報が掲載されました。',
            wrap: true,
            size: 'sm',
          },
          {
            type: 'text',
            text: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
            size: 'xs',
            color: '#888888',
            margin: 'sm',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#0057A8',
            action: {
              type: 'uri',
              label: 'ページを確認する',
              uri: TARGET_URL,
            },
          },
        ],
      },
    },
  };

  await lineClient.pushMessage({ to: targetId, messages: [message] });
  console.log('[policeMonitor] LINE notification sent');
}

async function checkForUpdates() {
  console.log(`[policeMonitor] Checking ${TARGET_URL}`);
  try {
    const html = await fetchPage(TARGET_URL);
    const newHash = hashContent(html);
    const oldHash = await getStoredHash(TARGET_URL);

    const changed = oldHash !== null && oldHash !== newHash;
    await upsertSnapshot(TARGET_URL, newHash, changed);

    if (changed) {
      console.log('[policeMonitor] Page changed – notifying');
      await notifyUpdate();
    } else if (oldHash === null) {
      console.log('[policeMonitor] First snapshot saved');
    } else {
      console.log('[policeMonitor] No change detected');
    }
  } catch (err) {
    console.error('[policeMonitor] Error during check:', err.message);
  }
}

module.exports = { checkForUpdates };
