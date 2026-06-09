/**
 * Sign-up / Login screen. The gateway to the game — a human authenticates here,
 * and their club is tied to this account forever (saved in Supabase).
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Loader2 } from "lucide-react";
import { useAuth } from "../store/authStore";

export function AuthScreen({ onBack }: { onBack?: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const { signIn, signUp, loading, error, clearError } = useAuth();

  async function submit() {
    clearError();
    setNotice(null);
    if (!email || password.length < 6) {
      setNotice("Enter an email and a password of at least 6 characters.");
      return;
    }
    if (mode === "signup") {
      const ok = await signUp(email, password);
      if (ok) setNotice("Account created! If email confirmation is on, check your inbox, then log in.");
    } else {
      await signIn(email, password);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-ink-950 via-ink-900 to-pitch-900/40">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🏏</div>
          <h1 className="font-display text-5xl tracking-wide text-white leading-none">CRICKET EMPIRE</h1>
          <p className="text-pitch-500 font-semibold tracking-widest text-xs mt-1">T20 STRATEGY MANAGEMENT</p>
          {onBack && (
            <button onClick={onBack} className="mt-3 text-xs text-slate-500 hover:text-slate-300">← Back to home</button>
          )}
        </div>

        <div className="card p-6">
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => { setMode("login"); clearError(); setNotice(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === "login" ? "bg-pitch-600/20 text-pitch-400" : "text-slate-400 hover:bg-white/5"}`}
            >
              Log in
            </button>
            <button
              onClick={() => { setMode("signup"); clearError(); setNotice(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === "signup" ? "bg-pitch-600/20 text-pitch-400" : "text-slate-400 hover:bg-white/5"}`}
            >
              Sign up
            </button>
          </div>

          <label className="block text-xs text-slate-400 mb-1">Email</label>
          <div className="flex items-center gap-2 rounded-xl bg-ink-950 border border-white/10 px-3 mb-4 focus-within:border-pitch-500">
            <Mail size={16} className="text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 bg-transparent py-3 text-white outline-none"
            />
          </div>

          <label className="block text-xs text-slate-400 mb-1">Password</label>
          <div className="flex items-center gap-2 rounded-xl bg-ink-950 border border-white/10 px-3 mb-2 focus-within:border-pitch-500">
            <Lock size={16} className="text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="••••••••"
              className="flex-1 bg-transparent py-3 text-white outline-none"
            />
          </div>

          {(error || notice) && (
            <div className={`text-sm mt-2 ${error ? "text-red-400" : "text-pitch-400"}`}>
              {error || notice}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-pitch-600 hover:bg-pitch-500 disabled:opacity-50 px-5 py-3 font-semibold text-white"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === "signup" ? "Create my account" : "Log in"}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            {mode === "login" ? "New manager? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); clearError(); setNotice(null); }}
              className="text-pitch-400 hover:underline"
            >
              {mode === "login" ? "Sign up here" : "Log in"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
