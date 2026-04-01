// ---------------------------------------------------------------------------
// PCP Section Templates
// Pre-defined section templates for Partner Central pages, grouped by zone.
// Each template produces a valid create_node_tree spec from compact props.
// ---------------------------------------------------------------------------

// --- Brand DNA token constants ---
// Full brand tokens (from equinix-brand.json)
const BRAND = {
  bgDark: "#131925",
  bgBlack: "#000000",
  bgSecondary: "#151515",
  accentRed: "#e91c24",
  accentPurple: "#ae19ff",
  accentViolet: "#7739d9",
  textPrimary: "#ffffff",
  textSecondary: "#bdc1ca",
  textMuted: "#5a657b",
  cardBorder: "#2f3541",
  sectionPadding: 128,
  contentInset: 100,
  cardSpacing: 36,
  cardPadding: 36,
  containerRadius: 12,
  cardRadius: 6,
  mediaRadius: 8,
} as const;

// SLDS tokens (from equinix-pc.json)
const SLDS = {
  surface: "#ffffff",
  surfaceSecondary: "#f3f3f3",
  border: "#e5e5e5",
  textPrimary: "#181818",
  textSecondary: "#706e6b",
  textInverse: "#ffffff",
  actionPrimary: "#0176d3",
  destructive: "#ba0517",
  bodySize: 14,
  headingSmall: 20,
  headingMedium: 24,
  headingLarge: 28,
  radius: 4,
  spacingSmall: 12,
  spacingMedium: 16,
  spacingLarge: 24,
  spacingXLarge: 32,
  spacingXXLarge: 48,
} as const;

// --- Interface ---
export interface SectionTemplate {
  zone: "no_brand" | "brand_tinted" | "full_brand";
  description: string;
  defaultWidth: number;
  // Returns a create_node_tree spec from props + optional width override
  buildTree: (props: Record<string, any>, width?: number) => any;
}

// ---------------------------------------------------------------------------
// Helper: build a text node spec
// ---------------------------------------------------------------------------
function textNode(opts: {
  text: string;
  fontSize: number;
  fontWeight?: number;
  fontColor: string;
  name?: string;
  width?: number;
  letterSpacing?: number;
  lineHeight?: number;
  textCase?: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  fontFamily?: string;
  layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
}): any {
  const node: any = {
    type: "text",
    text: opts.text,
    fontSize: opts.fontSize,
    fontColor: opts.fontColor,
  };
  if (opts.fontWeight !== undefined) node.fontWeight = opts.fontWeight;
  if (opts.name) node.name = opts.name;
  if (opts.width !== undefined) node.width = opts.width;
  if (opts.letterSpacing !== undefined) node.letterSpacing = opts.letterSpacing;
  if (opts.lineHeight !== undefined) node.lineHeight = opts.lineHeight;
  if (opts.textCase) node.textCase = opts.textCase;
  if (opts.textAlignHorizontal) node.textAlignHorizontal = opts.textAlignHorizontal;
  if (opts.fontFamily) node.fontFamily = opts.fontFamily;
  return node;
}

// ---------------------------------------------------------------------------
// Helper: build a vertical auto-layout frame
// ---------------------------------------------------------------------------
function vStack(opts: {
  name?: string;
  width: number;
  height: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWeight?: number;
  cornerRadius?: number;
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "BASELINE";
  layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
  layoutSizingVertical?: "FIXED" | "HUG" | "FILL";
  clipsContent?: boolean;
  children?: any[];
}): any {
  const frame: any = {
    type: "frame",
    width: opts.width,
    height: opts.height,
    layoutMode: "VERTICAL",
  };
  if (opts.name) frame.name = opts.name;
  if (opts.fillColor) frame.fillColor = opts.fillColor;
  if (opts.strokeColor) frame.strokeColor = opts.strokeColor;
  if (opts.strokeWeight !== undefined) frame.strokeWeight = opts.strokeWeight;
  if (opts.cornerRadius !== undefined) frame.cornerRadius = opts.cornerRadius;
  if (opts.itemSpacing !== undefined) frame.itemSpacing = opts.itemSpacing;
  if (opts.paddingTop !== undefined) frame.paddingTop = opts.paddingTop;
  if (opts.paddingRight !== undefined) frame.paddingRight = opts.paddingRight;
  if (opts.paddingBottom !== undefined) frame.paddingBottom = opts.paddingBottom;
  if (opts.paddingLeft !== undefined) frame.paddingLeft = opts.paddingLeft;
  if (opts.primaryAxisAlignItems) frame.primaryAxisAlignItems = opts.primaryAxisAlignItems;
  if (opts.counterAxisAlignItems) frame.counterAxisAlignItems = opts.counterAxisAlignItems;
  if (opts.layoutSizingHorizontal) frame.layoutSizingHorizontal = opts.layoutSizingHorizontal;
  if (opts.layoutSizingVertical) frame.layoutSizingVertical = opts.layoutSizingVertical;
  if (opts.clipsContent !== undefined) frame.clipsContent = opts.clipsContent;
  if (opts.children) frame.children = opts.children;
  return frame;
}

// ---------------------------------------------------------------------------
// Helper: build a horizontal auto-layout frame
// ---------------------------------------------------------------------------
function hStack(opts: {
  name?: string;
  width: number;
  height: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWeight?: number;
  cornerRadius?: number;
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "BASELINE";
  layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
  layoutSizingVertical?: "FIXED" | "HUG" | "FILL";
  clipsContent?: boolean;
  children?: any[];
}): any {
  const frame: any = {
    type: "frame",
    width: opts.width,
    height: opts.height,
    layoutMode: "HORIZONTAL",
  };
  if (opts.name) frame.name = opts.name;
  if (opts.fillColor) frame.fillColor = opts.fillColor;
  if (opts.strokeColor) frame.strokeColor = opts.strokeColor;
  if (opts.strokeWeight !== undefined) frame.strokeWeight = opts.strokeWeight;
  if (opts.cornerRadius !== undefined) frame.cornerRadius = opts.cornerRadius;
  if (opts.itemSpacing !== undefined) frame.itemSpacing = opts.itemSpacing;
  if (opts.paddingTop !== undefined) frame.paddingTop = opts.paddingTop;
  if (opts.paddingRight !== undefined) frame.paddingRight = opts.paddingRight;
  if (opts.paddingBottom !== undefined) frame.paddingBottom = opts.paddingBottom;
  if (opts.paddingLeft !== undefined) frame.paddingLeft = opts.paddingLeft;
  if (opts.primaryAxisAlignItems) frame.primaryAxisAlignItems = opts.primaryAxisAlignItems;
  if (opts.counterAxisAlignItems) frame.counterAxisAlignItems = opts.counterAxisAlignItems;
  if (opts.layoutSizingHorizontal) frame.layoutSizingHorizontal = opts.layoutSizingHorizontal;
  if (opts.layoutSizingVertical) frame.layoutSizingVertical = opts.layoutSizingVertical;
  if (opts.clipsContent !== undefined) frame.clipsContent = opts.clipsContent;
  if (opts.children) frame.children = opts.children;
  return frame;
}

