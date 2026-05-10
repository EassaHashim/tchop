import type { ExtractedContent, CardPayload, Integration, TeaserStyle } from "../types";

export function buildCard(integration: Integration, content: ExtractedContent): CardPayload {
  const options = {
    autoPublish: integration.auto_publish,
    includeImages: integration.include_images,
    sourceOverride: integration.source_override,
    teaserStyle: integration.teaser_style,
  };
  return integration.card_type === "longpost"
    ? toLongPostCard(content, options)
    : toArticleCard(content, options);
}

export function toArticleCard(
  content: ExtractedContent,
  options: { autoPublish: boolean; includeImages: boolean; sourceOverride: string | null; teaserStyle: TeaserStyle | null }
): CardPayload {
  const hasImage = options.includeImages && !!content.image;
  return {
    type: "article",
    title: content.title || content.url,
    abstract: content.description || undefined,
    image: hasImage ? content.image || undefined : undefined,
    sourceUrl: content.url,
    source: options.sourceOverride || content.source || undefined,
    author: content.author || undefined,
    teaserStyle: hasImage && options.teaserStyle ? options.teaserStyle : undefined,
    autoPublish: options.autoPublish,
  };
}

export function toLongPostCard(
  content: ExtractedContent,
  options: { autoPublish: boolean; includeImages: boolean; sourceOverride: string | null }
): CardPayload {
  return {
    type: "longpost",
    title: content.title || content.url,
    abstract: content.markdown || undefined,
    description: content.description || undefined,
    image: options.includeImages ? content.image || undefined : undefined,
    source: options.sourceOverride || content.source || undefined,
    author: content.author || undefined,
    sourceUrl: content.url,
    autoPublish: options.autoPublish,
  };
}
