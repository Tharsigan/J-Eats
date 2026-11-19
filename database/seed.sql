-- =============================================================
-- J Eats - demo seed data (matches lib/mock-data/campus.ts)
-- Run after schema.sql:  mysql -u root -p j_eats < database/seed.sql
--
-- Every seeded account's password is: demo123
-- Stored as a Werkzeug PBKDF2 hash, so Flask can verify it with
-- werkzeug.security.check_password_hash(user.password_hash, password)
-- =============================================================

USE j_eats;
SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO platform_settings (id, delivery_fee, rider_payout, cash_cutoff_hour, ordering_open, max_active_jobs_per_rider) VALUES
  (1, 100, 150, 11, TRUE, 1);

INSERT INTO vendors (id, name, location, distance_km, open_now, closes_at, queue_length) VALUES
  ('v_cc', 'Central Canteen', 'University campus · 0.3 km away', 0.3, TRUE, '7:00 PM', 14),
  ('v_fc', 'Faculty Café', 'Faculty of Applied Sciences', 0.6, TRUE, '6:30 PM', 6),
  ('v_bl', 'The Burger Lab', 'Science faculty · 0.4 km away', 0.4, TRUE, '8:00 PM', 9),
  ('v_ss', 'Slice Society', 'Student centre', 0.5, TRUE, '9:00 PM', 4),
  ('v_gb', 'Green Bowl Café', 'Arts faculty lawn', 0.7, TRUE, '6:00 PM', 3);

