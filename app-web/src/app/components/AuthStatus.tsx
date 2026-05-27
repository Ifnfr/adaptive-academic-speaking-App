"use client";

import {
  SignInButton,
  SignOutButton,
  useAuth,
  useUser,
} from "@clerk/nextjs";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function AuthUserLabel() {
  const { user } = useUser();
  const label =
    user?.primaryEmailAddress?.emailAddress ?? user?.fullName ?? "Signed in";

  return (
    <span className="max-w-[180px] truncate text-[11px] text-[var(--brand-ink-soft)]">
      {label}
    </span>
  );
}

export function AuthStatus() {
  if (!clerkEnabled) {
    return (
      <span className="inline-flex items-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-1 text-[11px] text-[var(--brand-muted)]">
        Local mode
      </span>
    );
  }

  return <ClerkAuthStatus />;
}

function ClerkAuthStatus() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <span className="inline-flex items-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-1 text-[11px] text-[var(--brand-muted)]">
        Auth loading
      </span>
    );
  }

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button
          type="button"
          className="rounded-full border border-[var(--brand-teal)] bg-[var(--brand-teal-soft)] px-3 py-1 text-[11px] font-medium text-[var(--brand-teal-ink)] transition-colors hover:bg-[var(--brand-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
        >
          Sign In
        </button>
      </SignInButton>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-1">
      <AuthUserLabel />
      <SignOutButton>
        <button
          type="button"
          className="text-[11px] font-medium text-[var(--brand-teal-ink)] hover:text-[var(--brand-teal)] focus:outline-none focus:underline"
        >
          Sign Out
        </button>
      </SignOutButton>
    </span>
  );
}
