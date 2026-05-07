const crypto = require('crypto');
const axios = require('axios');
const db = require('./db');
const line = require('@line/bot-sdk');

// 監視対象URL（複数設定可能、カンマ区切り）
const MONITOR_URLS = (
  process.env.POLICE_MONITOR_URL ||
  'https://www.npa.go.jp/'
)
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

// 外免切替関連キーワード
const GAIMEN_KEYWORDS = [
  '外国免許切替',
  '外免切替',
  '外国運転免許',
  '外国の運転免許',
  '免許の切替',
  '切替申請',
];

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

function findGaimenKeywords(html) {
  return GAIMEN_KEYWORDS.filter((kw) => html.includes(kw));
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

async function notifyUpdate(url, matchedKeywords) {
  const targetId = process.env.STAFF_LINE_USER_ID;
  if (!targetId) {
    console.warn('[policeMonitor] STAFF_LINE_USER_ID not set – skipping LINE notify');
    return;
  }

  const hasGaimen = matchedKeywords.length > 0;
  const headerColor = hasGaimen ? '#C0392B' : '#0057A8';
  const headerText = hasGaimen
    ? '【警察庁】外免切替 関連情報あり'
    : '【警察庁】ページが更新されました';
  const bodyText = hasGaimen
    ? `外免切替に関するキーワードが検出されました。\n検出: ${matchedKeywords.join('、')}`
    : '警察庁ホームページに変更がありました。外免切替の情報が含まれていない可能性がありますが、ご確認ください。';

  const message = {
    type: 'flex',
    altText: headerText,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: headerText,
            weight: 'bold',
            color: '#ffffff',
            size: 'sm',
            wrap: true,
          },
        ],
        backgroundColor: headerColor,
        paddingAll: 'md',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: bodyText,
            wrap: true,
            size: 'sm',
          },
          {
            type: 'text',
            text: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
            size: 'xs',
            color: '#888888',
            margin: 'md',
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
            color: headerColor,
            action: {
              type: 'uri',
              label: 'ページを確認する',
              uri: url,
            },
          },
        ],
      },
    },
  };

  await lineClient.pushMessage({ to: targetId, messages: [message] });
  console.log(`[policeMonitor] LINE notification sent (gaimen: ${hasGaimen})`);
}

async function checkUrl(url) {
  console.log(`[policeMonitor] Checking ${url}`);
  const html = await fetchPage(url);
  const newHash = hashContent(html);
  const oldHash = await getStoredHash(url);

  const changed = oldHash !== null && oldHash !== newHash;
  await upsertSnapshot(url, newHash, changed);

  if (changed) {
    const matched = findGaimenKeywords(html);
    console.log(`[policeMonitor] Page changed – keywords: [${matched.join(', ')}]`);
    await notifyUpdate(url, matched);
  } else if (oldHash === null) {
    const matched = findGaimenKeywords(html);
    console.log(`[policeMonitor] First snapshot saved – keywords found: [${matched.join(', ')}]`);
  } else {
    console.log('[policeMonitor] No change detected');
  }
}

async function checkForUpdates() {
  for (const url of MONITOR_URLS) {
    try {
      await checkUrl(url);
    } catch (err) {
      console.error(`[policeMonitor] Error checking ${url}:`, err.message);
    }
  }
}

module.exports = { checkForUpdates };
