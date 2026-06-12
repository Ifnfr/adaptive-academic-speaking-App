import type { CSSProperties } from "react";

type CommonplaceThemeStyle = CSSProperties & Record<`--${string}`, string>;

export const COMMONPLACE_THEME_COLOR_IDS = [
  "default",
  "paper",
  "sage",
  "sand",
  "sky",
  "lavender",
  "rose",
  "slate",
  "charcoal",
] as const;

export type CommonplaceThemeColorId =
  (typeof COMMONPLACE_THEME_COLOR_IDS)[number];

type CommonplaceThemeOption = {
  id: CommonplaceThemeColorId;
  label: string;
  swatch: string;
  canvas: {
    panel: string;
    ring: string;
    bubble: string;
    bubbleSoft: string;
    grid: string;
    minimapMask: string;
  };
  card: {
    surface: string;
    footer: string;
    border: string;
    hover: string;
    tag: string;
    tagBorder: string;
    ink: string;
    inkSoft: string;
    accent: string;
    accentSoft: string;
  };
};

export type CommonplaceCanvasTheme = {
  id: CommonplaceThemeColorId;
  panelStyle: CommonplaceThemeStyle;
  mainBackgroundStyle: CSSProperties;
  subBackgroundStyle: CSSProperties;
  gridColor: string;
  minimapMaskColor: string;
};

export type CommonplaceCardTheme = {
  id: CommonplaceThemeColorId;
  style: CommonplaceThemeStyle;
  footerStyle: CommonplaceThemeStyle;
  tagStyle: CommonplaceThemeStyle;
  selectedStyle: CommonplaceThemeStyle;
  addTileStyle: CommonplaceThemeStyle;
};

const COMMONPLACE_THEME_OPTIONS: Record<
  CommonplaceThemeColorId,
  CommonplaceThemeOption
