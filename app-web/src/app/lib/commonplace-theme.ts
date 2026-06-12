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
  "emerald",
  "forest",
  "teal",
  "ocean",
  "navy",
  "plum",
  "terracotta",
  "graphite",
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
  emerald: {
    id: "emerald",
    label: "Emerald",
    swatch: "#047857",
    canvas: {
      panel: "#064E3B",
      ring: "rgba(110,231,183,0.42)",
      bubble: "rgba(4,120,87,0.74)",
      bubbleSoft: "rgba(6,78,59,0.62)",
      grid: "#34D399",
      minimapMask: "rgba(6,78,59,0.72)",
    },
    card: {
      surface: "#065F46",
      footer: "#064E3B",
      border: "#10B981",
      hover: "#047857",
      tag: "#047857",
      tagBorder: "rgba(167,243,208,0.32)",
      ink: "#ECFDF5",
      inkSoft: "#A7F3D0",
      accent: "#6EE7B7",
      accentSoft: "#D1FAE5",
    },
  },
  forest: {
    id: "forest",
    label: "Forest",
    swatch: "#365314",
    canvas: {
      panel: "#1F2E1D",
      ring: "rgba(190,242,100,0.36)",
      bubble: "rgba(54,83,20,0.72)",
      bubbleSoft: "rgba(31,46,29,0.66)",
      grid: "#A3E635",
      minimapMask: "rgba(31,46,29,0.74)",
    },
    card: {
      surface: "#263719",
      footer: "#1F2E1D",
      border: "#84CC16",
      hover: "#365314",
      tag: "#365314",
      tagBorder: "rgba(217,249,157,0.28)",
      ink: "#F7FEE7",
      inkSoft: "#D9F99D",
      accent: "#BEF264",
      accentSoft: "#ECFCCB",
    },
  },
  teal: {
    id: "teal",
    label: "Teal",
    swatch: "#0F766E",
    canvas: {
      panel: "#0F3F3A",
      ring: "rgba(94,234,212,0.38)",
      bubble: "rgba(15,118,110,0.7)",
      bubbleSoft: "rgba(19,78,74,0.64)",
      grid: "#2DD4BF",
      minimapMask: "rgba(15,63,58,0.74)",
    },
    card: {
      surface: "#134E4A",
      footer: "#0F3F3A",
      border: "#2DD4BF",
      hover: "#0F766E",
      tag: "#0F766E",
      tagBorder: "rgba(153,246,228,0.3)",
      ink: "#F0FDFA",
      inkSoft: "#99F6E4",
      accent: "#5EEAD4",
      accentSoft: "#CCFBF1",
    },
  },
  ocean: {
    id: "ocean",
    label: "Ocean",
    swatch: "#0369A1",
    canvas: {
      panel: "#0C4A6E",
      ring: "rgba(125,211,252,0.38)",
      bubble: "rgba(3,105,161,0.7)",
      bubbleSoft: "rgba(12,74,110,0.64)",
      grid: "#38BDF8",
      minimapMask: "rgba(12,74,110,0.72)",
    },
    card: {
      surface: "#075985",
      footer: "#0C4A6E",
      border: "#38BDF8",
      hover: "#0369A1",
      tag: "#0369A1",
      tagBorder: "rgba(186,230,253,0.28)",
      ink: "#F0F9FF",
      inkSoft: "#BAE6FD",
      accent: "#7DD3FC",
      accentSoft: "#E0F2FE",
    },
  },
  navy: {
    id: "navy",
    label: "Navy",
    swatch: "#1E3A8A",
    canvas: {
      panel: "#172554",
      ring: "rgba(147,197,253,0.36)",
      bubble: "rgba(30,58,138,0.7)",
      bubbleSoft: "rgba(23,37,84,0.66)",
      grid: "#60A5FA",
      minimapMask: "rgba(23,37,84,0.74)",
    },
    card: {
      surface: "#1E3A8A",
      footer: "#172554",
      border: "#60A5FA",
      hover: "#1D4ED8",
      tag: "#1D4ED8",
      tagBorder: "rgba(191,219,254,0.28)",
      ink: "#EFF6FF",
      inkSoft: "#BFDBFE",
      accent: "#93C5FD",
      accentSoft: "#DBEAFE",
    },
  },
  plum: {
    id: "plum",
    label: "Plum",
    swatch: "#6D28D9",
    canvas: {
      panel: "#3B0764",
      ring: "rgba(216,180,254,0.36)",
      bubble: "rgba(109,40,217,0.66)",
      bubbleSoft: "rgba(59,7,100,0.66)",
      grid: "#C084FC",
      minimapMask: "rgba(59,7,100,0.72)",
    },
    card: {
      surface: "#581C87",
      footer: "#3B0764",
      border: "#A855F7",
      hover: "#6D28D9",
      tag: "#6D28D9",
      tagBorder: "rgba(233,213,255,0.28)",
      ink: "#FAF5FF",
      inkSoft: "#E9D5FF",
      accent: "#D8B4FE",
      accentSoft: "#F3E8FF",
    },
  },
  terracotta: {
    id: "terracotta",
    label: "Terracotta",
    swatch: "#C2410C",
    canvas: {
      panel: "#7C2D12",
      ring: "rgba(253,186,116,0.38)",
      bubble: "rgba(194,65,12,0.68)",
      bubbleSoft: "rgba(124,45,18,0.66)",
      grid: "#FB923C",
      minimapMask: "rgba(124,45,18,0.72)",
    },
    card: {
      surface: "#9A3412",
      footer: "#7C2D12",
      border: "#FB923C",
      hover: "#C2410C",
      tag: "#C2410C",
      tagBorder: "rgba(254,215,170,0.3)",
      ink: "#FFF7ED",
      inkSoft: "#FED7AA",
      accent: "#FDBA74",
      accentSoft: "#FFEDD5",
    },
  },
  graphite: {
    id: "graphite",
    label: "Graphite",
    swatch: "#374151",
    canvas: {
      panel: "#111827",
      ring: "rgba(156,163,175,0.38)",
      bubble: "rgba(55,65,81,0.7)",
      bubbleSoft: "rgba(17,24,39,0.68)",
      grid: "#9CA3AF",
      minimapMask: "rgba(17,24,39,0.74)",
    },
    card: {
      surface: "#1F2937",
      footer: "#111827",
      border: "#6B7280",
      hover: "#374151",
      tag: "#374151",
      tagBorder: "rgba(209,213,219,0.24)",
      ink: "#F9FAFB",
      inkSoft: "#D1D5DB",
      accent: "#E5E7EB",
      accentSoft: "#F3F4F6",
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
