#!/usr/bin/env node
/**
 * ハローワーク提供システムから求人情報をダウンロードして保存するスクリプト
 *
 * 使い方:
 *   node scripts/scrape-hellowork-jobs.js
 *   node scripts/scrape-hellowork-jobs.js --output ./data/jobs.json
 */

require('dotenv').config({ path: `${__dirname}/../backend/.env` });

const path = require('path');
const fs = require('fs');
const { scrapeJobList } = require('../backend/src/services/helloworkScraper');

const OUTPUT_DIR = path.resolve(__dirname, '../data');
const DEFAULT_OUTPUT = path.join(OUTPUT_DIR, `jobs_${dateStr()}.json`);

function dateStr() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf('--output');
  return {
    output: outputIdx !== -1 ? args[outputIdx + 1] : DEFAULT_OUTPUT,
  };
}

async function main() {
  const { output } = parseArgs();

  console.log('=== ハローワーク求人スクレイパー ===');
  console.log(`保存先: ${output}`);
  console.log('');

  let result;
  try {
    result = await scrapeJobList();
  } catch (err) {
    console.error('[ERROR] スクレイピング失敗:', err.message);
    if (err.response) {
      console.error('  HTTPステータス:', err.response.status);
      console.error('  URL:', err.config?.url);
    }
    process.exit(1);
  }

  const { jobs, page } = result;

  console.log('');
  console.log(`取得結果:`);
  console.log(`  - 求人数: ${jobs.length} 件`);
  console.log(`  - ページ: ${page.current} / ${page.total}`);
  console.log(`  - 合計件数: ${page.totalJobs} 件`);

  // 出力ディレクトリ作成
  const dir = path.dirname(output);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const payload = {
    scrapedAt: new Date().toISOString(),
    source: 'https://teikyo.hellowork.mhlw.go.jp/teikyo/',
    page,
    jobs,
  };

  fs.writeFileSync(output, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`\nJSON保存完了: ${output}`);

  // コンソールにサマリーを表示
  if (jobs.length > 0) {
    console.log('\n--- 取得求人（最初の5件）---');
    jobs.slice(0, 5).forEach((j, i) => {
      console.log(`[${i + 1}] ${j.jobNumber} | ${j.title} | ${j.company} | ${j.location}`);
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
