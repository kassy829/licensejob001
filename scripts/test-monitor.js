/**
 * 警察庁監視機能のテストスクリプト
 * 使い方:
 *   node scripts/test-monitor.js          # ロジックのみ（ネット不要）
 *   node scripts/test-monitor.js --email  # メール送信テストも実行
 */
const path = require('path');
const crypto = require('crypto');

require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../backend/.env'),
});

const FULL_EMAIL = process.argv.includes('--email');

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
// STEP 1: キーワード検出ロジック
// ──────────────────────────────────────────────
function step1_keywords() {
  console.log('\n=== STEP 1: キーワード検出ロジック ===');
  const cases = [
    { label: '外免切替の記載あり', html: '<p>外国免許切替の申請受付を開始しました。</p>', expectFound: true },
    { label: '外免切替の記載なし', html: '<p>交通安全に関するお知らせ</p>', expectFound: false },
    { label: '複数キーワードあり', html: '<p>外免切替・外国運転免許の手続きについて</p>', expectFound: true },
  ];
  let allPassed = true;
  for (const tc of cases) {
    const found = findGaimenKeywords(tc.html);
    const pass = tc.expectFound ? found.length > 0 : found.length === 0;
    console.log(`  ${pass ? '✅' : '❌'} ${tc.label}: [${found.join(', ') || '未検出'}]`);
    if (!pass) allPassed = false;
  }
  return allPassed;
}

// ──────────────────────────────────────────────
// STEP 2: ハッシュ変更検知
// ──────────────────────────────────────────────
function step2_hashDetection() {
  console.log('\n=== STEP 2: ハッシュ変更検知 ===');
  const v1 = '<html><body>交通情報ページ v1</body></html>';
  const v2 = '<html><body>交通情報ページ v2（外免切替の情報を追加）</body></html>';
  const changed = hashContent(v1) !== hashContent(v2);
  const unchanged = hashContent(v1) === hashContent(v1);
  console.log(`  ✅ ページ変更を検知: ${changed}`);
  console.log(`  ✅ 同一ページを正しく同一判定: ${unchanged}`);
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
  console.log(`  ${valid ? '✅' : '❌'} 有効な cron 式: ${valid}`);
  console.log(`  ✅ 意味: 毎日 09:00 と 15:00（JST）にチェック`);
  return valid;
}

// ──────────────────────────────────────────────
// STEP 4: 環境変数チェック
// ──────────────────────────────────────────────
function step4_env() {
  console.log('\n=== STEP 4: 環境変数チェック ===');
  const checks = [
    { key: 'NOTIFY_EMAIL', secret: false },
    { key: 'SMTP_HOST', secret: false },
    { key: 'SMTP_PORT', secret: false },
    { key: 'SMTP_USER', secret: false },
    { key: 'SMTP_PASS', secret: true },
    { key: 'POLICE_MONITOR_URL', secret: false },
    { key: 'POLICE_MONITOR_CRON', secret: false },
  ];
  for (const c of checks) {
    const val = process.env[c.key];
    const isPlaceholder = !val || val.startsWith('your_') || val.includes('example.com');
    const display = isPlaceholder ? '（未設定）' : c.secret ? '***' : val;
    console.log(`  ${isPlaceholder ? '⚠️ ' : '✅'} ${c.key}: ${display}`);
  }
}

// ──────────────────────────────────────────────
// STEP 5: メール送信テスト（--email オプション時のみ）
// ──────────────────────────────────────────────
async function step5_email() {
  console.log('\n=== STEP 5: メール送信テスト ===');
  const to = process.env.NOTIFY_EMAIL;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!to || to.includes('example.com') || !smtpUser || smtpUser.startsWith('your_') || !smtpPass || smtpPass.startsWith('your_')) {
    console.log('  ⚠️  SMTP設定が未完了のためスキップ');
    return;
  }

  const nodemailer = require(path.resolve(__dirname, '../backend/node_modules/nodemailer'));
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    await transporter.verify();
    console.log('  ✅ SMTPサーバー接続成功');

    await transporter.sendMail({
      from: process.env.SMTP_FROM || smtpUser,
      to,
      subject: '【テスト】警察庁外免切替モニター動作確認',
      html: `
        <div style="font-family:sans-serif;max-width:600px">
          <div style="background:#27AE60;color:#fff;padding:16px;border-radius:4px 4px 0 0">
            <h2 style="margin:0;font-size:16px">【テスト】外免切替モニター</h2>
          </div>
          <div style="border:1px solid #ddd;border-top:none;padding:20px;border-radius:0 0 4px 4px">
            <p>モニター機能の動作確認メッセージです。</p>
            <p>送信日時：${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
          </div>
        </div>
      `,
    });
    console.log(`  ✅ テストメール送信成功 → ${to}`);
  } catch (err) {
    console.error('  ❌ メールエラー:', err.message);
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

  if (FULL_EMAIL) {
    await step5_email();
  } else {
    console.log('\n💡 メール送信テストは --email オプションで実行できます');
    console.log('   node scripts/test-monitor.js --email');
  }

  const allPassed = r1 && r2 && r3;
  console.log('\n====================================');
  console.log(allPassed ? '✅ 全テスト通過' : '❌ 一部テスト失敗');
  console.log('====================================\n');

  process.exit(allPassed ? 0 : 1);
})();
