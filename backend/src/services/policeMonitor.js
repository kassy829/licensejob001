const crypto = require('crypto');
const axios = require('axios');
const nodemailer = require('nodemailer');
const db = require('./db');

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

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function hashContent(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function fetchPage(url) {
  const res = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
    },
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

async function sendEmail(url, matchedKeywords) {
  const to = process.env.NOTIFY_EMAIL;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!to) {
    console.warn('[policeMonitor] NOTIFY_EMAIL not set – skipping email');
    return;
  }

  const hasGaimen = matchedKeywords.length > 0;
  const subject = hasGaimen
    ? '【警察庁】外免切替 関連情報が更新されました'
    : '【警察庁】ホームページに変更がありました';

  const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const keywordLine = hasGaimen
    ? `<p>🔴 <strong>外免切替関連キーワードを検出：</strong>${matchedKeywords.join('、')}</p>`
    : '<p>ℹ️ 外免切替キーワードは検出されませんでしたが、念のためご確認ください。</p>';

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:${hasGaimen ? '#C0392B' : '#0057A8'};color:#fff;padding:16px;border-radius:4px 4px 0 0">
        <h2 style="margin:0;font-size:16px">${subject}</h2>
      </div>
      <div style="border:1px solid #ddd;border-top:none;padding:20px;border-radius:0 0 4px 4px">
        ${keywordLine}
        <p>確認日時：${now}</p>
        <p>監視URL：<a href="${url}">${url}</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
        <p><a href="${url}" style="background:${hasGaimen ? '#C0392B' : '#0057A8'};color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px">ページを確認する</a></p>
      </div>
    </div>
  `;

  const transporter = createTransporter();
  await transporter.sendMail({ from, to, subject, html });
  console.log(`[policeMonitor] Email sent to ${to} (gaimen: ${hasGaimen})`);
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
    await sendEmail(url, matched);
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
