const express = require('express');
const { query, validationResult } = require('express-validator');
const { searchJobs, getJobDetail } = require('../services/hellowork');

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
      const data = await searchJobs({
        jobCategory: req.query.category,
        prefecture: req.query.prefecture,
        page: req.query.page || 1,
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// 求人詳細
router.get('/:jobId', async (req, res, next) => {
  try {
    const data = await getJobDetail(req.params.jobId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
