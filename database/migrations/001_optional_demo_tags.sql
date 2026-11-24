-- Optional, after 001_menu_tags_featured_rider_online.sql: give the seeded demo
-- menu items their card labels. Only fills rows whose tag is still empty.
UPDATE menu_items SET tag = 'Campus favourite', featured = TRUE WHERE id = 'm_rice_curry' AND tag IS NULL;
UPDATE menu_items SET tag = 'Student pick', featured = TRUE WHERE id = 'm_kottu' AND tag IS NULL;
UPDATE menu_items SET tag = 'Quick bite' WHERE id IN ('m_rolls', 'm_wrap') AND tag IS NULL;
UPDATE menu_items SET tag = 'Cool down' WHERE id = 'm_choco' AND tag IS NULL;
UPDATE menu_items SET tag = 'Sold out soon' WHERE id = 'm_stringhop' AND tag IS NULL;
UPDATE menu_items SET tag = 'Student bite' WHERE id = 'm_burger' AND tag IS NULL;
UPDATE menu_items SET tag = 'Vegetarian' WHERE id IN ('m_pizza', 'm_garden') AND tag IS NULL;
