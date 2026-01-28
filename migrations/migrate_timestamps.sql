-- Convert ISO 8601 timestamps to milliseconds since Unix epoch
-- Compatible with Cloudflare D1 (SQLite)

UPDATE blog_posts
SET
  created_at = CASE
    WHEN typeof(created_at) = 'text'
      THEN CAST(strftime('%s', created_at) AS INTEGER) * 1000
    ELSE created_at
  END,
  updated_at = CASE
    WHEN typeof(updated_at) = 'text'
      THEN CAST(strftime('%s', updated_at) AS INTEGER) * 1000
    ELSE updated_at
  END
WHERE
  typeof(created_at) = 'text'
  OR typeof(updated_at) = 'text';
