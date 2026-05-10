export type MonitoringMode = "crawl" | "scrape";
export type CardType = "article" | "longpost";
export type TeaserStyle = "STANDARD" | "SMALL_WITH_TEXT" | "SMALL_WITHOUT_TEXT" | "BIG_WITHOUT_TEXT";

export interface Integration {
  id: number;
  name: string;
  org_id: string;
  channel_id: number;
  mix_id: number | null;
  monitoring_mode: MonitoringMode;
  source_url: string;
  url_pattern: string | null;
  search_terms: string | null;
  sample_url: string | null;
  card_type: CardType;
  auto_publish: boolean;
  include_images: boolean;
  source_override: string | null;
  teaser_style: TeaserStyle | null;
  max_pages: number;
  initial_backfill: number;
  schedule_interval: string;
  is_active: boolean;
  last_run_at: string | null;
  items_found: number;
  items_posted: number;
  last_error: string | null;
  created_at: string;
}

export interface ExtractedContent {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  source: string | null;
  publishedDate: string | null;
  markdown: string | null;
  author: string | null;
}

export interface PreviewRequest {
  monitoring_mode: MonitoringMode;
  source_url: string;
  url_pattern?: string;
  max_pages?: number;
  search_terms?: string | null;
  sample_url?: string | null;
}

export interface PreviewResponse {
  items: ExtractedContent[];
  count: number;
  mode: MonitoringMode;
}

export interface CardPayload {
  type: CardType;
  title: string;
  abstract?: string;
  description?: string;
  image?: string;
  sourceUrl?: string;
  source?: string;
  author?: string;
  teaserStyle?: TeaserStyle;
  autoPublish: boolean;
  blocks?: LongPostBlock[];
}

export interface LongPostBlock {
  type: "heading" | "paragraph" | "list" | "image" | "quote" | "delimiter" | "code";
  data: Record<string, unknown>;
}
