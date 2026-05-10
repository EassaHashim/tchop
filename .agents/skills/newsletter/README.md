# Newsletter Skill

Automates monthly tchop.io newsletter production. Reads a Notion briefing, generates polished EN + DE copy via Claude Opus 4.6, fills the MJML template, and saves ready-to-import files.

## How to use

1. Fill a Notion briefing page with this month's content
2. Run `/newsletter` in Claude Code
3. Provide the Notion page URL or ID when prompted
4. Two MJML files are saved to `newsletter-editions/`
5. Import the ZIP files into Loops.so manually

## Notion briefing structure

The briefing page should use H2 headings with 2-column tables (Field | Value) underneath:

| Section | Fields |
|---------|--------|
| Intro | Edition label, headline idea, body notes |
| Feature 1-3 | Title, URL, description, image URL |
| Blog 1-3 | Title, URL, category, excerpt |
| Recommended Reads 1-3 | Title, URL, description (optional) |
| CTA | Headline, subtext |
| Meta | Sender name |

## Output

```
newsletter-editions/
  tchop-newsletter-YYYY-MM-en.mjml
  tchop-newsletter-YYYY-MM-de.mjml
```

## Safety

- Never sends, schedules, or publishes
- Never overwrites the source template (`template.mjml`)
- Loops system tags are left untouched

## Dependencies

- Notion MCP (for reading the briefing)
- DataForSEO MCP (for fetching page content when only URLs are provided)
- Chrome MCP (optional, for Loops.so browser automation)
