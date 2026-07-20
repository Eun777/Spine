"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthMode = "signin" | "signup";

interface AuthResponse {
  error?: string;
  needsConfirmation?: boolean;
}

export default function LoginPage() {
  const router = useRouter();

  // Form & Mode State
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Status & UI State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isSignIn = mode === "signin";

  // Toggle between sign in and sign up modes
  const handleToggleMode = () => {
    setMode((prev) => (prev === "signin" ? "signup" : "signin"));
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Form submission handler
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data: AuthResponse = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed. Please try again.");
      }

      if (data.needsConfirmation) {
        setSuccessMessage("Check your email to confirm your account, then sign in.");
        setMode("signin");
        setPassword("");
        return;
      }

      // Successful auth -> Navigate to homepage
      router.push("/");
      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="shell auth-shell">
      <div className="auth-card">
        <p className="eyebrow">Private library</p>
        
        <h1>{isSignIn ? "Welcome back" : "Create an account"}</h1>
        <p className="lede">
          {isSignIn
            ? "Sign in to open your collection."
            : "Your books stay private to your account."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isLoading}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete={isSignIn ? "current-password" : "new-password"}
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              disabled={isLoading}
            />
          </label>

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p className="form-success" role="status">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            className="primary auth-submit"
            disabled={isLoading}
          >
            {isLoading
              ? "Please wait…"
              : isSignIn
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <button
          type="button"
          className="text-btn"
          onClick={handleToggleMode}
          disabled={isLoading}
        >
          {isSignIn
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </section>
  );
}
