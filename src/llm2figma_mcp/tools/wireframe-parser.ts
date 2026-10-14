import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import type { SendCommandFn } from "../types.js";

// --- Interfaces ---

type Zone = "no_brand" | "brand_tinted" | "full_brand";

interface ParsedSection {
  template: string;
  zone: Zone;
  props: Record<string, any>;
  order: number;
  sourceElement: string;
}

interface ParseResult {
  pageTitle: string;
  persona: string;
  variant: string;
  sections: ParsedSection[];
  totalSections: number;
  estimatedTokenSavings: string;
}

// --- Zone detection ---

function detectZone(html: string): Zone {
  // Full brand: dark gradient backgrounds, welcome banners with dark bg
  if (
    html.includes("#1e2a3a") ||
    html.includes("#131925") ||
    html.includes("#000000") ||
    html.includes("ds-welcome-banner") ||
    (html.includes("background:linear-gradient") && html.includes("#1e2a3a")) ||
    (html.includes("background:var(--wf-ink)") && html.includes("color:rgba(255,255,255"))
  ) {
    return "full_brand";
  }
  // Brand tinted: accent-bordered elements, KPI cards, progress elements with accent
  if (
    html.includes("ds-kpi") ||
    html.includes("--wf-accent") ||
    (html.includes("border-left") && html.includes("accent")) ||
    html.includes("border:2px solid var(--wf-accent)") ||
    html.includes("border-top:3px solid var(--wf-accent)")
  ) {
    return "brand_tinted";
  }
  return "no_brand";
}

// --- Template detection ---

function detectTemplate(html: string, comment: string): string {
  const c = comment.toLowerCase();
  const h = html.toLowerCase();

  // Welcome / hero banners
  if (c.includes("welcome") || c.includes("hero") || h.includes("ds-welcome-banner")) {
    // Day N style (accent border, no dark gradient) vs Day 0 (dark gradient)
    if (html.includes("background:linear-gradient") || html.includes("ds-welcome-banner")) {
      return "hero_takeover";
    }
    return "welcome_banner_slds";
  }

  // Getting Started / onboarding checklist
  if (c.includes("checklist") || c.includes("getting started") || c.includes("setup")) {
    return "slds_checklist";
  }

  // KPI / metrics sections
  if (c.includes("kpi") || c.includes("metrics") || c.includes("statistics") || c.includes("your statistics")) {
    return "kpi_cards";
  }

  // Data tables
  if (h.includes("ds-data-table") || h.includes("wf-table") || h.includes("<table")) {
    return "slds_data_table";
  }

  // Progress cards / certification progress
  if (c.includes("progress") || c.includes("certification progress")) {
    return "progress_card";
  }

  // Empty states (check before alerts -- empty state sections often contain ds-alert EC notes)
  if (c.includes("empty state") || h.includes("ds-empty-state")) {
    return "slds_empty_state";
  }

  // Alerts / notifications / banners (standalone alert, not just an EC note alongside real content)
  if (h.includes("ds-alert") && !h.includes("ds-card") && !h.includes("ds-empty-state") && !h.includes("ds-dashboard-grid")) {
    return "slds_alert";
  }

  // Sidebar / quick actions
  if (c.includes("quick action")) {
    return "quick_actions";
  }

  // Sidebar column wrapper
  if (c.includes("sidebar") || c.includes("right column")) {
    return "slds_sidebar";
  }

  // Deadlines
  if (c.includes("deadline") || c.includes("upcoming deadline")) {
    return "deadline_cards";
  }

  // Activity feeds / recent activity
  if (c.includes("activity") || c.includes("recent activity")) {
    return "activity_feed";
  }

  // PSM contact card
  if (c.includes("psm") || c.includes("partner success") || c.includes("contact")) {
    return "psm_contact_card";
  }

  // Program announcements / news / updates
  if (c.includes("announcement") || c.includes("news") || c.includes("program update") || c.includes("update")) {
    return "slds_alert_list";
  }

  // Notification banners (MFA, countersign, etc.)
  if (c.includes("mfa") || c.includes("nag") || c.includes("countersign") || c.includes("notification")) {
    return "notification_banner";
  }

  // Programs / enrollment sections
  if (c.includes("program") || c.includes("portal") || c.includes("enrollment")) {
    return "slds_card_list";
  }

  // Deals section
  if (c.includes("deal")) {
    if (h.includes("ds-empty-state")) {
      return "slds_empty_state";
    }
    return "slds_card_list";
  }

  // Training section
  if (c.includes("training")) {
    if (h.includes("ds-empty-state")) {
      return "slds_empty_state";
    }
    return "slds_card_list";
  }

  // Left/main column wrapper -- not a section itself, skip
  if (c.includes("left column") || c.includes("main content") || c.includes("main column")) {
    return "__column_wrapper__";
  }

  // Dashboard grid wrapper -- not a section itself
  if (c.includes("main grid") || c.includes("dashboard grid")) {
    return "__grid_wrapper__";
  }

  // Default: generic card list
  return "slds_card_list";
}