// ---------------------------------------------------------------------------
// Helper: CTA button frame (brand accent)
// ---------------------------------------------------------------------------
function ctaButton(label: string, color?: string): any {
  const bg = color || BRAND.accentRed;
  return hStack({
    name: "CTA Button",
    width: 200,
    height: 48,
    fillColor: bg,
    cornerRadius: 4,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 24,
    paddingRight: 24,
    primaryAxisAlignItems: "CENTER",
    counterAxisAlignItems: "CENTER",
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    children: [
      textNode({
        text: label,
        fontSize: 14,
        fontWeight: 700,
        fontColor: BRAND.textPrimary,
        name: "CTA Label",
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Helper: SLDS card wrapper
// ---------------------------------------------------------------------------
function sldsCard(opts: {
  name?: string;
  width: number;
  children: any[];
  accentBorderLeft?: string;
}): any {
  const frame = vStack({
    name: opts.name || "SLDS Card",
    width: opts.width,
    height: 100,
    fillColor: SLDS.surface,
    strokeColor: SLDS.border,
    strokeWeight: 1,
    cornerRadius: SLDS.radius,
    layoutSizingHorizontal: "FILL",
    layoutSizingVertical: "HUG",
    paddingTop: SLDS.spacingLarge,
    paddingRight: SLDS.spacingLarge,
    paddingBottom: SLDS.spacingLarge,
    paddingLeft: SLDS.spacingLarge,
    itemSpacing: SLDS.spacingMedium,
    children: opts.children,
  });
  // Accent border is modeled by wrapping in an outer frame with a colored left border
  if (opts.accentBorderLeft) {
    return hStack({
      name: (opts.name || "SLDS Card") + " (accent)",
      width: opts.width,
      height: 100,
      layoutSizingHorizontal: "FILL",
      layoutSizingVertical: "HUG",
      children: [
        // Accent bar
        {
          type: "rectangle",
          width: 4,
          height: 100,
          name: "Accent Border",
          fillColor: opts.accentBorderLeft,
        },
        frame,
      ],
    });
  }
  return frame;
}

// ---------------------------------------------------------------------------
// Helper: status badge for checklists
// ---------------------------------------------------------------------------
function statusBadge(status: string): any {
  const colorMap: Record<string, string> = {
    complete: "#059669",
    current: SLDS.actionPrimary,
    pending: SLDS.textSecondary,
  };
  const bg = colorMap[status] || SLDS.textSecondary;
  return hStack({
    name: `Badge ${status}`,
    width: 80,
    height: 24,
    fillColor: bg,
    cornerRadius: 12,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    primaryAxisAlignItems: "CENTER",
    counterAxisAlignItems: "CENTER",
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    children: [
      textNode({
        text: status.charAt(0).toUpperCase() + status.slice(1),
        fontSize: 12,
        fontWeight: 600,
        fontColor: SLDS.textInverse,
        name: "Badge Label",
      }),
    ],
  });
}

// ============================================================================
// SECTION TEMPLATES
// ============================================================================

export const SECTION_TEMPLATES: Record<string, SectionTemplate> = {

  // ==========================================================================
  // FULL BRAND
  // ==========================================================================

  hero_takeover: {
    zone: "full_brand",
    description: "Full-width hero banner with optional overline, heading, body, CTA, and persona.",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;
      const h = props.height ?? 600;
      const children: any[] = [];

      // Overline
      if (props.overline) {
        children.push(
          textNode({
            text: props.overline,
            fontSize: 13.6,
            fontWeight: 800,
            fontColor: BRAND.textMuted,
            letterSpacing: 1,
            textCase: "UPPER",
            name: "Overline",
            width: w - BRAND.contentInset * 2,
          })
        );
      }

      // Heading
      children.push(
        textNode({
          text: props.heading,
          fontSize: 47,
          fontWeight: 700,
          fontColor: BRAND.textPrimary,
          letterSpacing: -1,
          lineHeight: Math.round(47 * 1.2),
          name: "Heading",
          width: w - BRAND.contentInset * 2,
        })
      );

      // Body
      if (props.body) {
        children.push(
          textNode({
            text: props.body,
            fontSize: 18,
            fontWeight: 300,
            fontColor: BRAND.textSecondary,
            lineHeight: Math.round(18 * 1.4),
            name: "Body",
            width: w - BRAND.contentInset * 2,
          })
        );
      }

      // CTA
      if (props.cta) {
        children.push(ctaButton(props.cta.label, props.cta.color));
      }

      // Persona tag
      if (props.persona) {
        children.push(
          textNode({
            text: props.persona,
            fontSize: 14,
            fontWeight: 400,
            fontColor: BRAND.textMuted,
            name: "Persona",
          })
        );
      }

      return vStack({
        name: "Hero Takeover",
        width: w,
        height: h,
        fillColor: BRAND.bgDark,
        paddingTop: BRAND.sectionPadding,
        paddingBottom: BRAND.sectionPadding,
        paddingLeft: BRAND.contentInset,
        paddingRight: BRAND.contentInset,
        itemSpacing: 24,
        layoutSizingVertical: "HUG",
        clipsContent: true,
        children,
      });
    },
  },

  metrics_bar: {
    zone: "full_brand",
    description: "Row of centered stat metrics (value, qualifier, meta) in a gradient-bg container.",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;
      const metrics: Array<{ value: string; qualifier: string; meta: string }> = props.metrics;
      const radius = props.containerRadius ?? BRAND.containerRadius;

      const metricChildren = metrics.map((m, i) =>
        vStack({
          name: `Metric ${i + 1}`,
          width: 300,
          height: 100,
          itemSpacing: 8,
          primaryAxisAlignItems: "CENTER",
          counterAxisAlignItems: "CENTER",
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "HUG",
          children: [
            textNode({
              text: m.value,
              fontSize: 56,
              fontWeight: 700,
              fontColor: BRAND.textPrimary,
              textAlignHorizontal: "CENTER",
              name: "Value",
            }),
            textNode({
              text: m.qualifier,
              fontSize: 18,
              fontWeight: 300,
              fontColor: BRAND.textSecondary,
              textAlignHorizontal: "CENTER",
              name: "Qualifier",
            }),
            textNode({
              text: m.meta,
              fontSize: 13.6,
              fontWeight: 400,
              fontColor: BRAND.textMuted,
              textAlignHorizontal: "CENTER",
              name: "Meta",
            }),
          ],
        })
      );

      // Outer container with gradient-like bg (using accent purple as fill, since
      // true gradients need multi-stop fills which create_node_tree doesn't support;
      // a single fill approximates the look and can be adjusted post-creation)
      return hStack({
        name: "Metrics Bar",
        width: w,
        height: 100,
        fillColor: BRAND.bgDark,
        cornerRadius: radius,
        paddingTop: BRAND.sectionPadding,
        paddingBottom: BRAND.sectionPadding,
        paddingLeft: BRAND.contentInset,
        paddingRight: BRAND.contentInset,
        itemSpacing: BRAND.cardSpacing,
        primaryAxisAlignItems: "SPACE_BETWEEN",
        counterAxisAlignItems: "CENTER",
        layoutSizingVertical: "HUG",
        children: metricChildren,
      });
    },
  },

  article_deck_3up: {
    zone: "full_brand",
    description: "3 promo article cards with title, body, and arrow-right indicator.",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;
      const contentW = w - BRAND.contentInset * 2;
      const cardW = Math.floor((contentW - BRAND.cardSpacing * 2) / 3);
      const articles: Array<{ title: string; body: string; media?: string }> = props.articles;

      const sectionChildren: any[] = [];

      // Optional heading above the deck
      if (props.heading) {
        sectionChildren.push(
          textNode({
            text: props.heading,
            fontSize: 28,
            fontWeight: 700,
            fontColor: BRAND.textPrimary,
            name: "Deck Heading",
            width: contentW,
          })
        );
      }

      // Cards row
      const cards = articles.map((a, i) => {
        const cardChildren: any[] = [];

        // Media placeholder
        if (a.media) {
          cardChildren.push({
            type: "rectangle",
            width: cardW,
            height: 180,
            fillColor: BRAND.bgSecondary,
            cornerRadius: BRAND.cardRadius,
            name: "Media Placeholder",
          });
        }

        // Content frame
        cardChildren.push(
          vStack({
            name: "Card Content",
            width: cardW,
            height: 100,
            paddingTop: 24,
            paddingBottom: 24,
            paddingLeft: 24,
            paddingRight: 24,
            itemSpacing: 12,
            layoutSizingHorizontal: "FILL",
            layoutSizingVertical: "HUG",
            children: [
              textNode({
                text: a.title,
                fontSize: 22,
                fontWeight: 700,
                fontColor: BRAND.textPrimary,
                name: "Card Title",
                width: cardW - 48,
              }),
              textNode({
                text: a.body,
                fontSize: 16,
                fontWeight: 300,
                fontColor: BRAND.textSecondary,
                lineHeight: Math.round(16 * 1.4),
                name: "Card Body",
                width: cardW - 48,
              }),
              // Arrow indicator
              textNode({
                text: "\u2192",
                fontSize: 18,
                fontWeight: 700,
                fontColor: BRAND.accentRed,
                name: "Arrow",
              }),
            ],
          })
        );

        return vStack({
          name: `Article Card ${i + 1}`,
          width: cardW,
          height: 100,
          fillColor: BRAND.bgDark,
          cornerRadius: BRAND.cardRadius,
          layoutSizingVertical: "HUG",
          clipsContent: true,
          children: cardChildren,
        });
      });

      sectionChildren.push(
        hStack({
          name: "Cards Row",
          width: contentW,
          height: 100,
          itemSpacing: BRAND.cardSpacing,
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "HUG",
          children: cards,
        })
      );

      return vStack({
        name: "Article Deck 3-Up",
        width: w,
        height: 100,
        fillColor: BRAND.bgDark,
        paddingTop: BRAND.sectionPadding,
        paddingBottom: BRAND.sectionPadding,
        paddingLeft: BRAND.contentInset,
        paddingRight: BRAND.contentInset,
        itemSpacing: BRAND.cardSpacing,
        layoutSizingVertical: "HUG",
        children: sectionChildren,
      });
    },
  },

  bold_cta: {
    zone: "full_brand",
    description: "Centered CTA section with gradient bg, fortress icon placeholder, heading, body, and CTA button.",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;

      const children: any[] = [];

      // Fortress icon placeholder (red rectangle)
      children.push({
        type: "rectangle",
        width: 92,
        height: 60,
        fillColor: BRAND.accentRed,
        cornerRadius: 4,
        name: "Fortress Icon Placeholder",
      });

      // Heading
      children.push(
        textNode({
          text: props.heading,
          fontSize: 47,
          fontWeight: 700,
          fontColor: BRAND.textPrimary,
          letterSpacing: -1,
          lineHeight: Math.round(47 * 1.2),
          textAlignHorizontal: "CENTER",
          name: "Heading",
          width: w - BRAND.contentInset * 2,
        })
      );

      // Body
      if (props.body) {
        children.push(
          textNode({
            text: props.body,
            fontSize: 18,
            fontWeight: 300,
            fontColor: BRAND.textSecondary,
            lineHeight: Math.round(18 * 1.4),
            textAlignHorizontal: "CENTER",
            name: "Body",
            width: w - BRAND.contentInset * 2,
          })
        );
      }

      // CTA button
      children.push(ctaButton(props.cta.label, props.cta.color));

      return vStack({
        name: "Bold CTA",
        width: w,
        height: 100,
        fillColor: BRAND.bgDark,
        cornerRadius: BRAND.containerRadius,
        paddingTop: BRAND.sectionPadding,
        paddingBottom: BRAND.sectionPadding,
        paddingLeft: BRAND.contentInset,
        paddingRight: BRAND.contentInset,
        itemSpacing: 24,
        primaryAxisAlignItems: "CENTER",
        counterAxisAlignItems: "CENTER",
        layoutSizingVertical: "HUG",
        children,
      });
    },
  },

  global_highlights: {
    zone: "full_brand",
    description: "3 dark stat cards with title, body, stat number, and stat label.",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;
      const contentW = w - BRAND.contentInset * 2;
      const cardW = Math.floor((contentW - BRAND.cardSpacing * 2) / 3);
      const cards: Array<{ title: string; body: string; stat: string; statLabel: string }> = props.cards;

      const cardNodes = cards.map((c, i) =>
        vStack({
          name: `Highlight Card ${i + 1}`,
          width: cardW,
          height: 100,
          fillColor: BRAND.bgBlack,
          strokeColor: BRAND.cardBorder,
          strokeWeight: 1,
          cornerRadius: BRAND.cardRadius,
          paddingTop: BRAND.cardPadding,
          paddingRight: BRAND.cardPadding,
          paddingBottom: BRAND.cardPadding,
          paddingLeft: BRAND.cardPadding,
          itemSpacing: 58,
          layoutSizingVertical: "HUG",
          children: [
            // Top: title + body
            vStack({
              name: "Card Text",
              width: cardW - BRAND.cardPadding * 2,
              height: 50,
              itemSpacing: 12,
              layoutSizingHorizontal: "FILL",
              layoutSizingVertical: "HUG",
              children: [
                textNode({
                  text: c.title,
                  fontSize: 22,
                  fontWeight: 700,
                  fontColor: BRAND.textPrimary,
                  name: "Card Title",
                  width: cardW - BRAND.cardPadding * 2,
                }),
                textNode({
                  text: c.body,
                  fontSize: 16,
                  fontWeight: 300,
                  fontColor: BRAND.textSecondary,
                  lineHeight: Math.round(16 * 1.4),
                  name: "Card Body",
                  width: cardW - BRAND.cardPadding * 2,
                }),
              ],
            }),
            // Bottom: stat
            vStack({
              name: "Card Stat",
              width: cardW - BRAND.cardPadding * 2,
              height: 50,
              itemSpacing: 4,
              layoutSizingHorizontal: "FILL",
              layoutSizingVertical: "HUG",
              children: [
                textNode({
                  text: c.stat,
                  fontSize: 56,
                  fontWeight: 700,
                  fontColor: BRAND.textPrimary,
                  name: "Stat Value",
                }),
                textNode({
                  text: c.statLabel,
                  fontSize: 14,
                  fontWeight: 400,
                  fontColor: BRAND.textMuted,
                  name: "Stat Label",
                }),
              ],
            }),
          ],
        })
      );

      return hStack({
        name: "Global Highlights",
        width: w,
        height: 100,
        fillColor: BRAND.bgDark,
        paddingTop: BRAND.sectionPadding,
        paddingBottom: BRAND.sectionPadding,
        paddingLeft: BRAND.contentInset,
        paddingRight: BRAND.contentInset,
        itemSpacing: BRAND.cardSpacing,
        layoutSizingVertical: "HUG",
        children: cardNodes,
      });
    },
  },

  avatar_quotation: {
    zone: "full_brand",
    description: "Quote with large circular avatar placeholder, quote text, name, and title.",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;
      const avatarSize = props.size ?? 320;

      return hStack({
        name: "Avatar Quotation",
        width: w,
        height: 100,
        fillColor: BRAND.bgDark,
        paddingTop: BRAND.sectionPadding,
        paddingBottom: BRAND.sectionPadding,
        paddingLeft: BRAND.contentInset,
        paddingRight: BRAND.contentInset,
        itemSpacing: 24,
        counterAxisAlignItems: "CENTER",
        layoutSizingVertical: "HUG",
        children: [
          // Avatar placeholder circle (approximated as a rounded rectangle;
          // for a true circle, cornerRadius = half the size)
          {
            type: "rectangle",
            width: avatarSize,
            height: avatarSize,
            fillColor: BRAND.accentPurple,
            cornerRadius: Math.round(avatarSize / 2),
            name: "Avatar Placeholder",
          },
          // Quote block
          vStack({
            name: "Quote Block",
            width: w - BRAND.contentInset * 2 - avatarSize - 24,
            height: 100,
            itemSpacing: 16,
            layoutSizingHorizontal: "FILL",
            layoutSizingVertical: "HUG",
            children: [
              textNode({
                text: `\u201C${props.quote}\u201D`,
                fontSize: 22,
                fontWeight: 300,
                fontColor: BRAND.textPrimary,
                lineHeight: Math.round(22 * 1.4),
                name: "Quote Text",
                width: w - BRAND.contentInset * 2 - avatarSize - 48,
              }),
              vStack({
                name: "Citation",
                width: 300,
                height: 40,
                itemSpacing: 4,
                layoutSizingHorizontal: "FILL",
                layoutSizingVertical: "HUG",
                children: [
                  textNode({
                    text: props.name,
                    fontSize: 16,
                    fontWeight: 700,
                    fontColor: BRAND.textPrimary,
                    name: "Citation Name",
                  }),
                  textNode({
                    text: props.title,
                    fontSize: 16,
                    fontWeight: 400,
                    fontColor: BRAND.textSecondary,
                    name: "Citation Title",
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    },
  },

  // ==========================================================================
  // BRAND TINTED
  // ==========================================================================

  kpi_cards: {
    zone: "brand_tinted",
    description: "Grid of KPI stat cards with label, brand-accent value, detail, and optional trend.",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;
      const kpis: Array<{ label: string; value: string; detail: string; trend?: string }> = props.kpis;
      const cardW = Math.floor((w - SLDS.spacingLarge * (kpis.length - 1)) / kpis.length);

      const cardNodes = kpis.map((kpi, i) => {
        const cardChildren: any[] = [
          textNode({
            text: kpi.label,
            fontSize: SLDS.bodySize,
            fontWeight: 400,
            fontColor: SLDS.textSecondary,
            name: "KPI Label",
          }),
          textNode({
            text: kpi.value,
            fontSize: 28,
            fontWeight: 700,
            fontColor: BRAND.accentRed,
            name: "KPI Value",
          }),
          textNode({
            text: kpi.detail,
            fontSize: SLDS.bodySize,
            fontWeight: 400,
            fontColor: SLDS.textSecondary,
            name: "KPI Detail",
          }),
        ];

        if (kpi.trend) {
          cardChildren.push(
            textNode({
              text: kpi.trend,
              fontSize: 12,
              fontWeight: 600,
              fontColor: kpi.trend.startsWith("+") ? "#059669" : SLDS.destructive,
              name: "KPI Trend",
            })
          );
        }

        return sldsCard({
          name: `KPI Card ${i + 1}`,
          width: cardW,
          children: cardChildren,
        });
      });

      return hStack({
        name: "KPI Cards",
        width: w,
        height: 100,
        itemSpacing: SLDS.spacingLarge,
        layoutSizingVertical: "HUG",
        children: cardNodes,
      });
    },
  },

  progress_card: {
    zone: "brand_tinted",
    description: "SLDS card with heading, a brand-accent progress bar, label, and optional detail.",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;
      const progress = Math.max(0, Math.min(100, props.progress ?? 0));
      const barWidth = w - SLDS.spacingLarge * 2;
      const filledWidth = Math.round(barWidth * (progress / 100));

      const cardChildren: any[] = [
        // Heading
        textNode({
          text: props.heading,
          fontSize: SLDS.headingSmall,
          fontWeight: 700,
          fontColor: SLDS.textPrimary,
          name: "Progress Heading",
        }),
        // Progress bar container
        hStack({
          name: "Progress Bar",
          width: barWidth,
          height: 8,
          fillColor: SLDS.border,
          cornerRadius: 4,
          layoutSizingHorizontal: "FILL",
          children: [
            {
              type: "rectangle",
              width: Math.max(filledWidth, 1),
              height: 8,
              fillColor: BRAND.accentRed,
              cornerRadius: 4,
              name: "Progress Fill",
            },
          ],
        }),
        // Label
        textNode({
          text: props.label,
          fontSize: SLDS.bodySize,
          fontWeight: 600,
          fontColor: SLDS.textPrimary,
          name: "Progress Label",
        }),
      ];

      // Optional detail
      if (props.detail) {
        cardChildren.push(
          textNode({
            text: props.detail,
            fontSize: SLDS.bodySize,
            fontWeight: 400,
            fontColor: SLDS.textSecondary,
            name: "Progress Detail",
          })
        );
      }

      return sldsCard({
        name: "Progress Card",
        width: w,
        children: cardChildren,
      });
    },
  },

  // ==========================================================================
  // NO BRAND
  // ==========================================================================

  slds_data_table: {
    zone: "no_brand",
    description: "Standard data table with heading, column headers, placeholder body rows, and optional footer.",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;
      const columns: string[] = props.columns;
      const rowCount = props.rowCount ?? 5;
      const colW = Math.floor((w - SLDS.spacingLarge * 2) / columns.length);

      // Header row
      const headerCells = columns.map((col, i) =>
        textNode({
          text: col,
          fontSize: SLDS.bodySize,
          fontWeight: 700,
          fontColor: SLDS.textPrimary,
          name: `Header ${col}`,
          width: colW,
        })
      );

      const headerRow = hStack({
        name: "Header Row",
        width: w - SLDS.spacingLarge * 2,
        height: 40,
        fillColor: SLDS.surfaceSecondary,
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: SLDS.spacingMedium,
        paddingRight: SLDS.spacingMedium,
        counterAxisAlignItems: "CENTER",
        layoutSizingHorizontal: "FILL",
        layoutSizingVertical: "HUG",
        children: headerCells,
      });

      // Body rows using $repeat
      const bodyCellTemplate: any = {
        type: "frame",
        width: w - SLDS.spacingLarge * 2,
        height: 44,
        layoutMode: "HORIZONTAL",
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: SLDS.spacingMedium,
        paddingRight: SLDS.spacingMedium,
        counterAxisAlignItems: "CENTER",
        layoutSizingHorizontal: "FILL",
        layoutSizingVertical: "HUG",
        strokeColor: SLDS.border,
        strokeWeight: 1,
        name: "Table Row",
        children: columns.map((col, ci) => ({
          type: "text",
          text: "\u2014",
          fontSize: SLDS.bodySize,
          fontWeight: 400,
          fontColor: SLDS.textSecondary,
          name: `Cell ${col}`,
          width: colW,
        })),
      };

      // Generate row data for $repeat (empty rows with index)
      const rowData = Array.from({ length: rowCount }, (_, i) => ({ row: i + 1 }));

      const tableChildren: any[] = [
        // Heading
        textNode({
          text: props.heading,
          fontSize: SLDS.headingSmall,
          fontWeight: 700,
          fontColor: SLDS.textPrimary,
          name: "Table Heading",
        }),
        headerRow,
        // Body rows
        {
          $repeat: {
            data: rowData,
            template: bodyCellTemplate,
          },
        },
      ];

      // Footer
      if (props.footer) {
        const footerChildren: any[] = [
          textNode({
            text: props.footer.label,
            fontSize: SLDS.bodySize,
            fontWeight: 400,
            fontColor: props.footer.href ? SLDS.actionPrimary : SLDS.textSecondary,
            name: "Footer Link",
          }),
        ];

        tableChildren.push(
          hStack({
            name: "Table Footer",
            width: w - SLDS.spacingLarge * 2,
            height: 40,
            paddingTop: SLDS.spacingSmall,
            paddingBottom: SLDS.spacingSmall,
            paddingLeft: SLDS.spacingMedium,
            paddingRight: SLDS.spacingMedium,
            primaryAxisAlignItems: "MAX",
            counterAxisAlignItems: "CENTER",
            layoutSizingHorizontal: "FILL",
            layoutSizingVertical: "HUG",
            children: footerChildren,
          })
        );
      }

      return sldsCard({
        name: "Data Table",
        width: w,
        children: tableChildren,
      });
    },
  },

  slds_checklist: {
    zone: "no_brand",
    description: "Numbered checklist with status badges (complete/current/pending), optional progress bar.",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;
      const items: Array<{ title: string; description: string; status: string; link?: string }> = props.items;

      const listChildren: any[] = [
        // Heading
        textNode({
          text: props.heading,
          fontSize: SLDS.headingSmall,
          fontWeight: 700,
          fontColor: SLDS.textPrimary,
          name: "Checklist Heading",
        }),
      ];

      // Optional progress bar at the top
      if (props.progress !== undefined) {
        const barWidth = w - SLDS.spacingLarge * 2;
        const filledWidth = Math.round(barWidth * (props.progress / 100));
        listChildren.push(
          hStack({
            name: "Checklist Progress",
            width: barWidth,
            height: 6,
            fillColor: SLDS.border,
            cornerRadius: 3,
            layoutSizingHorizontal: "FILL",
            children: [
              {
                type: "rectangle",
                width: Math.max(filledWidth, 1),
                height: 6,
                fillColor: SLDS.actionPrimary,
                cornerRadius: 3,
                name: "Progress Fill",
              },
            ],
          })
        );
      }

      // Checklist items
      items.forEach((item, i) => {
        const isCurrent = item.status === "current";
        const itemChildren: any[] = [
          hStack({
            name: `Item ${i + 1} Header`,
            width: w - SLDS.spacingLarge * 2,
            height: 30,
            itemSpacing: SLDS.spacingSmall,
            counterAxisAlignItems: "CENTER",
            layoutSizingHorizontal: "FILL",
            layoutSizingVertical: "HUG",
            children: [
              // Step number
              textNode({
                text: `${i + 1}.`,
                fontSize: SLDS.bodySize,
                fontWeight: 700,
                fontColor: SLDS.textPrimary,
                name: "Step Number",
              }),
              textNode({
                text: item.title,
                fontSize: SLDS.bodySize,
                fontWeight: 600,
                fontColor: SLDS.textPrimary,
                name: "Item Title",
              }),
              statusBadge(item.status),
            ],
          }),
          textNode({
            text: item.description,
            fontSize: SLDS.bodySize,
            fontWeight: 400,
            fontColor: SLDS.textSecondary,
            name: "Item Description",
            width: w - SLDS.spacingLarge * 2 - 32,
          }),
        ];

        if (item.link) {
          itemChildren.push(
            textNode({
              text: item.link,
              fontSize: SLDS.bodySize,
              fontWeight: 400,
              fontColor: SLDS.actionPrimary,
              name: "Item Link",
            })
          );
        }

        // Wrap item in a frame, with accent border if current
        const itemFrame = vStack({
          name: `Checklist Item ${i + 1}`,
          width: w - SLDS.spacingLarge * 2,
          height: 50,
          paddingTop: SLDS.spacingMedium,
          paddingBottom: SLDS.spacingMedium,
          paddingLeft: SLDS.spacingMedium,
          paddingRight: SLDS.spacingMedium,
          itemSpacing: 8,
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "HUG",
          strokeColor: SLDS.border,
          strokeWeight: 1,
          children: itemChildren,
        });

        // If current, wrap with accent left border
        if (isCurrent) {
          listChildren.push(
            hStack({
              name: `Item ${i + 1} (current)`,
              width: w - SLDS.spacingLarge * 2,
              height: 50,
              layoutSizingHorizontal: "FILL",
              layoutSizingVertical: "HUG",
              children: [
                {
                  type: "rectangle",
                  width: 4,
                  height: 50,
                  fillColor: SLDS.actionPrimary,
                  name: "Current Accent",
                },
                itemFrame,
              ],
            })
          );
        } else {
          listChildren.push(itemFrame);
        }
      });

      return sldsCard({
        name: "Checklist",
        width: w,
        children: listChildren,
      });
    },
  },

  slds_card_list: {
    zone: "no_brand",
    description: "Stacked list items with optional icons, separated by SLDS borders.",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;
      const items: Array<{ icon?: string; title: string; description: string; link?: string }> = props.items;

      const listChildren: any[] = [
        textNode({
          text: props.heading,
          fontSize: SLDS.headingSmall,
          fontWeight: 700,
          fontColor: SLDS.textPrimary,
          name: "List Heading",
        }),
      ];

      items.forEach((item, i) => {
        const rowChildren: any[] = [];

        // Icon placeholder
        if (item.icon) {
          rowChildren.push({
            type: "rectangle",
            width: 32,
            height: 32,
            fillColor: SLDS.surfaceSecondary,
            cornerRadius: SLDS.radius,
            name: `Icon ${item.icon}`,
          });
        }

        // Text block
        const textBlock = vStack({
          name: `Item ${i + 1} Text`,
          width: w - SLDS.spacingLarge * 2 - (item.icon ? 56 : 0),
          height: 40,
          itemSpacing: 4,
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "HUG",
          children: [
            textNode({
              text: item.title,
              fontSize: SLDS.bodySize,
              fontWeight: 600,
              fontColor: SLDS.textPrimary,
              name: "Item Title",
            }),
            textNode({
              text: item.description,
              fontSize: SLDS.bodySize,
              fontWeight: 400,
              fontColor: SLDS.textSecondary,
              name: "Item Description",
              width: w - SLDS.spacingLarge * 2 - (item.icon ? 56 : 0),
            }),
          ],
        });
        rowChildren.push(textBlock);

        // Link indicator
        if (item.link) {
          rowChildren.push(
            textNode({
              text: item.link,
              fontSize: SLDS.bodySize,
              fontWeight: 400,
              fontColor: SLDS.actionPrimary,
              name: "Item Link",
            })
          );
        }

        listChildren.push(
          hStack({
            name: `List Item ${i + 1}`,
            width: w - SLDS.spacingLarge * 2,
            height: 50,
            paddingTop: SLDS.spacingMedium,
            paddingBottom: SLDS.spacingMedium,
            itemSpacing: SLDS.spacingMedium,
            counterAxisAlignItems: "CENTER",
            layoutSizingHorizontal: "FILL",
            layoutSizingVertical: "HUG",
            // Bottom border separator (except last item)
            strokeColor: i < items.length - 1 ? SLDS.border : undefined,
            strokeWeight: i < items.length - 1 ? 1 : undefined,
            children: rowChildren,
          })
        );
      });

      return sldsCard({
        name: "Card List",
        width: w,
        children: listChildren,
      });
    },
  },

  slds_alert: {
    zone: "no_brand",
    description: "Alert banner with type-specific color (warning/success/error/info), heading, body, and optional CTA.",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;
      const typeColors: Record<string, string> = {
        warning: "#f59e0b",
        success: "#059669",
        error: SLDS.destructive,
        info: SLDS.actionPrimary,
      };
      const accentColor = typeColors[props.type] || SLDS.actionPrimary;

      const alertChildren: any[] = [
        // Color accent bar at top
        {
          type: "rectangle",
          width: w,
          height: 4,
          fillColor: accentColor,
          name: "Alert Accent",
        },
        // Content
        vStack({
          name: "Alert Content",
          width: w,
          height: 50,
          paddingTop: SLDS.spacingMedium,
          paddingBottom: SLDS.spacingMedium,
          paddingLeft: SLDS.spacingLarge,
          paddingRight: SLDS.spacingLarge,
          itemSpacing: 8,
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "HUG",
          children: [
            textNode({
              text: props.heading,
              fontSize: SLDS.bodySize,
              fontWeight: 700,
              fontColor: SLDS.textPrimary,
              name: "Alert Heading",
            }),
            textNode({
              text: props.body,
              fontSize: SLDS.bodySize,
              fontWeight: 400,
              fontColor: SLDS.textSecondary,
              name: "Alert Body",
              width: w - SLDS.spacingLarge * 2,
            }),
            ...(props.cta
              ? [
                  textNode({
                    text: props.cta,
                    fontSize: SLDS.bodySize,
                    fontWeight: 600,
                    fontColor: SLDS.actionPrimary,
                    name: "Alert CTA",
                  }),
                ]
              : []),
          ],
        }),
      ];

      return vStack({
        name: `Alert ${props.type}`,
        width: w,
        height: 50,
        fillColor: SLDS.surface,
        strokeColor: SLDS.border,
        strokeWeight: 1,
        cornerRadius: SLDS.radius,
        layoutSizingVertical: "HUG",
        clipsContent: true,
        children: alertChildren,
      });
    },
  },

  slds_sidebar: {
    zone: "no_brand",
    description: "Quick actions sidebar card with stacked action links.",
    defaultWidth: 320,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;
      const actions: Array<{ icon?: string; title: string; description: string }> = props.actions;

      const actionNodes = actions.map((action, i) => {
        const rowChildren: any[] = [];

        if (action.icon) {
          rowChildren.push({
            type: "rectangle",
            width: 24,
            height: 24,
            fillColor: SLDS.surfaceSecondary,
            cornerRadius: SLDS.radius,
            name: `Icon ${action.icon}`,
          });
        }

        rowChildren.push(
          vStack({
            name: `Action ${i + 1} Text`,
            width: w - SLDS.spacingLarge * 2 - (action.icon ? 40 : 0),
            height: 30,
            itemSpacing: 2,
            layoutSizingHorizontal: "FILL",
            layoutSizingVertical: "HUG",
            children: [
              textNode({
                text: action.title,
                fontSize: SLDS.bodySize,
                fontWeight: 600,
                fontColor: SLDS.actionPrimary,
                name: "Action Title",
              }),
              textNode({
                text: action.description,
                fontSize: 12,
                fontWeight: 400,
                fontColor: SLDS.textSecondary,
                name: "Action Description",
                width: w - SLDS.spacingLarge * 2 - (action.icon ? 40 : 0),
              }),
            ],
          })
        );

        return hStack({
          name: `Action ${i + 1}`,
          width: w - SLDS.spacingLarge * 2,
          height: 40,
          itemSpacing: SLDS.spacingMedium,
          counterAxisAlignItems: "CENTER",
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "HUG",
          // Border separator
          strokeColor: i < actions.length - 1 ? SLDS.border : undefined,
          strokeWeight: i < actions.length - 1 ? 1 : undefined,
          paddingBottom: i < actions.length - 1 ? SLDS.spacingSmall : undefined,
          children: rowChildren,
        });
      });

      return sldsCard({
        name: "Quick Actions Sidebar",
        width: w,
        children: [
          textNode({
            text: props.heading,
            fontSize: SLDS.headingSmall,
            fontWeight: 700,
            fontColor: SLDS.textPrimary,
            name: "Sidebar Heading",
          }),
          ...actionNodes,
        ],
      });
    },
  },

  welcome_banner_slds: {
    zone: "no_brand",
    description: "Light welcome banner with greeting, subtitle, optional badge. Accent left border in SLDS blue.",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;

      const contentChildren: any[] = [
        textNode({
          text: props.greeting,
          fontSize: SLDS.headingMedium,
          fontWeight: 700,
          fontColor: SLDS.textPrimary,
          name: "Greeting",
        }),
        textNode({
          text: props.subtitle,
          fontSize: SLDS.bodySize,
          fontWeight: 400,
          fontColor: SLDS.textSecondary,
          name: "Subtitle",
          width: w - SLDS.spacingLarge * 2 - 8,
        }),
      ];

      // Optional badge
      if (props.badge) {
        contentChildren.push(
          hStack({
            name: "Welcome Badge",
            width: 200,
            height: 40,
            itemSpacing: 8,
            counterAxisAlignItems: "CENTER",
            layoutSizingHorizontal: "HUG",
            layoutSizingVertical: "HUG",
            children: [
              textNode({
                text: props.badge.value,
                fontSize: SLDS.headingLarge,
                fontWeight: 700,
                fontColor: SLDS.actionPrimary,
                name: "Badge Value",
              }),
              textNode({
                text: props.badge.label,
                fontSize: SLDS.bodySize,
                fontWeight: 400,
                fontColor: SLDS.textSecondary,
                name: "Badge Label",
              }),
            ],
          })
        );
      }

      return sldsCard({
        name: "Welcome Banner",
        width: w,
        children: contentChildren,
        accentBorderLeft: SLDS.actionPrimary,
      });
    },
  },

  // =========================================================================
  // C3 fix: 7 additional templates emitted by wireframe parser
  // =========================================================================

  slds_empty_state: {
    zone: "no_brand",
    description: "Empty state placeholder with heading, description, and CTA",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? 1440;
      return sldsCard({
        name: "Empty State",
        width: w,
        children: [
          textNode({ text: props.heading || "No items yet", fontSize: SLDS.headingSmall, fontWeight: 700, fontColor: SLDS.textPrimary, name: "Empty Heading", width: w - SLDS.paddingL * 2 }),
          textNode({ text: props.description || "", fontSize: SLDS.bodySize, fontWeight: 400, fontColor: SLDS.textSecondary, name: "Empty Description", width: w - SLDS.paddingL * 2 }),
          ...(props.primaryCta ? [{ type: "frame" as const, name: "CTA Button", width: 160, height: 36, fillColor: SLDS.actionPrimary, cornerRadius: 4, layoutMode: "HORIZONTAL" as const, primaryAxisAlignItems: "CENTER" as const, counterAxisAlignItems: "CENTER" as const, paddingTop: 8, paddingBottom: 8, paddingLeft: 16, paddingRight: 16, children: [textNode({ text: props.primaryCta.text || "Get started", fontSize: SLDS.bodySize, fontWeight: 700, fontColor: SLDS.textInverse, name: "CTA Label" })] }] : []),
        ],
      });
    },
  },

  quick_actions: {
    zone: "no_brand",
    description: "Grid of quick action cards with title and caption",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? 1440;
      const actions = props.actions || [];
      return sldsCard({
        name: "Quick Actions",
        width: w,
        children: [
          textNode({ text: props.heading || "Quick Actions", fontSize: SLDS.headingSmall, fontWeight: 700, fontColor: SLDS.textPrimary, name: "Actions Heading" }),
          ...actions.map((a: any, i: number) => ({
            type: "frame" as const, name: `Action ${i + 1}`, width: w - SLDS.paddingL * 2, height: 48, layoutMode: "VERTICAL" as const, itemSpacing: 2, paddingTop: 10, paddingBottom: 10, strokeColor: SLDS.border, strokeWeight: 1, cornerRadius: 4, children: [
              textNode({ text: a.title || "", fontSize: SLDS.bodySize, fontWeight: 600, fontColor: SLDS.actionPrimary, name: "Action Title" }),
              textNode({ text: a.caption || a.description || "", fontSize: 12, fontWeight: 400, fontColor: SLDS.textSecondary, name: "Action Caption" }),
            ],
          })),
        ],
      });
    },
  },

  deadline_cards: {
    zone: "no_brand",
    description: "Stacked deadline/timeline cards with status indicators",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? 1440;
      return sldsCard({ name: "Deadline Cards", width: w, children: [
        textNode({ text: props.heading || "Upcoming Deadlines", fontSize: SLDS.headingSmall, fontWeight: 700, fontColor: SLDS.textPrimary, name: "Deadlines Heading" }),
        textNode({ text: "Deadline items rendered here", fontSize: SLDS.bodySize, fontWeight: 400, fontColor: SLDS.textSecondary, name: "Deadlines Placeholder" }),
      ]});
    },
  },

  activity_feed: {
    zone: "no_brand",
    description: "Chronological activity feed with timestamps",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? 1440;
      return sldsCard({ name: "Activity Feed", width: w, children: [
        textNode({ text: props.heading || "Recent Activity", fontSize: SLDS.headingSmall, fontWeight: 700, fontColor: SLDS.textPrimary, name: "Feed Heading" }),
        ...(props.viewAllLink ? [textNode({ text: props.viewAllLink.text || "View All", fontSize: 12, fontWeight: 600, fontColor: SLDS.actionPrimary, name: "View All Link" })] : []),
        textNode({ text: "Activity items rendered here", fontSize: SLDS.bodySize, fontWeight: 400, fontColor: SLDS.textSecondary, name: "Feed Placeholder" }),
      ]});
    },
  },

  psm_contact_card: {
    zone: "full_brand",
    description: "Partner Success Manager contact card with quote and CTA",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? 1440;
      return {
        type: "frame" as const, name: "PSM Contact", width: w, height: 200, fillColor: BRAND.bgDark, layoutMode: "HORIZONTAL" as const, itemSpacing: 24, paddingTop: 40, paddingBottom: 40, paddingLeft: BRAND.contentInset, paddingRight: BRAND.contentInset, children: [
          { type: "rectangle" as const, name: "PSM Avatar", width: 80, height: 80, fillColor: BRAND.accentPurple, cornerRadius: 40 },
          { type: "frame" as const, name: "PSM Info", width: w - BRAND.contentInset * 2 - 104, height: 120, layoutMode: "VERTICAL" as const, itemSpacing: 8, children: [
            textNode({ text: props.psmName || "Your Partner Success Manager", fontSize: 18, fontWeight: 700, fontColor: BRAND.textPrimary, name: "PSM Name" }),
            textNode({ text: props.message || props.attribution || "", fontSize: 14, fontWeight: 400, fontColor: BRAND.textSecondary, name: "PSM Message", width: w - BRAND.contentInset * 2 - 128 }),
            ...(props.cta ? [textNode({ text: props.cta.text || "Send message", fontSize: 14, fontWeight: 600, fontColor: BRAND.accentRed, name: "PSM CTA" })] : []),
          ]},
        ],
      };
    },
  },

  slds_alert_list: {
    zone: "no_brand",
    description: "Multiple stacked alert banners",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? 1440;
      const alerts = props.alerts || [];
      const alertColors: Record<string, string> = { warning: "#f59e0b", success: "#059669", error: "#ba0517", info: SLDS.actionPrimary };
      return {
        type: "frame" as const, name: "Alert List", width: w, height: alerts.length * 60 + 16, layoutMode: "VERTICAL" as const, itemSpacing: 8, paddingTop: 8, paddingBottom: 8, paddingLeft: SLDS.paddingL, paddingRight: SLDS.paddingL, children: alerts.map((a: any, i: number) => ({
          type: "frame" as const, name: `Alert ${i + 1}`, width: w - SLDS.paddingL * 2, height: 48, fillColor: SLDS.surface, strokeColor: alertColors[a.variant] || SLDS.border, strokeWeight: 1, cornerRadius: SLDS.radiusDefault, layoutMode: "HORIZONTAL" as const, itemSpacing: 8, paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16, children: [
            { type: "rectangle" as const, name: "Alert Accent", width: 4, height: 24, fillColor: alertColors[a.variant] || SLDS.actionPrimary },
            textNode({ text: a.text || "", fontSize: SLDS.bodySize, fontWeight: 400, fontColor: SLDS.textPrimary, name: "Alert Text", width: w - SLDS.paddingL * 2 - 52 }),
          ],
        })),
      };
    },
  },

  notification_banner: {
    zone: "no_brand",
    description: "System notification banner with heading, description, and CTA",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? 1440;
      const bannerColors: Record<string, { bg: string; border: string; text: string }> = {
        mfa_nag: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
        countersign_success: { bg: "#d1fae5", border: "#34d399", text: "#065f46" },
        default: { bg: SLDS.surface, border: SLDS.border, text: SLDS.textPrimary },
      };
      const colors = bannerColors[props.bannerType] || bannerColors.default;
      return {
        type: "frame" as const, name: `Banner ${props.bannerType || "default"}`, width: w, height: 60, fillColor: colors.bg, strokeColor: colors.border, strokeWeight: 1, cornerRadius: 8, layoutMode: "HORIZONTAL" as const, itemSpacing: 12, paddingTop: 14, paddingBottom: 14, paddingLeft: 20, paddingRight: 20, counterAxisAlignItems: "CENTER" as const, children: [
          { type: "rectangle" as const, name: "Banner Accent", width: 4, height: 32, fillColor: colors.border },
          { type: "frame" as const, name: "Banner Content", width: w - 100, height: 32, layoutMode: "VERTICAL" as const, itemSpacing: 2, children: [
            textNode({ text: props.heading || "", fontSize: 13, fontWeight: 700, fontColor: colors.text, name: "Banner Heading" }),
          ]},
          ...(props.cta ? [{
            type: "frame" as const, name: "Banner CTA", width: 100, height: 28, fillColor: colors.border, cornerRadius: 4, layoutMode: "HORIZONTAL" as const, primaryAxisAlignItems: "CENTER" as const, counterAxisAlignItems: "CENTER" as const, paddingLeft: 12, paddingRight: 12, children: [
              textNode({ text: props.cta.text || "Action", fontSize: 12, fontWeight: 700, fontColor: "#ffffff", name: "CTA Label" }),
            ],
          }] : []),
        ],
      };
    },
  },
};

