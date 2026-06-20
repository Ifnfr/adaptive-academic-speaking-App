"use client";

import React, { useState, useEffect } from "react";
import { SignInButton } from "@clerk/nextjs";
import { useSignIn } from "@clerk/nextjs/legacy";

// --- Inline SVGs ---

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5 sm:w-6 h-6"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function SparklesIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.69a5.74 5.74 0 0 1-2.49 3.77v3.13h4.01c2.34-2.16 3.69-5.32 3.69-8.73z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-4.01-3.13c-1.11.75-2.54 1.19-3.95 1.19-3.05 0-5.64-2.06-6.56-4.83H1.305v3.25C3.295 21.53 7.375 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.44 14.32a7.17 7.17 0 0 1 0-2.64V8.43H1.305a11.977 11.977 0 0 0 0 7.14l4.135-3.25z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.96 1.19 15.24 0 12 0 7.375 0 3.295 2.47 1.305 6.36L5.44 9.61c.92-2.77 3.51-4.86 6.56-4.86z"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform group-hover:translate-x-1 w-4 h-4 sm:w-5 h-5"
    >
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  );
}



// --- Typewriter Component ---

const TYPEWRITER_WORDS = ["speech.", "reading.", "writing.", "listening."];

function TypewriterEffect() {
  const [wordIndex, setWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const fullWord = TYPEWRITER_WORDS[wordIndex];

    if (isDeleting) {
      if (currentText === "") {
        timer = setTimeout(() => {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % TYPEWRITER_WORDS.length);
        }, 500);
      } else {
        timer = setTimeout(() => {
          setCurrentText((prev) => prev.slice(0, -1));
        }, 50);
      }
    } else {
      if (currentText === fullWord) {
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, 2000);
      } else {
        timer = setTimeout(() => {
          setCurrentText((prev) => fullWord.slice(0, prev.length + 1));
        }, 100);
      }
    }

    return () => clearTimeout(timer);
  }, [currentText, isDeleting, wordIndex]);

  return (
    <span
      className="text-teal-400 pr-2 sm:pr-4 relative inline-grid min-h-[1.15em] leading-[1.1] align-baseline"
      data-testid="typewriter-slot"
    >
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 whitespace-nowrap"
      >
        listening.
      </span>
      <span className="col-start-1 row-start-1 inline-flex min-h-[1.15em] items-center whitespace-nowrap">
        <span data-testid="typewriter-word">{currentText}</span>
        <span className="bg-teal-400 w-[2px] h-[0.8em] ml-1 animate-blink-cursor" />
      </span>
    </span>
  );
}

// --- Clerk Secured Login Card ---

function ClerkLoginForm({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("mockAuth") === "true") {
        onLoginSuccess();
        return;
      }
    }

    if (!isLoaded) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        onLoginSuccess();
      } else {
        throw new Error("Additional authentication steps are required.");
      }
    } catch (err: unknown) {
      console.error(err);
      let message = "Failed to sign in";
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "object" && err !== null && "errors" in err) {
        const clerkErr = err as { errors?: { message?: string }[] };
        if (clerkErr.errors?.[0]?.message) {
          message = clerkErr.errors[0].message;
        }
      }
      setErrorMsg(message);
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`bg-white/60 backdrop-blur-xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-12 relative overflow-hidden group w-full ${
        shake ? "animate-shake" : ""
      }`}
    >
      {/* Decorative inner glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#D3F0E3]/60 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 rounded-full pointer-events-none" />

      <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mb-8">
        Sign in to Fonetik
      </h2>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-xs text-red-600 font-medium">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 z-10 relative">
        {/* Email */}
        <div className="relative">
          <input
            id="email"
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white/50 border border-stone-200/80 rounded-2xl p-4 text-sm focus:bg-white focus:ring-2 focus:ring-[#1A554A]/10 focus:border-[#1A554A]/40 peer placeholder-transparent hover:border-stone-300 transition-all outline-none"
          />
          <label
            htmlFor="email"
            className="absolute left-4 top-4 text-sm text-stone-500 pointer-events-none transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:-top-2.5 peer-focus:text-[11px] peer-focus:text-[#1A554A] peer-focus:bg-white px-2 peer-[:not(:placeholder-shown)]:-top-2.5 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:bg-white rounded"
          >
            Email address
          </label>
        </div>

        {/* Password */}
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/50 border border-stone-200/80 rounded-2xl p-4 pr-12 text-sm focus:bg-white focus:ring-2 focus:ring-[#1A554A]/10 focus:border-[#1A554A]/40 peer placeholder-transparent hover:border-stone-300 transition-all outline-none"
          />
          <label
            htmlFor="password"
            className="absolute left-4 top-4 text-sm text-stone-500 pointer-events-none transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:-top-2.5 peer-focus:text-[11px] peer-focus:text-[#1A554A] peer-focus:bg-white px-2 peer-[:not(:placeholder-shown)]:-top-2.5 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:bg-white rounded"
          >
            Password
          </label>
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-4 text-stone-400 hover:text-stone-600 transition-colors focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {/* Auth Modifiers */}
        <div className="flex items-center justify-between text-xs mt-1">
          {/* Custom Star Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none group/check">
            <div className="relative w-5 h-5">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded-lg border border-stone-200 bg-white/50 peer-checked:bg-[#1A554A] peer-checked:border-[#1A554A] transition-all flex items-center justify-center group-hover/check:border-stone-300">
                <SparklesIcon className="w-2.5 h-2.5 text-white scale-0 peer-checked:scale-100 transition-transform duration-200" />
              </div>
            </div>
            <span className="text-stone-500 font-medium">Remember me</span>
          </label>

          <a
            href="#"
            className="text-[#1A554A] hover:underline font-semibold"
            onClick={(e) => {
              e.preventDefault();
              // Clerk handles password recovery, modal can be triggered
            }}
          >
            Forgot Password?
          </a>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="bg-[#1A554A] text-white py-4 rounded-2xl font-semibold mt-4 shadow-[0_4px_14px_rgba(26,85,74,0.15)] hover:shadow-[0_6px_20px_rgba(26,85,74,0.25)] transition-all flex items-center justify-center relative overflow-hidden group/btn disabled:opacity-75"
        >
          {/* Gleam Swipe Effect */}
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] skew-x-[-15deg] group-hover/btn:translate-x-[150%] transition-transform duration-700 ease-out pointer-events-none" />
          <span className="relative z-10">
            {loading ? "Signing in..." : "Sign In"}
          </span>
        </button>
      </form>

      {/* Google Auth Divider */}
      <div className="relative flex items-center justify-center my-6 z-10">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200" />
        </div>
        <span className="relative bg-[#F4F2E6] px-4 text-xs font-semibold uppercase tracking-wider text-stone-400">
          Or
        </span>
      </div>

      {/* Google Sign In button wrapped in Clerk's SignInButton */}
      <SignInButton mode="modal">
        <button
          type="button"
          className="w-full bg-white border border-stone-200/80 hover:border-stone-300 text-slate-700 font-semibold py-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center text-sm z-10 relative cursor-pointer"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </SignInButton>
    </div>
  );
}

