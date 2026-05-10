export type SourceScope = "all_channels" | "one_channel" | "one_mix";
export type ContentFocus = "balanced" | "discussions" | "new_content" | "engagement";
export type Tone = "neutral" | "enthusiastic" | "formal" | "casual" | "analytical";
export type TargetLength = "1min" | "2min" | "3min" | "5min" | "10min" | "adaptive";
export type Language = "de" | "en";
export type RunStatus = "running" | "completed" | "failed" | "skipped_no_content";

export interface AudioIntegration {
  id: number;
  name: string;
  org_id: string;

  // Source scope
  source_scope: SourceScope;
  source_channel_id: number | null;
  source_mix_id: number | null;

  // Target
  target_channel_id: number;
  target_mix_id: number;

  // Audio settings
  voice_id: string;
  language: Language;
  target_length: TargetLength;

  // Summary settings
  summary_period: string;
  tone: Tone;
  additional_prompt: string | null;
  context_card_id: number | null;
  content_focus: ContentFocus;
  min_activity_threshold: number;
  exclude_mixes: string | null;

  // Card template
  card_title_template: string;
  card_image_url: string | null;

  // Schedule
  schedule: string;
  timezone: string;

  // Publishing
  auto_publish: boolean;
  push_notification_text: string | null;

  // State
  is_active: boolean;
  last_run_at: string | null;
  last_error: string | null;
  runs_completed: number;
  created_at: string;
}

export interface AudioRun {
  id: number;
  integration_id: number;
  started_at: string;
  completed_at: string | null;
  status: RunStatus;
  cards_gathered: number;
  comments_gathered: number;
  script_text: string | null;
  script_word_count: number | null;
  audio_duration_seconds: number | null;
  claude_input_tokens: number | null;
  claude_output_tokens: number | null;
  elevenlabs_characters: number | null;
  card_id: string | null;
  error: string | null;
}

export interface GatheredContent {
  period: { from: Date; to: Date };
  orgName: string;
  stats: {
    totalCards: number;
    totalComments: number;
    totalReactions: number;
    totalViews: number;
  };
  cards: GatheredCard[];
  topComments: GatheredComment[];
}

export interface GatheredCard {
  id: number;
  type: string;
  title: string;
  abstract?: string;
  postedAt: string;
  commentsCount: number;
  reactions: Array<{ name: string; count: number }>;
  author?: string;
  storyTitle?: string;
}

export interface GatheredComment {
  content: string;
  author: string;
  reactions: number;
  cardTitle: string;
  createdAt: string;
}

export interface ScriptResult {
  text: string;
  wordCount: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AudioResult {
  buffer: ArrayBuffer;
  characters: number;
  durationEstimate: number;
}

/** Voice presets for the UI */
export const VOICE_PRESETS = [
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel", gender: "male", style: "Steady Broadcaster" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George", gender: "male", style: "Warm Storyteller" },
  { id: "nPczCjzI2devNBz1zQrb", label: "Brian", gender: "male", style: "Deep, Resonant" },
  { id: "IKne3meq5aSn9XLyUdCD", label: "Charlie", gender: "male", style: "Confident, Energetic" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", gender: "female", style: "Mature, Reassuring" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice", gender: "female", style: "Clear Educator" },
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily", gender: "female", style: "Warm, Professional" },
  { id: "SAz9YHcvj6GT2YYXdXww", label: "River", gender: "neutral", style: "Relaxed, Informative" },
] as const;

/** Words per minute by language */
export const WPM: Record<Language, number> = { de: 130, en: 150 };

/** Target word counts by length and language */
export function targetWordCount(length: TargetLength, language: Language): { min: number; max: number } | null {
  if (length === "adaptive") return null;
  const minutes = parseInt(length);
  const wpm = WPM[language];
  return { min: Math.round(wpm * minutes * 0.85), max: Math.round(wpm * minutes * 1.15) };
}

/** TTS model derived from language */
export function ttsModel(language: Language): string {
  return language === "en" ? "eleven_v3" : "eleven_multilingual_v2";
}
