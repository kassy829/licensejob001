-- 外部ページ監視用スナップショット
CREATE TABLE IF NOT EXISTS page_snapshots (
  url         TEXT          PRIMARY KEY,
  content_hash VARCHAR(64)  NOT NULL,
  last_checked TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_changed TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