> = {
  default: {
    id: "default",
    label: "Default",
    swatch: "#EEF3F1",
    canvas: {
      panel: "#EEF3F1",
      ring: "rgba(183,212,200,0.7)",
      bubble: "rgba(221,235,229,0.82)",
      bubbleSoft: "rgba(238,243,241,0.56)",
      grid: "#B7D4C8",
      minimapMask: "rgba(238,243,241,0.72)",
    },
    card: {
      surface: "#FFFDF8",
      footer: "#FAF8F2",
      border: "#C9D8D1",
      hover: "#E4F3EC",
      tag: "#E4F3EC",
      tagBorder: "rgba(15,118,110,0.2)",
      ink: "#263B35",
      inkSoft: "#4F6A62",
      accent: "#0F766E",
      accentSoft: "#134E44",
    },
  },
  paper: {
    id: "paper",
    label: "Paper",
    swatch: "#F7F0DF",
    canvas: {
      panel: "#F4EFE3",
      ring: "rgba(196,177,130,0.42)",
      bubble: "rgba(247,240,223,0.82)",
      bubbleSoft: "rgba(255,250,239,0.62)",
      grid: "#D6CBAF",
      minimapMask: "rgba(247,240,223,0.72)",
    },
    card: {
      surface: "#FFF8EA",
      footer: "#F7F0DF",
      border: "#D8C8A8",
      hover: "#F4E8CE",
      tag: "#F4E8CE",
      tagBorder: "rgba(151,116,45,0.22)",
      ink: "#3F3420",
      inkSoft: "#65563F",
      accent: "#806125",
      accentSoft: "#5E4619",
    },
  },
  sage: {
    id: "sage",
    label: "Sage",
    swatch: "#DDEBE5",
    canvas: {
      panel: "#E7F0EC",
      ring: "rgba(151,190,174,0.52)",
      bubble: "rgba(221,235,229,0.86)",
      bubbleSoft: "rgba(237,246,241,0.58)",
      grid: "#AFCFC2",
      minimapMask: "rgba(231,240,236,0.74)",
    },
    card: {
      surface: "#F4FBF7",
      footer: "#E4F3EC",
      border: "#BFD8CE",
      hover: "#DDEBE5",
      tag: "#DDEBE5",
      tagBorder: "rgba(15,118,110,0.24)",
      ink: "#243D35",
      inkSoft: "#496B5F",
      accent: "#0F766E",
      accentSoft: "#134E44",
    },
  },
  sand: {
    id: "sand",
    label: "Sand",
    swatch: "#EAD8B7",
    canvas: {
      panel: "#F0E6D2",
      ring: "rgba(197,155,86,0.38)",
      bubble: "rgba(234,216,183,0.7)",
      bubbleSoft: "rgba(249,241,225,0.62)",
      grid: "#D4BC8F",
      minimapMask: "rgba(240,230,210,0.74)",
    },
    card: {
      surface: "#FFF6E4",
      footer: "#F1E3C8",
      border: "#D6BE92",
      hover: "#ECD6AD",
      tag: "#F1E3C8",
      tagBorder: "rgba(151,103,32,0.22)",
      ink: "#49371E",
      inkSoft: "#675434",
      accent: "#7A4A00",
      accentSoft: "#5C3900",
    },
  },
  sky: {
    id: "sky",
    label: "Sky",
    swatch: "#DBEAFE",
    canvas: {
      panel: "#EAF3FB",
      ring: "rgba(147,197,253,0.44)",
      bubble: "rgba(219,234,254,0.78)",
      bubbleSoft: "rgba(239,246,255,0.62)",
      grid: "#B7D3F2",
      minimapMask: "rgba(234,243,251,0.74)",
    },
    card: {
      surface: "#F8FBFF",
      footer: "#EAF3FB",
      border: "#BFD3EA",
      hover: "#DBEAFE",
      tag: "#DBEAFE",
      tagBorder: "rgba(37,99,235,0.2)",
      ink: "#24384F",
      inkSoft: "#445B74",
      accent: "#1D4ED8",
      accentSoft: "#1E3A8A",
    },
  },
  lavender: {
    id: "lavender",
    label: "Lavender",
    swatch: "#E9DDF8",
    canvas: {
      panel: "#F0EAF7",
      ring: "rgba(196,181,253,0.44)",
      bubble: "rgba(233,221,248,0.78)",
      bubbleSoft: "rgba(247,243,252,0.6)",
      grid: "#C9B8E9",
      minimapMask: "rgba(240,234,247,0.74)",
    },
    card: {
      surface: "#FCF8FF",
      footer: "#F0EAF7",
      border: "#CEBFE3",
      hover: "#E9DDF8",
      tag: "#E9DDF8",
      tagBorder: "rgba(109,40,217,0.18)",
      ink: "#3E3350",
      inkSoft: "#5D506F",
      accent: "#6D28D9",
      accentSoft: "#4C1D95",
    },
  },
  rose: {
    id: "rose",
    label: "Rose",
    swatch: "#F9DEE5",
    canvas: {
      panel: "#F6EAED",
      ring: "rgba(244,114,182,0.34)",
      bubble: "rgba(249,222,229,0.76)",
      bubbleSoft: "rgba(255,241,244,0.58)",
      grid: "#E9B8C6",
      minimapMask: "rgba(246,234,237,0.74)",
    },
    card: {
      surface: "#FFF8FA",
      footer: "#F6EAED",
      border: "#E3BBC5",
      hover: "#F9DEE5",
      tag: "#F9DEE5",
      tagBorder: "rgba(190,24,93,0.18)",
      ink: "#4F3038",
      inkSoft: "#6B4F57",
      accent: "#BE185D",
      accentSoft: "#8A1246",
    },
  },
  slate: {
    id: "slate",
    label: "Slate",
    swatch: "#E2E8F0",
    canvas: {
      panel: "#E8EDF2",
      ring: "rgba(148,163,184,0.46)",
      bubble: "rgba(226,232,240,0.78)",
      bubbleSoft: "rgba(248,250,252,0.56)",
      grid: "#B8C4D2",
      minimapMask: "rgba(232,237,242,0.74)",
    },
    card: {
      surface: "#F8FAFC",
      footer: "#EEF2F6",
      border: "#C5D0DD",
      hover: "#E2E8F0",
      tag: "#E2E8F0",
      tagBorder: "rgba(51,65,85,0.18)",
      ink: "#27313F",
      inkSoft: "#4C5968",
      accent: "#334155",
      accentSoft: "#1E293B",
    },
  },
  charcoal: {
    id: "charcoal",
    label: "Charcoal",
    swatch: "#D8DDD9",
    canvas: {
      panel: "#E0E5E1",
      ring: "rgba(95,125,116,0.44)",
      bubble: "rgba(216,221,217,0.78)",
      bubbleSoft: "rgba(238,241,238,0.58)",
      grid: "#9FB0AA",
      minimapMask: "rgba(224,229,225,0.74)",
    },
    card: {
      surface: "#F3F5F1",
      footer: "#E5E8E1",
      border: "#B7C2BB",
      hover: "#D8DDD9",
      tag: "#E5E8E1",
      tagBorder: "rgba(47,67,61,0.18)",
      ink: "#26302C",
      inkSoft: "#4E5D58",
      accent: "#2F433D",
      accentSoft: "#1F2E2A",
    },
  },
};

export const COMMONPLACE_THEME_CHOICES = COMMONPLACE_THEME_COLOR_IDS.map(
  (id) => ({
    id,
    label: COMMONPLACE_THEME_OPTIONS[id].label,
    swatch: COMMONPLACE_THEME_OPTIONS[id].swatch,
  }),
);

export function isCommonplaceThemeColorId(
  value: unknown,
): value is CommonplaceThemeColorId {
  return (
    typeof value === "string" &&
    COMMONPLACE_THEME_COLOR_IDS.includes(value as CommonplaceThemeColorId)
  );
}

export function normalizeCommonplaceThemeColorId(
  value: unknown,
): CommonplaceThemeColorId {
  return isCommonplaceThemeColorId(value) ? value : "default";
}

