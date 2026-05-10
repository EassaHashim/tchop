import { config } from "../config";
import type { CardPayload } from "../types";
import { markdownToBlocks } from "../pipeline/markdown";

const AUTH_HEADERS: Record<string, string> = {
  "Authorization": `Bearer ${config.graphApi.token}`,
  "x-tchop-token": config.graphApi.token,
  "x-tchop-webapp-organisation": config.graphApi.org,
  "Cookie": `mz-account=${config.graphApi.token}`,
};

const JSON_HEADERS: Record<string, string> = {
  ...AUTH_HEADERS,
  "Content-Type": "application/json",
  "Accept": "application/json",
};

async function graphqlRequest(query: string, variables: Record<string, unknown>): Promise<any> {
  const response = await fetch(config.graphApi.url, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 401) {
    throw new AuthenticationError("Graph API authentication failed (401)");
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Graph API error (${response.status}): ${body}`);
  }

  const json = (await response.json()) as { data?: unknown; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${json.errors[0]?.message}`);
  }

  return json.data;
}

// Upload image by URL, returns image ID
async function uploadImageByUrl(imageUrl: string): Promise<string | null> {
  try {
    // Download the image
    const imgResponse = await fetch(imageUrl.replace(/&amp;/g, "&"));
    if (!imgResponse.ok) return null;
    const buffer = await imgResponse.arrayBuffer();

    // Upload to tchop
    const baseUrl = config.graphApi.url.replace(/\/api\/graphql\/webapp$/, "");
    const uploadUrl = `${baseUrl}/api/fs/upload/image?organisation=${config.graphApi.org}`;

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: "image/*" });
    formData.append("file", blob, "image");
    formData.append("template", "item");

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: formData,
    });

    if (!uploadResponse.ok) {
      console.warn(`[graphapi] Image upload failed (${uploadResponse.status})`);
      return null;
    }

    const result = (await uploadResponse.json()) as { id?: string };
    return result.id || null;
  } catch (err) {
    console.warn("[graphapi] Image upload error:", (err as Error).message);
    return null;
  }
}

const STORY_CARD_POST_MUTATION = `
mutation StoryCardPostInStory($input: StoryCardPostInStoryInput!) {
  storyCardPostInStory(input: $input) {
    payload {
      id
    }
    error {
      __typename
      ... on StoryCardPostContentValidationError { message }
      ... on StoryCardUrlUniquenessConflictError { message }
      ... on StoryCardValidationError { details { message path type } }
      ... on StoryReadOnlyAccessError { message }
      ... on UnknownError { message }
    }
  }
}
`;

export async function createArticleCard(
  mixId: number | null,
  card: CardPayload
): Promise<{ id: string }> {
  if (!mixId) {
    throw new Error("mix_id (storyId) is required to create cards in tchop");
  }

  // Upload image if present
  let gallery: Array<{ image: { id: string } }> = [];
  if (card.image) {
    const imageId = await uploadImageByUrl(card.image);
    if (imageId) {
      gallery = [{ image: { id: imageId } }];
    }
  }

  let fields: Record<string, unknown>;

  if (card.type === "longpost" && card.sourceUrl) {
    // Long Post: native content with formatted body
    // card.abstract contains the raw markdown body (from Firecrawl extract)
    // card.description has the short summary (from scrape metadata)
    const bodyMarkdown = card.abstract || "";
    const subtitle = card.description || "";

    // Convert markdown to Editor.js blocks, prepend title + subtitle
    const bodyBlocks = markdownToBlocks(bodyMarkdown);
    const ts = Date.now();
    const headerBlocks = [
      { id: `b${ts}-h`, type: "header", data: { text: card.title, level: 3 } },
      ...(subtitle ? [{ id: `b${ts}-s`, type: "paragraph", data: { text: subtitle } }] : []),
    ];
    const contentBlocks = [...headerBlocks, ...bodyBlocks];

    fields = {
      postFields: {
        title: card.title,
        headline: "",
        sourceName: card.source || domainFromUrl(card.sourceUrl),
        abstract: subtitle,
        contentBlocks,
        gallery,
      },
      status: card.autoPublish ? "PUBLISHED" : "DRAFTED",
    };
  } else {
    // Article: link card
    fields = {
      articleFields: {
        title: card.title,
        headline: "",
        abstract: card.abstract,
        url: card.sourceUrl,
        sourceName: card.source || domainFromUrl(card.sourceUrl),
        contentAuthor: card.author || undefined,
        gallery,
        styles: card.teaserStyle ? { teaserImageStyle: card.teaserStyle } : undefined,
      },
      status: card.autoPublish ? "PUBLISHED" : "DRAFTED",
    };
  }

  const input: Record<string, unknown> = {
    storyId: mixId,
    fields,
  };

  const data = (await graphqlRequest(STORY_CARD_POST_MUTATION, { input })) as {
    storyCardPostInStory: {
      payload: { id: string } | null;
      error: { __typename: string; message?: string } | null;
    };
  };

  const result = data.storyCardPostInStory;
  if (result.error) {
    const errMsg = result.error.message || result.error.__typename;
    if (result.error.__typename === "StoryCardUrlUniquenessConflictError") {
      // URL already exists in this mix, treat as dedup
      console.log(`[graphapi] URL already exists in mix ${mixId}, skipping`);
      return { id: "duplicate" };
    }
    throw new Error(`Card creation failed: ${errMsg}`);
  }

  return result.payload || { id: "unknown" };
}

function domainFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}
