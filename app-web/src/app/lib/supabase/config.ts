export type SupabaseBrowserConfig =
  | {
      enabled: true;
      url: string;
      publishableKey: string;
      disabledReason: null;
    }
  | {
      enabled: false;
      url: null;
      publishableKey: null;
      disabledReason:
        | "missing-url"
        | "missing-publishable-key"
        | "missing-url-and-publishable-key";
    };

function readPublicEnvValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function getSupabaseBrowserConfig(): SupabaseBrowserConfig {
  const url = readPublicEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = readPublicEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (url && publishableKey) {
    return {
      enabled: true,
      url,
      publishableKey,
      disabledReason: null,
    };
  }

  if (!url && !publishableKey) {
    return {
      enabled: false,
      url: null,
      publishableKey: null,
      disabledReason: "missing-url-and-publishable-key",
    };
  }

  return {
    enabled: false,
    url: null,
    publishableKey: null,
    disabledReason: url ? "missing-publishable-key" : "missing-url",
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseBrowserConfig().enabled;
}