INSERT INTO users (id, name, email, password_hash, role, customer_sub_role, campus_id, id_number, phone, verification_status, status, vendor_id) VALUES
  ('u_cus', 'Mira Sen', 'mira.demo@example.edu', 'pbkdf2:sha256:600000$jEatsDemoSalt2026$86815b569d547bfd7fe7509ab7d41048c919b1bd484f0a1d6cef67e9b381d270', 'customer', 'student', 'SJP-2024-441', 'SJP-2024-441', NULL, 'approved', 'active', NULL),
  ('u_cus_ac', 'Dr. Anika Fernando', 'anika.staff@sjp.ac.lk', 'pbkdf2:sha256:600000$jEatsDemoSalt2026$86815b569d547bfd7fe7509ab7d41048c919b1bd484f0a1d6cef67e9b381d270', 'customer', 'academic', 'AC-STAFF-118', 'AC-STAFF-118', NULL, 'approved', 'active', NULL),
  ('u_cus_na', 'Ruwan Silva', 'ruwan.ops@sjp.ac.lk', 'pbkdf2:sha256:600000$jEatsDemoSalt2026$86815b569d547bfd7fe7509ab7d41048c919b1bd484f0a1d6cef67e9b381d270', 'customer', 'non-academic', 'NA-EMP-441', 'NA-EMP-441', NULL, 'approved', 'active', NULL),
  ('u_cus_pending', 'Nimal Jay', 'nimal.pending@sjp.ac.lk', 'pbkdf2:sha256:600000$jEatsDemoSalt2026$86815b569d547bfd7fe7509ab7d41048c919b1bd484f0a1d6cef67e9b381d270', 'customer', 'student', 'SJP-2025-902', 'SJP-2025-902', NULL, 'pending', 'active', NULL),
  ('u_cou', 'Ari Perera', 'ari@sjp.ac.lk', 'pbkdf2:sha256:600000$jEatsDemoSalt2026$86815b569d547bfd7fe7509ab7d41048c919b1bd484f0a1d6cef67e9b381d270', 'courier', NULL, 'SJP-2023-118', 'SJP-2023-118', NULL, 'approved', 'active', NULL),
  ('u_cou_2', 'Dilan Wick', 'dilan.rider@sjp.ac.lk', 'pbkdf2:sha256:600000$jEatsDemoSalt2026$86815b569d547bfd7fe7509ab7d41048c919b1bd484f0a1d6cef67e9b381d270', 'courier', NULL, 'SJP-2022-077', 'SJP-2022-077', NULL, 'approved', 'active', NULL),
  ('u_cou_pending', 'Kasun Dias', 'kasun.rider@sjp.ac.lk', 'pbkdf2:sha256:600000$jEatsDemoSalt2026$86815b569d547bfd7fe7509ab7d41048c919b1bd484f0a1d6cef67e9b381d270', 'courier', NULL, '199812345V', '199812345V', NULL, 'pending', 'active', NULL),
  ('u_caf', 'Central Canteen Ops', 'canteen@sjp.ac.lk', 'pbkdf2:sha256:600000$jEatsDemoSalt2026$86815b569d547bfd7fe7509ab7d41048c919b1bd484f0a1d6cef67e9b381d270', 'cafeteria', NULL, 'OPS-CC-01', 'OPS-CC-01', NULL, 'approved', 'active', 'v_cc'),
  ('u_caf_fc', 'Faculty Café Ops', 'cafe@sjp.ac.lk', 'pbkdf2:sha256:600000$jEatsDemoSalt2026$86815b569d547bfd7fe7509ab7d41048c919b1bd484f0a1d6cef67e9b381d270', 'cafeteria', NULL, 'OPS-FC-03', 'OPS-FC-03', NULL, 'approved', 'active', 'v_fc'),
  ('u_caf_bl', 'The Burger Lab Ops', 'burgerlab@sjp.ac.lk', 'pbkdf2:sha256:600000$jEatsDemoSalt2026$86815b569d547bfd7fe7509ab7d41048c919b1bd484f0a1d6cef67e9b381d270', 'cafeteria', NULL, 'OPS-BL-04', 'OPS-BL-04', NULL, 'approved', 'active', 'v_bl'),
  ('u_caf_ss', 'Slice Society Ops', 'slice@sjp.ac.lk', 'pbkdf2:sha256:600000$jEatsDemoSalt2026$86815b569d547bfd7fe7509ab7d41048c919b1bd484f0a1d6cef67e9b381d270', 'cafeteria', NULL, 'OPS-SS-05', 'OPS-SS-05', NULL, 'approved', 'active', 'v_ss'),
  ('u_caf_gb', 'Green Bowl Café Ops', 'greenbowl@sjp.ac.lk', 'pbkdf2:sha256:600000$jEatsDemoSalt2026$86815b569d547bfd7fe7509ab7d41048c919b1bd484f0a1d6cef67e9b381d270', 'cafeteria', NULL, 'OPS-GB-06', 'OPS-GB-06', NULL, 'approved', 'active', 'v_gb'),
  ('u_caf_pending', 'Faculty Lawn Stall', 'lawn.stall@sjp.ac.lk', 'pbkdf2:sha256:600000$jEatsDemoSalt2026$86815b569d547bfd7fe7509ab7d41048c919b1bd484f0a1d6cef67e9b381d270', 'cafeteria', NULL, 'OPS-LAWN-02', 'OPS-LAWN-02', NULL, 'pending', 'active', NULL),
  ('u_adm', 'J Eats Admin', 'admin@jeats.lk', 'pbkdf2:sha256:600000$jEatsDemoSalt2026$86815b569d547bfd7fe7509ab7d41048c919b1bd484f0a1d6cef67e9b381d270', 'admin', NULL, 'ADM-01', NULL, NULL, 'approved', 'active', NULL);

INSERT INTO verification_applications (id, user_id, role, extra, verification_status, submitted_at) VALUES
  ('app_cus_pending', 'u_cus_pending', 'customer', NULL, 'pending', '2026-11-16 06:12:00'),
  ('app_rid_1', 'u_cou_pending', 'courier', 'Bicycle', 'pending', '2026-11-16 05:40:00'),
  ('app_caf_1', 'u_caf_pending', 'cafeteria', 'Owner: S. Perera', 'pending', '2026-11-15 11:20:00'),
  ('app_cus_ac', 'u_cus_ac_pending', 'customer', 'Faculty of Applied Sciences', 'pending', '2026-11-15 09:05:00');

INSERT INTO verification_documents (application_id, name, kind, file_url) VALUES
  ('app_cus_pending', 'student-id-card.pdf', 'Student ID Card / Record Book', NULL),
  ('app_rid_1', 'nic-front.jpg', 'NIC / Student ID', NULL),
  ('app_rid_1', 'driving-license.pdf', 'Driving License / Vehicle Proof', NULL),
  ('app_caf_1', 'tender-approval.pdf', 'University Canteen Tender Approval Letter', NULL),
  ('app_caf_1', 'food-handling.pdf', 'Food Handling / Business Registration Certificate', NULL),
  ('app_cus_ac', 'appointment-letter.pdf', 'Academic Staff ID / Appointment Letter', NULL);

