-- Scraper Service: Supabase schema migration
-- Run this in the Supabase SQL editor

-- Integration config table
CREATE TABLE IF NOT EXISTS scraper_integrations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  org_id text NOT NULL,
  channel_id numeric NOT NULL,
  mix_id numeric,
  monitoring_mode text NOT NULL CHECK (monitoring_mode IN ('crawl', 'scrape')),
  source_url text NOT NULL,
  url_pattern text,
  sample_url text,
  card_type text NOT NULL DEFAULT 'article' CHECK (card_type IN ('article', 'longpost')),
  auto_publish boolean NOT NULL DEFAULT true,
  include_images boolean NOT NULL DEFAULT true,
  source_override text,
  teaser_style text CHECK (teaser_style IN ('STANDARD', 'SMALL_WITH_TEXT', 'SMALL_WITHOUT_TEXT', 'BIG_WITHOUT_TEXT')),
  max_pages integer NOT NULL DEFAULT 20 CHECK (max_pages > 0 AND max_pages <= 200),
  initial_backfill integer NOT NULL DEFAULT 0 CHECK (initial_backfill >= 0 AND initial_backfill <= 50),
  schedule_interval text NOT NULL DEFAULT '1h',
  is_active boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  items_found integer NOT NULL DEFAULT 0,
  items_posted integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- URL dedup table
CREATE TABLE IF NOT EXISTS processed_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  integration_id bigint NOT NULL REFERENCES scraper_integrations(id) ON DELETE CASCADE,
  url text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, url)
);

CREATE INDEX IF NOT EXISTS idx_processed_items_integration
  ON processed_items (integration_id);

CREATE INDEX IF NOT EXISTS idx_processed_items_processed_at
  ON processed_items (processed_at);

-- SCRAPE mode change detection table
CREATE TABLE IF NOT EXISTS scraper_last_content (
  integration_id bigint PRIMARY KEY REFERENCES scraper_integrations(id) ON DELETE CASCADE,
  title text,
  description text,
  image text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: enable for all tables (service key bypasses, but good practice)
ALTER TABLE scraper_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_last_content ENABLE ROW LEVEL SECURITY;

-- Allow ONLY service role full access (blocks anon key)
CREATE POLICY "Service role full access" ON scraper_integrations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON processed_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON scraper_last_content
  FOR ALL TO service_role USING (true) WITH CHECK (true);
