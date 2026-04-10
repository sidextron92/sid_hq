"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  GlassButton,
  GlassFormField,
  SegmentControl,
} from "@/components/glass";
import LiquidGlassWrap from "@/components/glass/LiquidGlassWrap";

export default function LoginPage() {
  const { user, loading, login, signup, verifySignupOtp } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState(0); // 0 = Login, 1 = Sign Up
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpId, setOtpId] = useState<string | null>(null); // non-null = OTP sent after signup
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  // ─── Login (password-based) ────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      router.replace("/");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      if (message.includes("Failed to authenticate")) {
        setError("Invalid email or password.");
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Signup Step 1: create account + send OTP ──
  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const id = await signup(email, password, name);
      setOtpId(id);
      setSuccess("Account created! Enter the OTP sent to your email.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      if (message.includes("validation_invalid_email")) {
        setError("Please enter a valid email address.");
      } else if (message.includes("validation_not_unique")) {
        setError("An account with this email already exists.");
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Signup Step 2: verify OTP ─────────────────
  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      setError("Please enter the OTP code.");
      return;
    }

    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      await verifySignupOtp(otpId!, otpCode);
      router.replace("/");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      if (message.includes("Failed to authenticate")) {
        setError("Invalid or expired OTP.");
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (mode === 0) {
        handleLogin();
      } else if (otpId) {
        handleVerifyOtp();
      } else {
        handleSignup();
      }
    }
  };

  if (loading) return null;
  if (user) return null;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      {/* Video background */}
      <video
        className="absolute inset-0 z-0 w-full h-full object-cover"
        src="/background.webm"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Dim overlay */}
      <div
        className="absolute inset-0 z-0"
        style={{ background: "rgba(0, 0, 0, 0.3)" }}
      />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-[420px] mx-4">
        <LiquidGlassWrap
          cornerRadius={24}
          padding="0"
          blurAmount={25}
          displacementScale={60}
          saturation={160}
          shadowIntensity={1.8}
          elasticity={0}
        >
          <div className="p-8" onKeyDown={handleKeyDown}>
            {/* Header */}
            <h1
              className="text-2xl font-black tracking-tight mb-1"
              style={{ color: "var(--text-main, #fcfcfd)" }}
            >
              Control Centre
            </h1>
            <p
              className="text-sm mb-6"
              style={{ color: "rgba(255, 255, 255, 0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
            >
              {mode === 0
                ? "Sign in to your account"
                : otpId
                  ? "Enter the OTP sent to your email"
                  : "Create a new account"}
            </p>

            {/* Mode toggle — hide during OTP verification */}
            {!otpId && (
              <div className="mb-6">
                <SegmentControl
                  segments={["Login", "Sign Up"]}
                  activeIndex={mode}
                  onChange={(i) => {
                    setMode(i);
                    setError("");
                    setSuccess("");
                  }}
                />
              </div>
            )}

            {/* Form fields */}
            <div className="flex flex-col gap-5">
              {/* ─── LOGIN MODE ─── */}
              {mode === 0 && (
                <>
                  <GlassFormField
                    label="Email"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={setEmail}
                  />
                  <GlassFormField
                    label="Password"
                    placeholder="Enter password..."
                    type="password"
                    value={password}
                    onChange={setPassword}
                  />
                </>
              )}

              {/* ─── SIGNUP MODE: form ─── */}
              {mode === 1 && !otpId && (
                <>
                  <GlassFormField
                    label="Name"
                    placeholder="Your name..."
                    value={name}
                    onChange={setName}
                  />
                  <GlassFormField
                    label="Email"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={setEmail}
                  />
                  <GlassFormField
                    label="Password"
                    placeholder="Min 8 characters..."
                    type="password"
                    value={password}
                    onChange={setPassword}
                  />
                </>
              )}

              {/* ─── SIGNUP MODE: OTP verification ─── */}
              {mode === 1 && otpId && (
                <>
                  <p
                    className="text-sm"
                    style={{ color: "rgba(255, 255, 255, 0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
                  >
                    OTP sent to <strong style={{ color: "#fcfcfd" }}>{email}</strong>
                  </p>
                  <GlassFormField
                    label="OTP Code"
                    placeholder="Enter code..."
                    value={otpCode}
                    onChange={setOtpCode}
                  />
                </>
              )}

              {/* Success message */}
              {success && (
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#4ade80", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
                >
                  {success}
                </p>
              )}

              {/* Error message */}
              {error && (
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#f87171", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
                >
                  {error}
                </p>
              )}

              {/* ─── BUTTONS ─── */}
              {mode === 0 && (
                <GlassButton
                  tint="rgba(99, 102, 241, 0.3)"
                  onClick={handleLogin}
                  disabled={submitting}
                >
                  {submitting ? "Signing in..." : "Sign In"}
                </GlassButton>
              )}

              {mode === 1 && !otpId && (
                <GlassButton
                  tint="rgba(99, 102, 241, 0.3)"
                  onClick={handleSignup}
                  disabled={submitting}
                >
                  {submitting ? "Creating account..." : "Create Account"}
                </GlassButton>
              )}

              {mode === 1 && otpId && (
                <div className="flex gap-3">
                  <GlassButton
                    size="sm"
                    onClick={() => {
                      setOtpId(null);
                      setOtpCode("");
                      setError("");
                      setSuccess("");
                    }}
                  >
                    Back
                  </GlassButton>
                  <GlassButton
                    tint="rgba(99, 102, 241, 0.3)"
                    onClick={handleVerifyOtp}
                    disabled={submitting}
                  >
                    {submitting ? "Verifying..." : "Verify & Sign In"}
                  </GlassButton>
                </div>
              )}
            </div>
          </div>
        </LiquidGlassWrap>
      </div>
    </div>
  );
}