// --- Text extraction helpers ---

function extractText(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

function extractAllText(html: string, tag: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "gi");
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text.length > 0) {
      results.push(text);
    }
  }
  return results;
}

function extractLinks(html: string): Array<{ text: string; href: string }> {
  const results: Array<{ text: string; href: string }> = [];
  const regex = /<a[^>]+href="([^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[2].trim().replace(/&#\d+;/g, "").replace(/&amp;/g, "&").trim();
    if (text.length > 0) {
      results.push({ text, href: match[1] });
    }
  }
  return results;
}

function countElements(html: string, selector: string): number {
  const regex = new RegExp(selector, "gi");
  const matches = html.match(regex);
  return matches ? matches.length : 0;
}

function extractStatusBadges(html: string): string[] {
  const results: string[] = [];
  const regex = /ds-status-badge[^"]*"[^>]*>([^<]+)</gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

// --- Props extraction per template ---

function extractProps(html: string, template: string, comment: string): Record<string, any> {
  const props: Record<string, any> = {};

  switch (template) {
    case "hero_takeover":
    case "welcome_banner_slds": {
      props.heading = extractText(html, "h1");
      const paragraphs = extractAllText(html, "p");
      if (paragraphs.length > 0) props.subtitle = paragraphs[0];
      if (paragraphs.length > 1) props.meta = paragraphs[1];
      const links = extractLinks(html);
      if (links.length > 0) props.cta = links[0];
      // Check for role badge
      const badgeMatch = html.match(/border-radius:\s*20px[^>]*>([^<]+)/);
      if (badgeMatch) props.roleBadge = badgeMatch[1].trim();
      // Check for tier progress indicator
      const tierMatch = html.match(/font-size:\s*28px[^>]*>([^<]+)/);
      if (tierMatch) props.tierProgress = tierMatch[1].trim();
      // Welcome banner sub/meta for admin variant
      const subMatch = html.match(/ds-welcome-banner-sub"[^>]*>([^<]+)/);
      if (subMatch) props.subtitle = subMatch[1].trim().replace(/&middot;/g, "\u00B7");
      const metaMatch = html.match(/ds-welcome-banner-meta"[^>]*>([^<]+)/);
      if (metaMatch) props.meta = metaMatch[1].trim();
      // Progress bar in banner
      if (html.includes("ds-progress-bar")) {
        const fillMatch = html.match(/width:\s*(\d+)%/);
        if (fillMatch) props.setupProgress = parseInt(fillMatch[1], 10);
      }
      break;
    }

    case "slds_checklist": {
      // Count checklist items
      const gsItems = countElements(html, "gs-item|gs-check|class=\"gs-item\"");
      const listItems = extractAllText(html, "p").filter(
        (p) => p.length > 5 && p.length < 80 && /^[A-Z]/.test(p)
      );
      props.totalItems = gsItems > 0 ? gsItems : listItems.length;
      // Extract checklist item titles (the bold text inside each gs-item)
      const itemTitles: string[] = [];
      const titleRegex = /font-weight:\s*600[^>]*>([^<]+)</gi;
      let titleMatch;
      while ((titleMatch = titleRegex.exec(html)) !== null) {
        const t = titleMatch[1].trim();
        if (t.length > 5 && t.length < 80) itemTitles.push(t);
      }
      if (itemTitles.length > 0) props.items = itemTitles;
      // Check for progress header text
      const headerMatch = html.match(/gs-header-title[^>]*>([^<]+)/);
      if (headerMatch) props.headerText = headerMatch[1].trim();
      // Look for setup steps (admin variant)
      const stepCount = countElements(html, 'role="listitem"');
      if (stepCount > 0) props.totalSteps = stepCount;
      break;
    }

    case "kpi_cards": {
      // Extract highlight rows for sidebar stats
      const labels = extractAllText(html, "span");
      const hlLabels: string[] = [];
      const hlRegex = /ds-hl-label[^>]*>([^<]+)/gi;
      let hlMatch;
      while ((hlMatch = hlRegex.exec(html)) !== null) {
        hlLabels.push(hlMatch[1].trim());
      }
      const hlValues: string[] = [];
      const hvRegex = /ds-hl-value[^>]*>([^<]+)/gi;
      let hvMatch;
      while ((hvMatch = hvRegex.exec(html)) !== null) {
        hlValues.push(hvMatch[1].trim());
      }
      if (hlLabels.length > 0) {
        props.stats = hlLabels.map((label, i) => ({
          label,
          value: hlValues[i] || "",
        }));
      }
      break;
    }

    case "slds_data_table": {
      props.columns = countElements(html, "<th");
      props.rows = countElements(html, "<tr") - 1; // subtract header row
      if (props.rows < 0) props.rows = countElements(html, "<tr");
      const headings = extractAllText(html, "th");
      if (headings.length > 0) props.columnHeaders = headings;
      break;
    }

    case "progress_card": {
      props.heading = extractText(html, "h3") || extractText(html, "h2");
      const progressMatch = html.match(/width:\s*(\d+)%/);
      if (progressMatch) props.progressPercent = parseInt(progressMatch[1], 10);
      const countMatch = html.match(/(\d+)\s*(?:of|\/)\s*(\d+)/);
      if (countMatch) {
        props.completed = parseInt(countMatch[1], 10);
        props.total = parseInt(countMatch[2], 10);
      }
      const captions = extractAllText(html, "p").filter((p) => p.length > 10);
      if (captions.length > 0) props.description = captions[0];
      break;
    }

    case "slds_alert": {
      const alertText = extractAllText(html, "span");
      if (alertText.length > 0) props.message = alertText.join(" ").substring(0, 200);
      // Detect alert variant
      if (html.includes("alert--error")) props.variant = "error";
      else if (html.includes("alert--warning")) props.variant = "warning";
      else if (html.includes("alert--success")) props.variant = "success";
      else props.variant = "info";
      break;
    }

    case "quick_actions": {
      const actionItems: Array<{ title: string; caption?: string; href?: string }> = [];
      // Match bold titles inside action cards
      const boldTexts = extractAllText(html, "p");
      const actionLinks = extractLinks(html);
      // Group by action card pairs (title + caption)
      for (let i = 0; i < boldTexts.length; i += 2) {
        const item: { title: string; caption?: string; href?: string } = {
          title: boldTexts[i],
        };
        if (i + 1 < boldTexts.length) item.caption = boldTexts[i + 1];
        // Find matching link
        const link = actionLinks.find((l) => l.text.includes(boldTexts[i]) || boldTexts[i].includes(l.text));
        if (link) item.href = link.href;
        actionItems.push(item);
      }
      if (actionItems.length > 0) props.actions = actionItems;
      // Also try h4-based quick actions (Day N variant)
      if (actionItems.length === 0) {
        const h4Titles = extractAllText(html, "div");
        const h4Actions: Array<{ title: string; caption?: string }> = [];
        const captionRegex = /ds-caption[^>]*>([^<]+)/gi;
        const captions: string[] = [];
        let capMatch;
        while ((capMatch = captionRegex.exec(html)) !== null) {
          captions.push(capMatch[1].trim());
        }
        const h4Regex = /ds-h4[^>]*>([^<]+)/gi;
        const titles: string[] = [];
        let h4Match;
        while ((h4Match = h4Regex.exec(html)) !== null) {
          titles.push(h4Match[1].trim());
        }
        for (let i = 0; i < titles.length; i++) {
          h4Actions.push({
            title: titles[i],
            caption: captions[i] || undefined,
          });
        }
        if (h4Actions.length > 0) props.actions = h4Actions;
      }
      break;
    }

    case "slds_empty_state": {
      props.heading = extractText(html, "p");
      const emptyTexts = extractAllText(html, "p");
      if (emptyTexts.length > 1) props.description = emptyTexts[1];
      const links = extractLinks(html);
      if (links.length > 0) props.primaryCta = links[0];
      if (links.length > 1) props.secondaryCta = links[1];
      break;
    }

    case "deadline_cards": {
      const deadlines: Array<{ title: string; status?: string; description?: string }> = [];
      const h4Titles = extractAllText(html, "h4");
      const statuses = extractStatusBadges(html);
      const descriptions = extractAllText(html, "p").filter((p) => p.length > 5);
      for (let i = 0; i < h4Titles.length; i++) {
        deadlines.push({
          title: h4Titles[i],
          status: statuses[i] || undefined,
          description: descriptions[i] || undefined,
        });
      }
      if (deadlines.length > 0) props.deadlines = deadlines;
      break;
    }

    case "activity_feed": {
      props.heading = extractText(html, "h3") || "Recent Activity";
      props.rows = countElements(html, "<tr");
      const links = extractLinks(html);
      if (links.length > 0) props.viewAllLink = links[links.length - 1];
      break;
    }

    case "psm_contact_card": {
      // Extract PSM name and message
      const texts = extractAllText(html, "p");
      const psmName = texts.find((t) => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(t));
      if (psmName) props.psmName = psmName;
      const quote = texts.find((t) => t.startsWith('"') || t.startsWith("\u201C"));
      if (quote) props.message = quote;
      // Also look for em dash attribution pattern
      const attrMatch = texts.find((t) => t.includes("\u2014") || t.includes("--"));
      if (attrMatch) props.attribution = attrMatch;
      const links = extractLinks(html);
      if (links.length > 0) props.cta = links[0];
      break;
    }

    case "slds_alert_list": {
      const alerts: Array<{ variant: string; text: string }> = [];
      const alertRegex = /ds-alert\s+ds-alert--(\w+)[^>]*>([\s\S]*?)(?=<\/div>\s*(?:<div class="ds-alert|$))/gi;
      let alertMatch;
      while ((alertMatch = alertRegex.exec(html)) !== null) {
        const variant = alertMatch[1];
        // Extract text content from the alert, stripping HTML tags
        const innerHtml = alertMatch[2];
        const text = innerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 200);
        if (text.length > 5) {
          alerts.push({ variant, text });
        }
      }
      if (alerts.length > 0) {
        props.alerts = alerts;
      } else {
        // Fallback: count alerts
        props.alertCount = countElements(html, "ds-alert");
      }
      break;
    }

    case "notification_banner": {
      props.heading = extractText(html, "div");
      const links = extractLinks(html);
      if (links.length > 0) props.cta = links[0];
      // Detect type
      if (html.includes("mfa") || html.toLowerCase().includes("multi-factor")) {
        props.bannerType = "mfa_nag";
      } else if (html.includes("countersign")) {
        props.bannerType = "countersign_success";
      }
      break;
    }

    case "slds_card_list":
    default: {
      props.heading = extractText(html, "h2") || extractText(html, "h3");
      const subItems = extractAllText(html, "p").filter((p) => p.length > 5);
      if (subItems.length > 0) props.itemCount = Math.min(subItems.length, 20);
      const links = extractLinks(html);
      if (links.length > 0) props.headerLink = links[0];
      const badges = extractStatusBadges(html);
      if (badges.length > 0) props.statusBadges = badges;
      break;
    }
  }

  return props;
}

// --- Persona detection from title ---

function detectPersona(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("admin")) return "admin";
  if (t.includes("pm") || t.includes("partner manager") || t.includes("manager home")) return "pm";
  // Default: rep persona for sales reps, deal registration users, etc.
  return "rep";
}

// --- Variant detection from title ---

function detectVariant(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("day 0") || t.includes("day0") || t.includes("new user") || t.includes("first login")) {
    return "day0";
  }
  return "dayN";
}

// --- Comment-based section splitting ---

interface RawSection {
  comment: string;
  html: string;
}

function splitBySections(html: string): RawSection[] {
  const sections: RawSection[] = [];

  // Remove the <head> and <header> blocks, <footer>, <script>, and design-notes to focus on <main> content
  let body = html;

  // Extract just the <main> content if present
  const mainMatch = body.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    body = mainMatch[1];
  } else {
    // Fallback: try ds-page-container
    const containerMatch = body.match(/class="ds-page-container"[^>]*>([\s\S]*?)(?=<footer|<div class="wf-design-notes"|<script)/i);
    if (containerMatch) {
      body = containerMatch[1];
    }
  }

  // Remove design notes hidden block
  body = body.replace(/<div class="wf-design-notes"[\s\S]*?<\/div>\s*$/i, "");

  // Split by HTML comments
  const commentRegex = /<!--\s*(.*?)\s*-->/g;
  const comments: Array<{ text: string; index: number }> = [];
  let match;
  while ((match = commentRegex.exec(body)) !== null) {
    comments.push({ text: match[1].trim(), index: match.index + match[0].length });
  }

  if (comments.length === 0) {
    // No comments -- treat entire body as one section
    sections.push({ comment: "Page content", html: body });
    return sections;
  }

  for (let i = 0; i < comments.length; i++) {
    const start = comments[i].index;
    const end = i + 1 < comments.length ? body.indexOf(`<!--`, start) : body.length;
    const sectionHtml = body.substring(start, end).trim();

    if (sectionHtml.length > 10) {
      sections.push({
        comment: comments[i].text,
        html: sectionHtml,
      });
    }
  }

  return sections;
}

// --- Main parse function ---

export function parseWireframe(filePath: string): ParseResult {
  // M1 fix: validate path — must be absolute, no directory traversal
  const resolved = path.resolve(filePath);
  if (!path.isAbsolute(filePath) || filePath.split(path.sep).includes("..")) {
    throw new Error(`Invalid file path: must be absolute with no '..' traversal`);
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, "utf-8");
  const fileSize = Buffer.byteLength(raw, "utf-8");

  // Extract title
  const titleMatch = raw.match(/<title>([^<]+)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].trim() : "Unknown";
  // Clean title: remove "· Equinix PCP Partner Portal" suffix
  const pageTitle = rawTitle.replace(/\s*[·\-]\s*Equinix PCP Partner Portal\s*$/i, "").trim();

  const persona = detectPersona(rawTitle);
  const variant = detectVariant(rawTitle);

  // Split into sections
  const rawSections = splitBySections(raw);

  // Filter out structural wrappers and convert to ParsedSections
  const sections: ParsedSection[] = [];
  let order = 0;

  for (const rawSection of rawSections) {
    const template = detectTemplate(rawSection.html, rawSection.comment);

    // Skip structural wrappers (column markers, grid wrappers)
    if (template.startsWith("__")) continue;

    // Skip closing tag fragments and very short non-content sections
    if (rawSection.html.replace(/<[^>]+>/g, "").trim().length < 5) continue;

    const zone = detectZone(rawSection.html);
    const props = extractProps(rawSection.html, template, rawSection.comment);

    sections.push({
      template,
      zone,
      props,
      order: order++,
      sourceElement: `<!-- ${rawSection.comment} -->`,
    });
  }

  // Estimate token savings: raw HTML file tokens vs compact JSON output
  // Rough heuristic: 1 token ~= 4 chars for HTML, output is ~5% of input
  const inputTokens = Math.round(fileSize / 4);
  const outputJson = JSON.stringify({ pageTitle, persona, variant, sections });
  const outputTokens = Math.round(Buffer.byteLength(outputJson, "utf-8") / 4);
  const savings = inputTokens > 0 ? Math.round((1 - outputTokens / inputTokens) * 100) : 0;

  return {
    pageTitle,
    persona,
    variant,
    sections,
    totalSections: sections.length,
    estimatedTokenSavings: `~${savings}% (${inputTokens} input tokens -> ${outputTokens} output tokens)`,
  };
}

// --- MCP Tool Registration ---

export function registerTools(server: McpServer, _sendCommandToFigma: SendCommandFn) {
  server.tool(
    "parse_wireframe",
    "Parse an HTML wireframe file and emit compact section specs for build_page_section. Reads the HTML, identifies sections by CSS classes and HTML comments, maps each to a template + props, and returns the complete page manifest. Eliminates the need to read/parse HTML manually — ~10x token savings vs reading raw HTML.",
    {
      filePath: z.string().describe("Absolute path to the HTML wireframe file"),
    },
    async ({ filePath }: { filePath: string }) => {
      try {
        // Validate file exists
        if (!fs.existsSync(filePath)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: File not found: ${filePath}`,
              },
            ],
          };
        }

        // Validate it's an HTML file
        if (!filePath.endsWith(".html") && !filePath.endsWith(".htm")) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: Expected an HTML file, got: ${filePath}`,
              },
            ],
          };
        }

        const result = parseWireframe(filePath);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error parsing wireframe: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