export function assertCommonplaceThemeColorId(
  value: unknown,
): CommonplaceThemeColorId {
  if (isCommonplaceThemeColorId(value)) return value;
  throw new Error("invalid_commonplace_theme_color");
}

export function getCommonplaceCanvasTheme(
  value: unknown,
): CommonplaceCanvasTheme {
  const id = normalizeCommonplaceThemeColorId(value);
  const option = COMMONPLACE_THEME_OPTIONS[id];

  return {
    id,
    panelStyle: {
      "--commonplace-panel-bg": option.canvas.panel,
      "--commonplace-panel-ink": option.card.ink,
      "--commonplace-panel-ink-soft": option.card.inkSoft,
      "--commonplace-panel-accent": option.card.accent,
      "--commonplace-panel-accent-soft": option.card.accentSoft,
      "--commonplace-panel-border": option.card.border,
      backgroundColor: option.canvas.panel,
      borderColor: option.card.border,
    },
    mainBackgroundStyle: {
      backgroundImage: [
        `radial-gradient(circle at 18% 18%, ${option.canvas.bubble} 0 120px, transparent 121px)`,
        `radial-gradient(circle at 82% 76%, ${option.canvas.bubbleSoft} 0 150px, transparent 151px)`,
        `linear-gradient(180deg, ${option.canvas.panel}, ${option.canvas.bubbleSoft})`,
      ].join(", "),
    },
    subBackgroundStyle: {
      backgroundImage: [
        "radial-gradient(circle at 24% 28%, rgba(15,118,110,0.16) 0 2px, transparent 3px)",
        `radial-gradient(circle at 24% 28%, transparent 0 82px, ${option.canvas.ring} 83px 85px, transparent 86px)`,
        `radial-gradient(circle at 68% 34%, transparent 0 118px, ${option.canvas.ring} 119px 121px, transparent 122px)`,
        `radial-gradient(circle at 52% 72%, transparent 0 96px, ${option.canvas.ring} 97px 99px, transparent 100px)`,
        `radial-gradient(circle at 15% 82%, ${option.canvas.bubble} 0 34px, transparent 35px)`,
        `linear-gradient(180deg, ${option.canvas.bubble}, ${option.canvas.bubbleSoft})`,
      ].join(", "),
    },
    gridColor: option.canvas.grid,
    minimapMaskColor: option.canvas.minimapMask,
  };
}

export function getCommonplaceCardTheme(
  value: unknown,
): CommonplaceCardTheme {
  const id = normalizeCommonplaceThemeColorId(value);
  const option = COMMONPLACE_THEME_OPTIONS[id];

  return {
    id,
    style: {
      "--commonplace-card-bg": option.card.surface,
      "--commonplace-card-border": option.card.border,
      "--commonplace-card-ink": option.card.ink,
      "--commonplace-card-ink-soft": option.card.inkSoft,
      "--commonplace-card-accent": option.card.accent,
      "--commonplace-card-accent-soft": option.card.accentSoft,
      backgroundColor: option.card.surface,
      borderColor: option.card.border,
      color: option.card.ink,
    },
    footerStyle: {
      "--commonplace-card-bg": option.card.footer,
      "--commonplace-card-border": option.card.border,
      "--commonplace-card-ink": option.card.ink,
      "--commonplace-card-ink-soft": option.card.inkSoft,
      "--commonplace-card-accent": option.card.accent,
      "--commonplace-card-accent-soft": option.card.accentSoft,
      backgroundColor: option.card.footer,
      borderColor: option.card.border,
      color: option.card.accent,
    },
    tagStyle: {
      "--commonplace-card-bg": option.card.tag,
      "--commonplace-card-border": option.card.tagBorder,
      "--commonplace-card-ink": option.card.ink,
      "--commonplace-card-ink-soft": option.card.inkSoft,
      "--commonplace-card-accent": option.card.accent,
      "--commonplace-card-accent-soft": option.card.accentSoft,
      backgroundColor: option.card.tag,
      borderColor: option.card.tagBorder,
      color: option.card.accentSoft,
    },
    selectedStyle: {
      "--commonplace-card-bg": option.card.hover,
      "--commonplace-card-border": "#0F766E",
      "--commonplace-card-ink": option.card.ink,
      "--commonplace-card-ink-soft": option.card.inkSoft,
      "--commonplace-card-accent": option.card.accent,
      "--commonplace-card-accent-soft": option.card.accentSoft,
      backgroundColor: option.card.hover,
      borderColor: "#0F766E",
      color: option.card.ink,
    },
    addTileStyle: {
      "--commonplace-card-bg": option.card.surface,
      "--commonplace-card-border": "#0F766E73",
      "--commonplace-card-ink": option.card.ink,
      "--commonplace-card-ink-soft": option.card.inkSoft,
      "--commonplace-card-accent": option.card.accent,
      "--commonplace-card-accent-soft": option.card.accentSoft,
      backgroundColor: option.card.surface,
      borderColor: "#0F766E73",
      color: option.card.ink,
    },
  };
}
