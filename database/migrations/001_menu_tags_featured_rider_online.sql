-- =============================================================
-- Migration 001: three optional columns used by the Flask API.
-- Adds columns only. It creates no tables and changes no existing values.
--
-- Back up first:
--   mysqldump -h 127.0.0.1 -P 3307 -u root -p j_eats > j_eats_backup.sql
-- Then run:
--   mysql -h 127.0.0.1 -P 3307 -u root -p j_eats < database/migrations/001_menu_tags_featured_rider_online.sql
-- Restart Flask afterwards. Safe to run twice (IF NOT EXISTS).
-- Fresh installs from schema.sql already have these columns.
-- =============================================================

-- The label shown on a menu card, e.g. "Student pick" or "Vegetarian".
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS tag VARCHAR(60) NULL AFTER allergens;

-- Shows the "Campus favourite" badge on the item.
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE AFTER tag;

-- A rider's Online / Offline switch (riders start online, as in the demo).
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT TRUE AFTER status;
