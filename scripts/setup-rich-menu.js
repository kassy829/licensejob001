/**
 * LINEリッチメニュー セットアップスクリプト
 * 実行: node scripts/setup-rich-menu.js
 * 事前に .env の LINE_CHANNEL_ACCESS_TOKEN, LIFF_ID_JOB_SEARCH, LIFF_ID_MYPAGE を設定すること
 */
require('dotenv').config({ path: './backend/.env' });
const https = require('https');

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LIFF_JOB = process.env.LIFF_ID_JOB_SEARCH;
const LIFF_MYPAGE = process.env.LIFF_ID_MYPAGE;
const FRONTEND_URL = process.env.FRONTEND_URL;

if (!TOKEN || !LIFF_JOB || !LIFF_MYPAGE) {
  console.error('環境変数が設定されていません: LINE_CHANNEL_ACCESS_TOKEN, LIFF_ID_JOB_SEARCH, LIFF_ID_MYPAGE');
  process.exit(1);
}

// 2枠リッチメニューの定義
const richMenuBody = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: 'ライセンスジョブ メニュー',
  chatBarText: 'メニューを開く',
  areas: [
    {
      // 上段：求人を探す・応募する
      bounds: { x: 0, y: 0, width: 2500, height: 421 },
      action: {
        type: 'uri',
        label: '求人を探す・応募する',
        uri: `https://liff.line.me/${LIFF_JOB}`,
      },
    },
    {
      // 下段：マイページ
      bounds: { x: 0, y: 422, width: 2500, height: 421 },
      action: {
        type: 'uri',
        label: 'マイページ',
        uri: `https://liff.line.me/${LIFF_MYPAGE}/mypage`,
      },
    },
  ],
};

async function lineApi(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      {
        hostname: 'api.line.me',
        path,
        method,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('1. リッチメニューを作成...');
  const created = await lineApi('POST', '/v2/bot/richmenu', richMenuBody);
  if (created.status !== 200) {
    console.error('作成失敗:', created.body);
    process.exit(1);
  }
  const richMenuId = created.body.richMenuId;
  console.log(`   作成完了: richMenuId = ${richMenuId}`);

  console.log('2. デフォルトリッチメニューに設定...');
  const set = await lineApi('POST', `/v2/bot/user/all/richmenu/${richMenuId}`);
  if (set.status !== 200) {
    console.error('デフォルト設定失敗:', set.body);
    process.exit(1);
  }
  console.log('   設定完了');

  console.log('\n✅ リッチメニューのセットアップが完了しました');
  console.log(`   richMenuId: ${richMenuId}`);
  console.log('\n次のステップ:');
  console.log('   LINE Official Account Managerでリッチメニューに画像をアップロードしてください');
  console.log('   推奨サイズ: 2500 x 843 px');
}

main().catch(console.error);
