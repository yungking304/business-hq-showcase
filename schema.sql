CREATE TABLE IF NOT EXISTS niches (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL UNIQUE,
 demand REAL, competition REAL, margin REAL, longevity REAL, simplicity REAL,
 evidence TEXT NOT NULL DEFAULT '', evidence_url TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'research', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS drafts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 niche_id INTEGER, product_name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 selling_price REAL NOT NULL DEFAULT 29.99, production_cost REAL NOT NULL DEFAULT 12,
 shipping_cost REAL NOT NULL DEFAULT 4.5, other_cost REAL NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(niche_id) REFERENCES niches(id)
);
CREATE TABLE IF NOT EXISTS expenses (
 id INTEGER PRIMARY KEY AUTOINCREMENT, service TEXT NOT NULL, amount REAL NOT NULL,
 month TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'open', day TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(name,day)
);
CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, detail TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO niches (name,evidence,status) VALUES
 ('Personalized pet gifts','Hypothesis only — obtain compliant search evidence','research'),
 ('Book-lover accessories','Hypothesis only — obtain compliant search evidence','research'),
 ('Profession-specific gifts','Hypothesis only — obtain compliant search evidence','research'),
 ('Minimalist home prints','Hypothesis only — obtain compliant search evidence','research'),
 ('Hobby-themed apparel','Hypothesis only — obtain compliant search evidence','research');