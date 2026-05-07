const axios = require('axios');

const BASE_URL = process.env.HELLOWORK_API_BASE_URL;
const API_KEY = process.env.HELLOWORK_API_KEY;

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Accept': 'application/json',
  },
  timeout: 10000,
});

/**
 * 求人情報を検索する
 * @param {Object} params
 * @param {string} params.jobCategory  - 職種コード（例: 輸送・機械運転）
 * @param {string} params.prefecture   - 都道府県コード
 * @param {number} params.page         - ページ番号
 * @param {number} params.perPage      - 件数
 */
async function searchJobs({ jobCategory = '09', prefecture = '13', page = 1, perPage = 20 } = {}) {
  const res = await client.get('/jobs', {
    params: {
      jobCategory,
      prefecture,
      page,
      count: perPage,
    },
  });
  return res.data;
}

/**
 * 求人詳細を取得する
 * @param {string} jobId - ハローワーク求人番号
 */
async function getJobDetail(jobId) {
  const res = await client.get(`/jobs/${jobId}`);
  return res.data;
}

module.exports = { searchJobs, getJobDetail };