INSERT INTO menu_items (id, vendor_id, name, slug, category, description, price, image_url, rating, review_count, prep_min, prep_max, stock, max_per_order, allergens, available) VALUES
  ('m_rice_curry', 'v_cc', 'Campus Chicken Rice & Curry', 'campus-chicken-rice-curry', 'Rice & Curry', 'Your favourite campus comfort meal. Fluffy steamed rice, tender chicken curry, creamy dhal, seasonal vegetables, coconut sambol, and a crispy papadum. A generous lunch that keeps you going.', 850, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=1400&q=80', 4.8, 124, 15, 20, 18, 18, 'contains dairy and gluten. Contact the vendor for specific dietary needs.', TRUE),
  ('m_kottu', 'v_cc', 'Cheesy Chicken Kottu', 'cheesy-chicken-kottu', 'Student pick', 'Hot-plate kottu with molten cheese and campus-spice chicken.', 1100, 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=80', 4.6, 88, 18, 25, 12, 8, 'contains dairy and gluten.', TRUE),
  ('m_rolls', 'v_fc', 'Crispy Chicken Rolls', 'crispy-chicken-rolls', 'Quick bite', 'Golden rolls with a chilli dip — the between-lecture classic.', 380, 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=900&q=80', 4.5, 64, 8, 12, 24, 10, 'contains gluten.', TRUE),
  ('m_choco', 'v_fc', 'Iced Chocolate', 'iced-chocolate', 'Cool down', 'Thick iced chocolate with cream — Faculty Café favourite.', 450, 'https://images.unsplash.com/photo-1542990253-0b8be3adc3d8?auto=format&fit=crop&w=900&q=80', 4.7, 51, 5, 10, 30, 6, 'contains dairy.', TRUE),
  ('m_stringhop', 'v_cc', 'Egg Hopper Pair', 'egg-hopper-pair', 'Breakfast', 'Crisp hoppers with a runny yolk, lunu miris on the side.', 320, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80', 4.4, 39, 10, 15, 0, 4, 'contains egg.', FALSE),
  ('m_burger', 'v_bl', 'Crispy Chicken Burger', 'crispy-chicken-burger', 'Burgers', 'Crunchy chicken, house slaw and chilli mayo on a toasted bun.', 990, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80', 4.7, 73, 12, 18, 3, 6, 'contains gluten.', TRUE),
  ('m_pizza', 'v_ss', 'Margherita Pizza', 'margherita-pizza', 'Pizza', 'Wood-fired tomato, mozzarella and basil — campus late-study classic.', 1450, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80', 4.6, 41, 20, 30, 0, 4, 'contains dairy and gluten.', FALSE),
  ('m_garden', 'v_gb', 'Garden Rice & Curry', 'garden-rice-curry', 'Rice & Curry', 'Seasonal vegetables, dhal and coconut sambol on steamed rice.', 650, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80', 4.6, 58, 12, 16, 14, 8, 'may contain traces of nuts.', TRUE),
  ('m_wrap', 'v_gb', 'Grilled Chicken Wrap', 'grilled-chicken-wrap', 'Snacks', 'Charred chicken, greens and yoghurt dressing in a warm wrap.', 780, 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=900&q=80', 4.5, 36, 10, 15, 9, 6, 'contains gluten and dairy.', TRUE);

INSERT INTO wallets (user_id, balance) VALUES
  ('u_cus', 2500),
  ('u_cus_ac', 1500),
  ('u_cus_na', 1500),
  ('u_cou', 0),
  ('u_cou_2', 0);

INSERT INTO wallet_transactions (id, user_id, label, amount, type, kind, ref, created_at) VALUES
  ('w1', 'u_cus', 'Top-up · Dialog', 2000, 'credit', 'topup', 'TOP-441', '2026-11-16 09:12:00'),
  ('w2', 'u_cus', 'Campus Chicken Rice & Curry', 850, 'debit', 'payment', 'JE-1031', '2026-11-15 13:04:00');

INSERT INTO orders (id, customer_id, vendor_id, courier_id, status, fulfillment, payment_method, payment_status, payment_ref, total, delivery_fee, discount, promo_code, destination, slot, scheduled_for, pre_order, notes, cancel_reason, reviewed, created_at) VALUES
  ('JE-1042', 'u_cus', 'v_cc', NULL, 'preparing', 'pickup', 'wallet', 'paid', 'PAY-1042', 850, 0, 0, NULL, 'Central Canteen', '12:30', NULL, FALSE, NULL, NULL, FALSE, '2026-11-16 12:08:00'),
  ('JE-1043', 'u_cus', 'v_cc', NULL, 'placed', 'pickup', 'wallet', 'paid', 'PAY-1043', 1100, 0, 0, NULL, 'Central Canteen', '12:30', '2026-11-17', TRUE, NULL, NULL, FALSE, '2026-11-16 09:30:00');

INSERT INTO order_lines (order_id, item_id, qty, unit_price, spice, notes) VALUES
  ('JE-1042', 'm_rice_curry', 1, 850, 'medium', NULL),
  ('JE-1043', 'm_kottu', 1, 1100, 'medium', NULL);

INSERT INTO order_status_history (order_id, status, note, at) VALUES
  ('JE-1042', 'placed', NULL, '2026-11-16 12:08:00'),
  ('JE-1042', 'accepted', NULL, '2026-11-16 12:10:00'),
  ('JE-1042', 'preparing', NULL, '2026-11-16 12:14:00'),
  ('JE-1043', 'placed', NULL, '2026-11-16 09:30:00');

INSERT INTO ledger_entries (id, ref, party, amount, type, created_at) VALUES
  ('l1', 'JE-1042', 'Nethmi P.', 850, 'sale', '2026-11-16 12:08:00'),
  ('l2', 'TOP-441', 'Wallet', 2000, 'topup', '2026-11-16 09:12:00'),
  ('l3', 'PAY-18', 'Kasun D.', 180, 'payout', '2026-11-15 17:22:00'),
  ('l4', 'JE-1031', 'Isuru M.', 380, 'refund', '2026-11-15 17:22:00');

INSERT INTO reviews (id, item_id, user_id, order_id, author_name, rating, body, verified, created_at) VALUES
  ('r1', 'm_rice_curry', NULL, NULL, 'Nethmi P.', 5, 'My go-to after morning lectures. The portions are generous and the chicken curry is always so good!', TRUE, '2026-11-14 13:10:00'),
  ('r2', 'm_rice_curry', NULL, NULL, 'Kasun D.', 4, 'Tastes like home. Arrived warm at the faculty entrance, and the medium spice was just right.', TRUE, '2026-11-12 13:11:00');

INSERT INTO favourites (user_id, item_id) VALUES
  ('u_cus', 'm_rice_curry');

INSERT INTO notifications (id, user_id, role, title, body, href, is_read, created_at) VALUES
  ('n1', 'u_cus', NULL, 'Order JE-1042', 'Central Canteen started preparing your rice & curry.', '/customer/track?id=JE-1042', FALSE, '2026-11-16 12:14:00'),
  ('n4', NULL, 'admin', 'Applications awaiting review', 'New customer, rider and cafeteria documents were submitted.', '/admin#pending-approvals', FALSE, '2026-11-16 11:40:00');

INSERT INTO system_logs (id, level, message, created_at) VALUES
  ('log1', 'info', 'Queue broadcast Central Canteen → 14', '2026-11-16 12:11:00'),
  ('log2', 'warn', 'Stock low: Egg Hopper Pair (0)', '2026-11-16 11:58:00'),
  ('log4', 'ok', 'Wallet top-up Rs. 2,000 settled', '2026-11-16 09:12:00');

INSERT INTO stalls (id, name, faculty, cause, raised, goal) VALUES
  ('st1', 'AIESEC Bake Sale', 'Management', 'Leadership summit travel fund', 42000, 80000),
  ('st2', 'Science Union Kottu Night', 'Applied Sciences', 'Lab equipment drive', 18500, 50000);

SET FOREIGN_KEY_CHECKS = 1;
