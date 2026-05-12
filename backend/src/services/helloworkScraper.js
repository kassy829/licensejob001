/**
 * ハローワーク提供システム スクレイパー
 * 対象: https://teikyo.hellowork.mhlw.go.jp/teikyo/
 *
 * セッション確立 → 求人検索フォーム送信 → 一覧取得 → 詳細取得
 * APIキー不要。Webポータルへの直接アクセスのみ使用する。
 *
 * 注意: ハローワーク登録事業者の固定IPホワイトリストが必要。
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://teikyo.hellowork.mhlw.go.jp';
const TOP_PATH = '/teikyo/';
const ENTRY_PATH =
  '/teikyo/GEAC040010.do?screenId=GEAC040010&action=execRedirect&nextScreenId=GEAC100010';

// ハローワーク提供システムの検索フォームフィールド名マッピング
// 実際のHTMLを確認後に調整すること
const FIELD_MAP = {
  jobCategory: 'shokugyoCode',   // 職種コード
  prefecture: 'todofukenCode',   // 都道府県コード
  page: 'pageNo',                // ページ番号
};

function createSession() {
  const cookieJar = {};

  const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    maxRedirects: 10,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
  });

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

  return instance;
}

function extractHiddenFields($) {
  const fields = {};
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const value = $(el).attr('value') || '';
    if (name) fields[name] = value;
  });
  return fields;
}

function buildFormData(fields) {
  return Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

function resolveAction($, fallbackPath) {
  const action = $('form').first().attr('action') || fallbackPath;
  if (action.startsWith('http')) return action;
  if (action.startsWith('/')) return `${BASE_URL}${action}`;
  return `${BASE_URL}/teikyo/${action}`;
}

function parseJobList($) {
  const jobs = [];

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

    const link = $(row).find('a').first();
    if (link.length) {
      job.detailUrl = link.attr('href') || '';
      if (!job.title) job.title = link.text().trim();
    }

    if (job.jobNumber || job.title) jobs.push(job);
  });

  return jobs;
}

function parseJobDetail($) {
  const detail = {};

  $('dl').each((_, dl) => {
    const dts = $(dl).find('dt');
    const dds = $(dl).find('dd');
    dts.each((i, dt) => {
      const key = $(dt).text().trim();
      const value = dds.eq(i).text().trim();
      if (key) detail[key] = value;
    });
  });

  $('table tr').each((_, row) => {
    const th = $(row).find('th').first();
    const td = $(row).find('td').first();
    if (th.length && td.length) {
      detail[th.text().trim()] = td.text().trim();
    }
  });

  return detail;
}

function assertNotHostBlocked(err) {
  if (err.response?.status === 403) {
    const reason = err.response.headers['x-deny-reason'] || '';
    if (reason === 'host_not_allowed' || String(err.response.data).includes('not in allowlist')) {
      const e = new Error(
        'このサーバーのIPアドレスはハローワーク提供システムのホワイトリストに登録されていません。' +
          '登録事業者の固定IPネットワークから実行してください。'
      );
      e.code = 'HOST_NOT_ALLOWED';
      throw e;
    }
  }
}

/**
 * ハローワーク提供システムにアクセスして求人一覧を取得する
 *
 * @param {object} params
 * @param {string} [params.jobCategory] - 職種コード
 * @param {string} [params.prefecture]  - 都道府県コード
 * @param {number} [params.page=1]      - ページ番号
 * @returns {Promise<{jobs: Array, page: object, rawHtml: string}>}
 */
async function scrapeJobList({ jobCategory, prefecture, page = 1 } = {}) {
  const session = createSession();

  // 1. トップページでセッション確立
  try {
    await session.get(TOP_PATH, { headers: { Referer: BASE_URL } });
  } catch (e) {
    assertNotHostBlocked(e);
    // トップページが存在しなくても続行
  }

  // 2. エントリーURL → 求人検索画面へリダイレクト
  let $;
  try {
    const res = await session.get(ENTRY_PATH, {
      headers: { Referer: `${BASE_URL}/teikyo/` },
    });
    $ = cheerio.load(res.data);
  } catch (err) {
    assertNotHostBlocked(err);
    throw err;
  }

  // 3. 検索フォームに条件をセットして送信
  const action = resolveAction($, ENTRY_PATH);
  const fields = {
    ...extractHiddenFields($),
    ...(jobCategory && { [FIELD_MAP.jobCategory]: jobCategory }),
    ...(prefecture && { [FIELD_MAP.prefecture]: prefecture }),
    [FIELD_MAP.page]: String(page),
  };

  try {
    const searchRes = await session.post(action, buildFormData(fields), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: `${BASE_URL}${ENTRY_PATH}`,
      },
    });
    $ = cheerio.load(searchRes.data);
  } catch (err) {
    assertNotHostBlocked(err);
    throw err;
  }

  const jobs = parseJobList($);

  const pagination = {
    current: parseInt($('[class*="current"]').first().text().replace(/[^0-9]/g, '')) || page,
    total: parseInt($('[class*="total"]').first().text().replace(/[^0-9]/g, '')) || 1,
    totalJobs:
      parseInt($('[class*="count"]').first().text().replace(/[^0-9]/g, '')) || jobs.length,
  };

  return { jobs, page: pagination, rawHtml: $.html() };
}

/**
 * 求人詳細ページをスクレイピングする
 *
 * @param {string} detailUrl - 詳細ページのURL（相対パスも可）
 * @returns {Promise<object>}
 */
async function scrapeJobDetail(detailUrl) {
  const session = createSession();
  const url = detailUrl.startsWith('http') ? detailUrl : `${BASE_URL}/teikyo/${detailUrl}`;

  try {
    const res = await session.get(url, { headers: { Referer: `${BASE_URL}/teikyo/` } });
    const $ = cheerio.load(res.data);
    return parseJobDetail($);
  } catch (err) {
    assertNotHostBlocked(err);
    throw err;
  }
}

module.exports = { scrapeJobList, scrapeJobDetail };
