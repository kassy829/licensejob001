/**
 * ハローワーク提供システム スクレイパー
 * 対象: https://teikyo.hellowork.mhlw.go.jp/teikyo/
 *
 * セッション確立 → 求人一覧取得 → 求人詳細取得 の順で動作する。
 * サイトはStruts系Javaアプリのため、セッションCookieとRefererヘッダーが必要。
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://teikyo.hellowork.mhlw.go.jp';
const TOP_PATH = '/teikyo/';
const ENTRY_PATH =
  '/teikyo/GEAC040010.do?screenId=GEAC040010&action=execRedirect&nextScreenId=GEAC100010';

// セッションCookieを保持するaxiosインスタンスを生成する
function createSession() {
  const cookieJar = {};

  const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    maxRedirects: 10,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  // レスポンスのSet-CookieをCookieとして次のリクエストに引き継ぐ
  instance.interceptors.response.use((response) => {
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      setCookie.forEach((raw) => {
        const [pair] = raw.split(';');
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) return;
        const name = pair.slice(0, eqIdx).trim();
        const value = pair.slice(eqIdx + 1).trim();
        if (name) cookieJar[name] = value;
      });
    }
    return response;
  });

  instance.interceptors.request.use((config) => {
    const cookieStr = Object.entries(cookieJar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    if (cookieStr) config.headers['Cookie'] = cookieStr;
    return config;
  });

  return { instance, cookieJar };
}

/**
 * HTMLからhidden inputフィールドを収集してオブジェクトにする
 */
function extractHiddenFields($) {
  const fields = {};
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const value = $(el).attr('value') || '';
    if (name) fields[name] = value;
  });
  return fields;
}

/**
 * URLエンコードされたフォームデータ文字列を生成する
 */
function buildFormData(fields) {
  return Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * 求人一覧テーブルをパースして配列に変換する
 * ハローワーク提供システムの実際のHTMLに合わせてセレクタを調整すること。
 */
function parseJobList($) {
  const jobs = [];

  // 求人一覧は通常 table の tbody > tr に格納される
  $('table tbody tr, table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 2) return;

    const job = {
      jobNumber: $(cells[0]).text().trim(),
      title: $(cells[1]).text().trim(),
      company: cells.length > 2 ? $(cells[2]).text().trim() : '',
      location: cells.length > 3 ? $(cells[3]).text().trim() : '',
      wage: cells.length > 4 ? $(cells[4]).text().trim() : '',
      deadline: cells.length > 5 ? $(cells[5]).text().trim() : '',
      detailUrl: '',
    };

    // 詳細リンクがある場合
    const link = $(row).find('a').first();
    if (link.length) {
      job.detailUrl = link.attr('href') || '';
      if (!job.title) job.title = link.text().trim();
    }

    if (job.jobNumber || job.title) jobs.push(job);
  });

  return jobs;
}

/**
 * 求人詳細ページをパースする
 */
function parseJobDetail($) {
  const detail = {};

  // dl/dt/dd 形式
  $('dl').each((_, dl) => {
    const dts = $(dl).find('dt');
    const dds = $(dl).find('dd');
    dts.each((i, dt) => {
      const key = $(dt).text().trim();
      const value = dds.eq(i).text().trim();
      if (key) detail[key] = value;
    });
  });

  // table th/td 形式
  $('table tr').each((_, row) => {
    const th = $(row).find('th').first();
    const td = $(row).find('td').first();
    if (th.length && td.length) {
      detail[th.text().trim()] = td.text().trim();
    }
  });

  return detail;
}

/**
 * ハローワーク提供システムに接続し求人一覧を取得する
 *
 * 手順:
 * 1. トップページにアクセスしてJSESSIONIDを取得
 * 2. エントリーURLにRefererをつけてアクセス
 * 3. フォームがあれば自動送信して求人一覧画面へ遷移
 * 4. 求人一覧をパース
 *
 * @returns {Promise<{jobs: Array, rawHtml: string, page: object}>}
 */
async function scrapeJobList() {
  const { instance: session } = createSession();

  // 1. トップページにアクセスしてセッション確立
  console.log('[scraper] トップページにアクセス中...');
  try {
    await session.get(TOP_PATH, {
      headers: { Referer: BASE_URL },
    });
  } catch (e) {
    // トップページが存在しなくても続行する
    console.log(`[scraper] トップページ: ${e.response?.status ?? e.message}`);
  }

  // 2. エントリーURLにアクセス
  console.log('[scraper] エントリーページにアクセス中...');
  let entryRes;
  try {
    entryRes = await session.get(ENTRY_PATH, {
      headers: { Referer: `${BASE_URL}/teikyo/` },
    });
  } catch (err) {
    if (err.response?.status === 403) {
      const reason = err.response.headers['x-deny-reason'] || '';
      if (reason === 'host_not_allowed' || err.response.data?.toString().includes('not in allowlist')) {
        const msg =
          '[scraper] 403 host_not_allowed: このサーバーのIPアドレスはハローワーク提供システムの' +
          'ホワイトリストに登録されていません。\n' +
          '許可されたネットワーク（登録事業者の固定IP）から実行してください。';
        throw new Error(msg);
      }
    }
    throw err;
  }

  let $ = cheerio.load(entryRes.data);
  const pageTitle = $('title').text().trim();
  console.log(`[scraper] ページタイトル: ${pageTitle}`);

  // レスポンスHTMLを診断用に出力
  const bodySnippet = $.html().slice(0, 500).replace(/\s+/g, ' ');
  console.log(`[scraper] HTML先頭: ${bodySnippet}`);

  // 3. フォームがあれば自動送信
  const form = $('form').first();
  if (form.length) {
    let action = form.attr('action') || '';
    if (!action.startsWith('http')) {
      action = action.startsWith('/') ? `${BASE_URL}${action}` : `${BASE_URL}/teikyo/${action}`;
    }
    const hidden = extractHiddenFields($);
    console.log(`[scraper] フォーム送信先: ${action}`);
    console.log(`[scraper] hiddenフィールド:`, hidden);

    const formRes = await session.post(action, buildFormData(hidden), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: `${BASE_URL}${ENTRY_PATH}`,
      },
    });
    $ = cheerio.load(formRes.data);
    console.log(`[scraper] フォーム送信後タイトル: ${$('title').text().trim()}`);
  }

  // 4. 求人一覧をパース
  const jobs = parseJobList($);
  console.log(`[scraper] 取得した求人数: ${jobs.length}`);

  // ページネーション情報
  const pagination = {
    current: parseInt($('[class*="current"], .page-current').first().text().trim()) || 1,
    total: parseInt($('[class*="total"], .page-total').first().text().replace(/[^0-9]/g, '')) || 1,
    totalJobs:
      parseInt($('[class*="count"], .result-count').first().text().replace(/[^0-9]/g, '')) ||
      jobs.length,
  };

  return { jobs, rawHtml: $.html(), page: pagination };
}

/**
 * 特定の求人詳細を取得する
 *
 * @param {string} detailUrl - 詳細ページのURL（相対パスも可）
 * @returns {Promise<object>}
 */
async function scrapeJobDetail(detailUrl) {
  const { instance: session } = createSession();
  const url = detailUrl.startsWith('http') ? detailUrl : `${BASE_URL}/teikyo/${detailUrl}`;

  console.log(`[scraper] 求人詳細取得: ${url}`);
  const res = await session.get(url);
  const $ = cheerio.load(res.data);

  return parseJobDetail($);
}

module.exports = { scrapeJobList, scrapeJobDetail };
