"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient, signIn } from "@/lib/auth/client";
import { sanitizeCallbackUrl } from "@/proxy";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get("callbackUrl");
  const callbackUrl = sanitizeCallbackUrl(rawCallbackUrl);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (needsTwoFactor) {
        const res = await authClient.twoFactor.verifyTotp({
          code: totpCode,
        });

        if (res.error) {
          setError(res.error.message || "Invalid two-factor code");
          setLoading(false);
          return;
        }

        router.push(callbackUrl);
        return;
      }

      const res = await signIn.email({
        email: email.trim().toLowerCase(),
        password,
        callbackURL: callbackUrl,
      });

      if (res.error) {
        if (res.error.status === 429) {
          setError("Too many requests. Please try again later.");
        } else {
          // Enumeration-safe error message
          setError("Invalid email or password.");
        }
        setLoading(false);
        return;
      }

      // Check if two factor is required
      if (
        res.data &&
        "twoFactorRedirect" in res.data &&
        res.data.twoFactorRedirect
      ) {
        setNeedsTwoFactor(true);
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
    } catch {
      // Enumeration-safe fallback
      setError("Invalid email or password.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-sm">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
          Sign In
        </h1>
        <p className="text-sm text-zinc-400">
          Open College Learning Management System
        </p>
      </div>

      {error && (
        <div
          role="alert"
          id="error-message"
          data-testid="error-alert"
          className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-sm text-red-200 animate-in fade-in"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
        data-testid="sign-in-form"
      >
        {!needsTwoFactor ? (
          <>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                data-testid="email-input"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                data-testid="password-input"
              />
            </div>
          </>
        ) : (
          <div>
            <label
              htmlFor="totp-code"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2"
            >
              Two-Factor Authentication Code
            </label>
            <input
              id="totp-code"
              name="totpCode"
              type="text"
              required
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="6-digit code"
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-center tracking-widest text-lg placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              data-testid="totp-input"
            />
            <p className="text-xs text-zinc-400 mt-2 text-center">
              Enter the verification code from your authenticator app.
            </p>
          </div>
        )}

        <button
          type="submit"
          id="sign-in-btn"
          disabled={loading}
          data-testid="submit-button"
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/25 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? "Authenticating..."
            : needsTwoFactor
              ? "Verify Code"
              : "Sign In"}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-zinc-800/80 text-center space-y-3">
        <p className="text-xs text-zinc-400">
          Public sign-up is disabled. Access is granted via invitation only.
        </p>
        <p className="text-xs text-zinc-500">
          Lost access? Contact your college administrator for a reset link.
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      <Suspense
        fallback={<div className="text-zinc-400">Loading sign-in...</div>}
      >
        <SignInForm />
      </Suspense>
    </main>
  );
}