// --- Local Mode Login Card ---

function LocalLoginForm({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    // Bypass authentication in local mode
    onLoginSuccess();
  };

  return (
    <div
      className={`bg-white/60 backdrop-blur-xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-12 relative overflow-hidden group w-full ${
        shake ? "animate-shake" : ""
      }`}
    >
      {/* Decorative inner glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#D3F0E3]/60 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 rounded-full pointer-events-none" />

      <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mb-8">
        Start Practice (Local Mode)
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 z-10 relative">
        {/* Email */}
        <div className="relative">
          <input
            id="local-email"
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white/50 border border-stone-200/80 rounded-2xl p-4 text-sm focus:bg-white focus:ring-2 focus:ring-[#1A554A]/10 focus:border-[#1A554A]/40 peer placeholder-transparent hover:border-stone-300 transition-all outline-none"
          />
          <label
            htmlFor="local-email"
            className="absolute left-4 top-4 text-sm text-stone-500 pointer-events-none transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:-top-2.5 peer-focus:text-[11px] peer-focus:text-[#1A554A] peer-focus:bg-white px-2 peer-[:not(:placeholder-shown)]:-top-2.5 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:bg-white rounded"
          >
            Email address
          </label>
        </div>

        {/* Password */}
        <div className="relative">
          <input
            id="local-password"
            type={showPassword ? "text" : "password"}
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/50 border border-stone-200/80 rounded-2xl p-4 pr-12 text-sm focus:bg-white focus:ring-2 focus:ring-[#1A554A]/10 focus:border-[#1A554A]/40 peer placeholder-transparent hover:border-stone-300 transition-all outline-none"
          />
          <label
            htmlFor="local-password"
            className="absolute left-4 top-4 text-sm text-stone-500 pointer-events-none transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:-top-2.5 peer-focus:text-[11px] peer-focus:text-[#1A554A] peer-focus:bg-white px-2 peer-[:not(:placeholder-shown)]:-top-2.5 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:bg-white rounded"
          >
            Password
          </label>
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-4 text-stone-400 hover:text-stone-600 transition-colors focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {/* Remember Me */}
        <div className="flex items-center text-xs mt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none group/check">
            <div className="relative w-5 h-5">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded-lg border border-stone-200 bg-white/50 peer-checked:bg-[#1A554A] peer-checked:border-[#1A554A] transition-all flex items-center justify-center group-hover/check:border-stone-300">
                <SparklesIcon className="w-2.5 h-2.5 text-white scale-0 peer-checked:scale-100 transition-transform duration-200" />
              </div>
            </div>
            <span className="text-stone-500 font-medium">Remember me</span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="bg-[#1A554A] text-white py-4 rounded-2xl font-semibold mt-4 shadow-[0_4px_14px_rgba(26,85,74,0.15)] hover:shadow-[0_6px_20px_rgba(26,85,74,0.25)] transition-all flex items-center justify-center relative overflow-hidden group/btn"
        >
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] skew-x-[-15deg] group-hover/btn:translate-x-[150%] transition-transform duration-700 ease-out pointer-events-none" />
          <span className="relative z-10">Start Practice</span>
        </button>
      </form>

      {/* Google Auth Divider */}
      <div className="relative flex items-center justify-center my-6 z-10">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200" />
        </div>
        <span className="relative bg-[#F4F2E6] px-4 text-xs font-semibold uppercase tracking-wider text-stone-400">
          Or
        </span>
      </div>

      {/* Direct Guest entry */}
      <button
        type="button"
        onClick={onLoginSuccess}
        className="w-full bg-white border border-stone-200/80 hover:border-stone-300 text-slate-700 font-semibold py-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center text-sm z-10 relative cursor-pointer"
      >
        Enter as Guest
      </button>
    </div>
  );
}

// --- Main Cover Page Component ---

export type CoverPageViewMode = "landing" | "login";

type CoverPageProps = {
  CLERK_ENABLED: boolean;
  onLoginSuccess: () => void;
};

export function CoverPage({ CLERK_ENABLED, onLoginSuccess }: CoverPageProps) {
  const [view, setView] = useState<CoverPageViewMode>("landing");

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white font-sans relative flex items-center justify-center p-4 sm:p-12 selection:bg-teal-500 selection:text-white overflow-x-hidden overflow-y-auto w-full">
      {/* Dynamic styles tag to avoid global.css edits */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes branding-entrance {
          0% {
            transform: scale(0.9);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes card-entrance {
          0% {
            opacity: 0;
            transform: translate3d(20px, 0, 0) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes shake {
          0%, 100% { transform: translate3d(0, 0, 0); }
          20%, 60% { transform: translate3d(-8px, 0, 0); }
          40%, 80% { transform: translate3d(8px, 0, 0); }
        }
        .animate-blink-cursor {
          animation: blink-cursor 1s step-end infinite;
        }
        .animate-branding {
          animation: branding-entrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 0.1s;
        }
        .animate-card-entrance {
          animation: card-entrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-branding, .animate-card-entrance, .animate-shake {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      ` }} />

      {/* Diffused spotlight mesh gradient */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-teal-600/20 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[30vw] h-[30vw] bg-teal-800/20 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Main Layout wrapper */}
      <div
        className={`relative z-10 w-full max-w-6xl flex flex-col lg:flex-row items-center gap-10 sm:gap-16 lg:gap-8 min-h-[600px] py-10 lg:py-0 transition-all duration-700 ease-out ${
          view === "landing" ? "justify-center" : "justify-between"
        }`}
      >
        {/* Branding Group (Left text group) */}
        <div
          className={`flex flex-col transition-all duration-700 ease-out ${
            view === "landing"
              ? "items-center text-center max-w-3xl"
              : "items-start text-left lg:w-[48%] max-w-xl"
          }`}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 animate-branding opacity-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-teal-500 text-white shadow-xl shadow-teal-500/20 flex items-center justify-center">
              <MicIcon />
            </div>
            <span className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-white">
              fonetik
            </span>
          </div>

          {/* Heading */}
          <h1
            className={`text-white leading-[1.1] font-display font-extrabold tracking-tight transition-all duration-700 ease-out mt-6 sm:mt-8 ${
              view === "landing"
                ? "text-5xl sm:text-7xl lg:text-8xl"
                : "text-4xl sm:text-5xl lg:text-6xl"
            }`}
          >
            Master your
            {view === "landing" && <br className="hidden md:inline" />}
            <span className="inline-block md:ml-3 ml-2">
              <TypewriterEffect />
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className={`text-gray-400 font-light leading-relaxed transition-all duration-700 ease-out mt-4 sm:mt-6 ${
              view === "landing"
                ? "text-lg sm:text-xl max-w-2xl mx-auto"
                : "text-base sm:text-lg"
            }`}
          >
            Stop sounding unsure. Train your articulation, expand your academic
            vocabulary, and speak with absolute authority.
          </p>

          {/* Start CTA */}
          {view === "landing" && (
            <button
              type="button"
              onClick={() => setView("login")}
              className="mt-8 sm:mt-10 bg-teal-500 text-white rounded-full font-semibold px-8 sm:px-10 py-3.5 sm:py-4 transition-all duration-300 shadow-[0_4px_14px_rgba(20,184,166,0.3)] hover:bg-teal-400 hover:scale-105 hover:shadow-[0_6px_20px_rgba(20,184,166,0.4)] flex items-center gap-2 group cursor-pointer"
            >
              Start
              <ArrowRightIcon />
            </button>
          )}
        </div>

        {/* Right Group (Login Card) */}
        {view === "login" && (
          <div className="lg:w-[46%] w-full max-w-md animate-card-entrance opacity-0">
            {CLERK_ENABLED ? (
              <ClerkLoginForm onLoginSuccess={onLoginSuccess} />
            ) : process.env.NODE_ENV === "production" ? (
              <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-red-700 font-sans text-sm shadow-sm">
                <h3 className="font-semibold text-base mb-2">Service Configuration Error</h3>
                <p className="leading-5">Authentication service is not configured. Please contact the system administrator to configure Clerk keys.</p>
              </div>
            ) : (
              <LocalLoginForm onLoginSuccess={onLoginSuccess} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
