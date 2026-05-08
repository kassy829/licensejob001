/**
 * 警察庁監視機能のテストスクリプト
 * 使い方:
 *   node scripts/test-monitor.js          # ロジックのみ（ネット不要）
 *   node scripts/test-monitor.js --line   # LINE通知テストも実行
 */
const path = require('path');
const crypto = require('crypto');

require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../backend/.env'),
});

const FULL_LINE = process.argv.includes('--line');

const GAIMEN_KEYWORDS = [
  '外国免許切替',
  '外免切替',
  '外国運転免許',
  '外国の運転免許',
  '免許の切替',
  '切替申請',
];

function hashContent(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function findGaimenKeywords(html) {
  return GAIMEN_KEYWORDS.filter((kw) => html.includes(kw));
}

// ──────────────────────────────────────────────
// STEP 1: キーワード検出ロジックのテスト
// ──────────────────────────────────────────────
function step1_keywords() {
  console.log('\n=== STEP 1: キーワード検出ロジック ===');

  const cases = [
    {
      label: '外免切替の記載あり',
      html: '<p>外国免許切替の申請受付を開始しました。</p>',
      expectFound: true,
    },
    {
      label: '外免切替の記載なし',
      html: '<p>交通安全に関するお知らせ</p>',
      expectFound: false,
    },
    {
      label: '複数キーワードあり',
      html: '<p>外免切替・外国運転免許の手続きについて</p>',
      expectFound: true,
    },
  ];

  let allPassed = true;
  for (const tc of cases) {
    const found = findGaimenKeywords(tc.html);
    const pass = tc.expectFound ? found.length > 0 : found.length === 0;
    const mark = pass ? '✅' : '❌';
    console.log(`  ${mark} ${tc.label}: [${found.join(', ') || '未検出'}]`);
    if (!pass) allPassed = false;
  }
  return allPassed;
}

// ──────────────────────────────────────────────
// STEP 2: ハッシュ変更検知のテスト
// ──────────────────────────────────────────────
function step2_hashDetection() {
  console.log('\n=== STEP 2: ハッシュ変更検知 ===');

  const page_v1 = '<html><body>交通情報ページ v1</body></html>';
  const page_v2 = '<html><body>交通情報ページ v2（外免切替の情報を追加）</body></html>';
  const page_v1_dup = page_v1;

  const h1 = hashContent(page_v1);
  const h2 = hashContent(page_v2);
  const h3 = hashContent(page_v1_dup);

  const changed = h1 !== h2;
  const unchanged = h1 === h3;

  console.log(`  ✅ ページ変更を検知: ${changed}`);
  console.log(`  ✅ 同一ページを正しく同一判定: ${unchanged}`);
  console.log(`  ✅ ハッシュ例: ${h1.substring(0, 16)}...`);

  return changed && unchanged;
}

// ──────────────────────────────────────────────
// STEP 3: cron 式の検証
// ──────────────────────────────────────────────
function step3_cron() {
  console.log('\n=== STEP 3: cron スケジュール検証 ===');
  const nodeCron = require(path.resolve(__dirname, '../backend/node_modules/node-cron'));
  const schedule = process.env.POLICE_MONITOR_CRON || '0 0,6 * * *';

  const valid = nodeCron.validate(schedule);
  console.log(`  ✅ スケジュール: "${schedule}"`);
  console.log(`  ✅ 有効な cron 式: ${valid}`);
  console.log(`  ✅ 意味: 毎日 09:00 と 15:00（JST）にチェック`);
  return valid;
}

// ──────────────────────────────────────────────
// STEP 4: 環境変数確認
// ──────────────────────────────────────────────
function step4_env() {
  console.log('\n=== STEP 4: 環境変数チェック ===');
  const checks = [
    { key: 'STAFF_LINE_USER_ID', secret: false },
    { key: 'LINE_CHANNEL_ACCESS_TOKEN', secret: true },
    { key: 'POLICE_MONITOR_URL', secret: false },
    { key: 'POLICE_MONITOR_CRON', secret: false },
    { key: 'DATABASE_URL', secret: true },
  ];

  for (const c of checks) {
    const val = process.env[c.key];
    const isPlaceholder = !val || val.startsWith('your_');
    const display = isPlaceholder ? '（未設定）' : c.secret ? '***' : val;
    const mark = isPlaceholder ? '⚠️ ' : '✅';
    console.log(`  ${mark} ${c.key}: ${display}`);
  }
}

// ──────────────────────────────────────────────
// STEP 5: LINE 通知テスト（--line オプション時のみ）
// ──────────────────────────────────────────────
async function step5_line() {
  console.log('\n=== STEP 5: LINE通知テスト ===');
  const targetId = process.env.STAFF_LINE_USER_ID;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!targetId || !token || token === 'your_channel_access_token') {
    console.log('  ⚠️  LINE_CHANNEL_ACCESS_TOKEN が未設定のためスキップ');
    return;
  }

  const line = require(path.resolve(__dirname, '../backend/node_modules/@line/bot-sdk'));
  const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: token });

  try {
    await client.pushMessage({
      to: targetId,
      messages: [
        {
          type: 'flex',
          altText: '【テスト】警察庁外免切替モニター動作確認',
          contents: {
            type: 'bubble',
            header: {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: '【テスト】外免切替モニター', weight: 'bold', color: '#ffffff', size: 'md' },
              ],
              backgroundColor: '#27AE60',
              paddingAll: 'md',
            },
            body: {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: 'モニター機能の動作確認メッセージです。', wrap: true, size: 'sm' },
                {
                  type: 'text',
                  text: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
                  size: 'xs',
                  color: '#888888',
                  margin: 'sm',
                },
              ],
            },
          },
        },
      ],
    });
    console.log('  ✅ LINE通知送信成功');
  } catch (err) {
    console.error('  ❌ LINE エラー:', err.message);
  }
}

// ──────────────────────────────────────────────
// メイン
// ──────────────────────────────────────────────
(async () => {
  console.log('====================================');
  console.log('  警察庁外免切替モニター テスト');
  console.log('====================================');

  const r1 = step1_keywords();
  const r2 = step2_hashDetection();
  const r3 = step3_cron();
  step4_env();

  if (FULL_LINE) {
    await step5_line();
  } else {
    console.log('\n💡 LINE通知テストは --line オプションで実行できます');
    console.log('   node scripts/test-monitor.js --line');
  }

  const allPassed = r1 && r2 && r3;
  console.log('\n====================================');
  console.log(allPassed ? '✅ 全テスト通過' : '❌ 一部テスト失敗');
  console.log('====================================\n');

  process.exit(allPassed ? 0 : 1);
})();
