const express = require('express');
const { query, validationResult } = require('express-validator');
const { scrapeJobList, scrapeJobDetail } = require('../services/helloworkScraper');

const router = express.Router();

// 求人検索
router.get(
  '/',
  [
    query('category').optional().isString(),
    query('prefecture').optional().isString(),
    query('page').optional().isInt({ min: 1 }).toInt(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const data = await scrapeJobList({
        jobCategory: req.query.category,
        prefecture: req.query.prefecture,
        page: req.query.page || 1,
      });
      res.json(data);
    } catch (err) {
      if (err.code === 'HOST_NOT_ALLOWED') {
        return res.status(503).json({ error: err.message });
      }
      next(err);
    }
  }
);

// 求人詳細（detailUrlをクエリパラメータで受け取る）
router.get('/detail', async (req, res, next) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url パラメータが必要です' });

  try {
    const data = await scrapeJobDetail(url);
    res.json(data);
  } catch (err) {
    if (err.code === 'HOST_NOT_ALLOWED') {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