// ---------------------------------------------------------------------------
// Utility: extract a compact summary of all templates for get_section_templates
// ---------------------------------------------------------------------------
export interface TemplateSummary {
  name: string;
  zone: "no_brand" | "brand_tinted" | "full_brand";
  description: string;
  defaultWidth: number;
  requiredProps: string[];
  optionalProps: string[];
}

/**
 * Build a description of required and optional props for each template.
 * This is a hand-maintained map kept in sync with each buildTree implementation
 * so that get_section_templates can return accurate schema info without runtime
 * introspection.
 */
const TEMPLATE_PROPS: Record<string, { required: string[]; optional: string[] }> = {
  hero_takeover: {
    required: ["heading"],
    optional: ["overline", "body", "cta: {label, color?}", "persona", "height"],
  },
  metrics_bar: {
    required: ["metrics: Array<{value, qualifier, meta}>"],
    optional: ["containerRadius"],
  },
  article_deck_3up: {
    required: ["articles: Array<{title, body, media?}>"],
    optional: ["heading"],
  },
  bold_cta: {
    required: ["heading", "cta: {label, color?}"],
    optional: ["body"],
  },
  global_highlights: {
    required: ["cards: Array<{title, body, stat, statLabel}>"],
    optional: [],
  },
  avatar_quotation: {
    required: ["quote", "name", "title"],
    optional: ["size"],
  },
  kpi_cards: {
    required: ["kpis: Array<{label, value, detail, trend?}>"],
    optional: [],
  },
  progress_card: {
    required: ["heading", "progress", "label"],
    optional: ["detail"],
  },
  slds_data_table: {
    required: ["heading", "columns: string[]"],
    optional: ["rowCount", "footer: {label, href?}"],
  },
  slds_checklist: {
    required: ["heading", "items: Array<{title, description, status, link?}>"],
    optional: ["progress"],
  },
  slds_card_list: {
    required: ["heading", "items: Array<{icon?, title, description, link?}>"],
    optional: [],
  },
  slds_alert: {
    required: ["type: 'warning'|'success'|'error'|'info'", "heading", "body"],
    optional: ["cta"],
  },
  slds_sidebar: {
    required: ["heading", "actions: Array<{icon?, title, description}>"],
    optional: [],
  },
  welcome_banner_slds: {
    required: ["greeting", "subtitle"],
    optional: ["badge: {value, label}"],
  },
  slds_empty_state: {
    required: ["heading", "description"],
    optional: ["primaryCta: {text, href?}", "secondaryCta: {text, href?}"],
  },
  quick_actions: {
    required: ["actions: Array<{title, caption|description}>"],
    optional: ["heading"],
  },
  deadline_cards: {
    required: [],
    optional: ["heading"],
  },
  activity_feed: {
    required: [],
    optional: ["heading", "viewAllLink: {text, href?}", "rows"],
  },
  psm_contact_card: {
    required: [],
    optional: ["psmName", "message", "attribution", "cta: {text, href?}"],
  },
  slds_alert_list: {
    required: ["alerts: Array<{variant, text}>"],
    optional: [],
  },
  notification_banner: {
    required: ["heading"],
    optional: ["bannerType: 'mfa_nag'|'countersign_success'|'default'", "cta: {text, href?}"],
  },
};

export function getTemplateSummaries(): TemplateSummary[] {
  return Object.entries(SECTION_TEMPLATES).map(([name, tmpl]) => {
    const propInfo = TEMPLATE_PROPS[name] || { required: [], optional: [] };
    return {
      name,
      zone: tmpl.zone,
      description: tmpl.description,
      defaultWidth: tmpl.defaultWidth,
      requiredProps: propInfo.required,
      optionalProps: propInfo.optional,
    };
  });
}
