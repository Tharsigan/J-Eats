-- =============================================================
-- J Eats (Japura Eats) - MySQL database schema
-- Target: MySQL 8.0+ / MariaDB 10.5+  ·  Charset: utf8mb4
--
-- Usage:
--   mysql -u root -p < database/schema.sql
--   mysql -u root -p j_eats < database/seed.sql
--
-- Table names and columns mirror the frontend types in lib/types.ts
-- so the Flask API can return rows in the shape the UI expects.
-- =============================================================

CREATE DATABASE IF NOT EXISTS j_eats
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE j_eats;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notification_reads;
DROP TABLE IF EXISTS platform_settings;
DROP TABLE IF EXISTS stalls;
DROP TABLE IF EXISTS system_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS favourites;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS ledger_entries;
DROP TABLE IF EXISTS wallet_transactions;
DROP TABLE IF EXISTS wallets;
DROP TABLE IF EXISTS job_declines;
DROP TABLE IF EXISTS courier_jobs;
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS order_lines;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS verification_documents;
DROP TABLE IF EXISTS verification_applications;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS vendors;

SET FOREIGN_KEY_CHECKS = 1;

-- -------------------------------------------------------------
-- Vendors (cafeterias / food stalls)
-- -------------------------------------------------------------
CREATE TABLE vendors (
  id            VARCHAR(36)   NOT NULL,
  name          VARCHAR(120)  NOT NULL,
  location      VARCHAR(160)  NOT NULL DEFAULT 'University campus',
  distance_km   DECIMAL(4,2)  NOT NULL DEFAULT 0.50,
  open_now      BOOLEAN       NOT NULL DEFAULT TRUE,
  closes_at     VARCHAR(10)   NOT NULL DEFAULT '6:00 PM',
  queue_length  INT           NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Users (all four roles)
-- -------------------------------------------------------------
CREATE TABLE users (
  id                   VARCHAR(36)   NOT NULL,
  name                 VARCHAR(120)  NOT NULL,
  email                VARCHAR(160)  NOT NULL,
  password_hash        VARCHAR(255)  NOT NULL,
  role                 ENUM('customer','courier','cafeteria','admin') NOT NULL,
  customer_sub_role    ENUM('student','academic','non-academic') NULL,
  campus_id            VARCHAR(40)   NULL,
  id_number            VARCHAR(40)   NULL,
  phone                VARCHAR(20)   NULL,
  verification_status  ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  status               ENUM('active','suspended') NOT NULL DEFAULT 'active',
  vendor_id            VARCHAR(36)   NULL,
  created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role, verification_status),
  KEY idx_users_id_number (id_number),
  CONSTRAINT fk_users_vendor FOREIGN KEY (vendor_id) REFERENCES vendors (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Registration / verification
-- -------------------------------------------------------------
CREATE TABLE verification_applications (
  id                   VARCHAR(36)  NOT NULL,
  user_id              VARCHAR(36)  NOT NULL,
  role                 ENUM('customer','courier','cafeteria') NOT NULL,
  extra                TEXT         NULL,
  verification_status  ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  submitted_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_applications_status (verification_status, submitted_at),
  CONSTRAINT fk_applications_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE verification_documents (
  id              INT          NOT NULL AUTO_INCREMENT,
  application_id  VARCHAR(36)  NOT NULL,
  name            VARCHAR(160) NOT NULL,
  kind            VARCHAR(80)  NOT NULL,
  file_url        VARCHAR(255) NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_documents_application FOREIGN KEY (application_id) REFERENCES verification_applications (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Menu
-- -------------------------------------------------------------
CREATE TABLE menu_items (
  id             VARCHAR(36)    NOT NULL,
  vendor_id      VARCHAR(36)    NOT NULL,
  name           VARCHAR(120)   NOT NULL,
  slug           VARCHAR(140)   NOT NULL,
  category       VARCHAR(60)    NOT NULL,
  description    TEXT           NULL,
  price          DECIMAL(10,2)  NOT NULL,
  image_url      VARCHAR(255)   NULL,
  rating         DECIMAL(2,1)   NOT NULL DEFAULT 0.0,
  review_count   INT            NOT NULL DEFAULT 0,
  prep_min       INT            NOT NULL DEFAULT 10,
  prep_max       INT            NOT NULL DEFAULT 15,
  stock          INT            NOT NULL DEFAULT 0,
  max_per_order  INT            NOT NULL DEFAULT 5,
  allergens      VARCHAR(255)   NULL,
  available      BOOLEAN        NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_slug (slug),
  KEY idx_menu_vendor (vendor_id, available),
  CONSTRAINT fk_menu_vendor FOREIGN KEY (vendor_id) REFERENCES vendors (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_menu_price CHECK (price > 0),
  CONSTRAINT chk_menu_stock CHECK (stock >= 0)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Orders
-- -------------------------------------------------------------
CREATE TABLE orders (
  id              VARCHAR(12)    NOT NULL,              -- e.g. JE-1045
  customer_id     VARCHAR(36)    NOT NULL,
  vendor_id       VARCHAR(36)    NOT NULL,
  courier_id      VARCHAR(36)    NULL,
  status          ENUM('placed','accepted','preparing','ready','out_for_delivery','delivered','cancelled')
                                 NOT NULL DEFAULT 'placed',
  fulfillment     ENUM('pickup','delivery') NOT NULL,
  payment_method  ENUM('cash','card','wallet') NOT NULL,
  payment_status  ENUM('paid','pending','refunded') NOT NULL DEFAULT 'pending',
  payment_ref     VARCHAR(20)    NULL,
  total           DECIMAL(10,2)  NOT NULL,
  delivery_fee    DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  discount        DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  promo_code      VARCHAR(20)    NULL,
  destination     VARCHAR(160)   NULL,
  slot            VARCHAR(10)    NULL,                  -- e.g. 12:30
  scheduled_for   DATE           NULL,
  pre_order       BOOLEAN        NOT NULL DEFAULT FALSE,
  notes           TEXT           NULL,
  cancel_reason   VARCHAR(255)   NULL,
  reviewed        BOOLEAN        NOT NULL DEFAULT FALSE,
  created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_customer (customer_id, created_at),
  KEY idx_orders_vendor (vendor_id, status, created_at),
  KEY idx_orders_courier (courier_id),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orders_vendor FOREIGN KEY (vendor_id) REFERENCES vendors (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orders_courier FOREIGN KEY (courier_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE order_lines (
  id          INT            NOT NULL AUTO_INCREMENT,
  order_id    VARCHAR(12)    NOT NULL,
  item_id     VARCHAR(36)    NOT NULL,
  qty         INT            NOT NULL,
  unit_price  DECIMAL(10,2)  NOT NULL,                  -- price at the time of ordering
  spice       ENUM('mild','medium','hot') NOT NULL DEFAULT 'medium',
  notes       VARCHAR(255)   NULL,
  PRIMARY KEY (id),
  KEY idx_lines_order (order_id),
  CONSTRAINT fk_lines_order FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_lines_item FOREIGN KEY (item_id) REFERENCES menu_items (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_lines_qty CHECK (qty > 0)
) ENGINE=InnoDB;

CREATE TABLE order_status_history (
  id        INT          NOT NULL AUTO_INCREMENT,
  order_id  VARCHAR(12)  NOT NULL,
  status    ENUM('placed','accepted','preparing','ready','out_for_delivery','delivered','cancelled') NOT NULL,
  note      VARCHAR(255) NULL,
  at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_history_order (order_id, at),
  CONSTRAINT fk_history_order FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Delivery
-- -------------------------------------------------------------
CREATE TABLE courier_jobs (
  id            VARCHAR(36)    NOT NULL,
  order_id      VARCHAR(12)    NOT NULL,
  courier_id    VARCHAR(36)    NULL,                    -- NULL while the job is open
  pickup_from   VARCHAR(160)   NOT NULL,
  drop_to       VARCHAR(160)   NOT NULL,
  payout        DECIMAL(10,2)  NOT NULL,
  distance_m    INT            NOT NULL DEFAULT 0,
  items         INT            NOT NULL DEFAULT 1,
  status        ENUM('open','accepted','picked','delivered','cancelled') NOT NULL DEFAULT 'open',
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at  DATETIME       NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_jobs_order (order_id),
  KEY idx_jobs_status (status, created_at),
  KEY idx_jobs_courier (courier_id, status),
  CONSTRAINT fk_jobs_order FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_jobs_courier FOREIGN KEY (courier_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE job_declines (
  job_id      VARCHAR(36)  NOT NULL,
  courier_id  VARCHAR(36)  NOT NULL,
  PRIMARY KEY (job_id, courier_id),
  CONSTRAINT fk_declines_job FOREIGN KEY (job_id) REFERENCES courier_jobs (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_declines_courier FOREIGN KEY (courier_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Money
-- -------------------------------------------------------------
CREATE TABLE wallets (
  user_id  VARCHAR(36)    NOT NULL,
  balance  DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_wallets_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_wallet_balance CHECK (balance >= 0)
) ENGINE=InnoDB;

CREATE TABLE wallet_transactions (
  id          VARCHAR(36)    NOT NULL,
  user_id     VARCHAR(36)    NOT NULL,
  label       VARCHAR(160)   NOT NULL,
  amount      DECIMAL(10,2)  NOT NULL,
  type        ENUM('credit','debit') NOT NULL,
  kind        ENUM('topup','payment','refund','payout','earning','donation','withdrawal') NOT NULL,
  ref         VARCHAR(40)    NULL,
  created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wallet_txn_user (user_id, created_at),
  CONSTRAINT fk_wallet_txn_wallet FOREIGN KEY (user_id) REFERENCES wallets (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_wallet_txn_amount CHECK (amount > 0)
) ENGINE=InnoDB;

CREATE TABLE ledger_entries (
  id          VARCHAR(36)    NOT NULL,
  ref         VARCHAR(40)    NOT NULL,                  -- order id, top-up ref, stall id …
  party       VARCHAR(120)   NOT NULL,
  amount      DECIMAL(10,2)  NOT NULL,
  type        ENUM('sale','payout','topup','refund','donation') NOT NULL,
  created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ledger_type (type, created_at),
  KEY idx_ledger_ref (ref)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Feedback
-- -------------------------------------------------------------
CREATE TABLE reviews (
  id          VARCHAR(36)  NOT NULL,
  item_id     VARCHAR(36)  NOT NULL,
  user_id     VARCHAR(36)  NULL,
  order_id    VARCHAR(12)  NULL,
  author_name VARCHAR(120) NOT NULL,                  -- shown on the review, e.g. "Nethmi P."
  rating      TINYINT      NOT NULL,
  body        TEXT         NOT NULL,
  verified    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reviews_item (item_id, created_at),
  CONSTRAINT fk_reviews_item FOREIGN KEY (item_id) REFERENCES menu_items (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE TABLE favourites (
  user_id  VARCHAR(36)  NOT NULL,
  item_id  VARCHAR(36)  NOT NULL,
  PRIMARY KEY (user_id, item_id),
  CONSTRAINT fk_favourites_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_favourites_item FOREIGN KEY (item_id) REFERENCES menu_items (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Notifications & logs
-- -------------------------------------------------------------
-- A notification targets ONE user (user_id set) or EVERY user of a role
-- (user_id NULL, role set). is_read is used for single-user notifications.
CREATE TABLE notifications (
  id          VARCHAR(36)  NOT NULL,
  user_id     VARCHAR(36)  NULL,
  role        ENUM('customer','courier','cafeteria','admin') NULL,
  title       VARCHAR(160) NOT NULL,
  body        TEXT         NOT NULL,
  href        VARCHAR(255) NULL,
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user (user_id, created_at),
  KEY idx_notifications_role (role, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
  -- The API must set user_id OR role. (MySQL does not allow a CHECK on a
  -- column that also has a cascading foreign key, so this is enforced in Flask.)
) ENGINE=InnoDB;

-- Who has read a role-wide broadcast (the frontend's `readBy` list).
CREATE TABLE notification_reads (
  notification_id  VARCHAR(36)  NOT NULL,
  user_id          VARCHAR(36)  NOT NULL,
  read_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id),
  CONSTRAINT fk_reads_notification FOREIGN KEY (notification_id) REFERENCES notifications (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reads_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE system_logs (
  id          VARCHAR(36)  NOT NULL,
  level       ENUM('info','warn','ok','error') NOT NULL DEFAULT 'info',
  message     TEXT         NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_logs_created (created_at),
  KEY idx_logs_level (level, created_at)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Fundraising stalls
-- -------------------------------------------------------------
CREATE TABLE stalls (
  id       VARCHAR(36)    NOT NULL,
  name     VARCHAR(120)   NOT NULL,
  faculty  VARCHAR(120)   NOT NULL,
  cause    VARCHAR(255)   NOT NULL,
  raised   DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  goal     DECIMAL(10,2)  NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Platform settings (single row, id = 1)
-- -------------------------------------------------------------
CREATE TABLE platform_settings (
  id                         TINYINT        NOT NULL DEFAULT 1,
  delivery_fee               DECIMAL(10,2)  NOT NULL DEFAULT 100.00,
  rider_payout               DECIMAL(10,2)  NOT NULL DEFAULT 150.00,
  cash_cutoff_hour           TINYINT        NOT NULL DEFAULT 11,
  ordering_open              BOOLEAN        NOT NULL DEFAULT TRUE,
  max_active_jobs_per_rider  TINYINT        NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  CONSTRAINT chk_settings_single_row CHECK (id = 1),
  CONSTRAINT chk_settings_cutoff CHECK (cash_cutoff_hour BETWEEN 0 AND 23)
) ENGINE=InnoDB;
