"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import pb from "@/lib/pocketbase";
import type { RecordModel } from "pocketbase";

interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<string>;
  verifySignupOtp: (otpId: string, code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from PocketBase authStore on mount
  useEffect(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      const record = pb.authStore.record as RecordModel;
      setUser({ id: record.id, email: record.email, name: record.name });
    }
    setLoading(false);

    // Listen for auth state changes
    const unsub = pb.authStore.onChange((_token, record) => {
      if (record) {
        const r = record as RecordModel;
        setUser({ id: r.id, email: r.email, name: r.name });
      } else {
        setUser(null);
      }
    });

    return () => unsub();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await pb.collection("users").authWithPassword(email, password);
    const r = result.record as RecordModel;
    setUser({ id: r.id, email: r.email, name: r.name });
  }, []);

  // Signup: create account + send OTP for verification. Returns otpId.
  const signup = useCallback(async (email: string, password: string, name?: string): Promise<string> => {
    await pb.collection("users").create({
      email,
      password,
      passwordConfirm: password,
      name: name || "",
    });
    // Send OTP for email verification
    const result = await pb.collection("users").requestOTP(email);
    return result.otpId;
  }, []);

  // Verify signup OTP — authenticates and verifies the user
  const verifySignupOtp = useCallback(async (otpId: string, code: string) => {
    const result = await pb.collection("users").authWithOTP(otpId, code);
    const r = result.record as RecordModel;
    setUser({ id: r.id, email: r.email, name: r.name });
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, verifySignupOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
