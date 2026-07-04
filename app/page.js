"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <div className="skeleton" style={{ width: 200, height: 40 }} />
      </div>
    );
  }

  return (
    <div className="hero-gradient" style={{ position: "relative", overflow: "hidden" }}>
      {/* Background glow effects */}
      <div className="hero-glow" style={{ top: -100, left: "30%", opacity: 0.4 }} />
      <div className="hero-glow" style={{ top: 200, right: "10%", opacity: 0.2, width: 300, height: 300 }} />

      {/* Hero section */}
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "100px 24px 60px",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
        className="animate-fade-in"
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 16px",
            borderRadius: 20,
            background: "rgba(108, 92, 231, 0.1)",
            border: "1px solid rgba(108, 92, 231, 0.3)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--accent)",
            marginBottom: 32,
          }}
        >
          ⚡ Event-Driven Automation for GitHub
        </div>

        <h1
          style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: 24,
            background: "linear-gradient(135deg, var(--text-primary) 30%, var(--accent))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Automate your GitHub
          <br />
          workflow with ease
        </h1>

        <p
          style={{
            fontSize: 18,
            lineHeight: 1.7,
            color: "var(--text-secondary)",
            maxWidth: 600,
            margin: "0 auto 40px",
          }}
        >
          Connect your repositories, set up rules, and let GitBot handle the rest.
          Auto-label issues, post comments, and get Slack alerts — all powered by
          configurable automation rules.
        </p>

        <button
          onClick={() => signIn("github")}
          className="btn-primary"
          style={{
            padding: "14px 36px",
            fontSize: 16,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
          id="sign-in-button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          Sign in with GitHub
        </button>
      </div>

      {/* Features section */}
      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "0 24px 100px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          className="stagger"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {[
            {
              icon: "🔔",
              title: "Real-time Webhooks",
              desc: "Receive and process GitHub events instantly — issues, PRs, and pushes arrive in real time.",
            },
            {
              icon: "⚙️",
              title: "Configurable Rules",
              desc: 'Set keyword-based rules like "bug in title → add bug label" with Slack notifications.',
            },
            {
              icon: "🤖",
              title: "AI-Powered Triage",
              desc: "Let Gemini AI summarize issues, suggest labels, and prioritize your workflow.",
            },
            {
              icon: "📊",
              title: "Live Dashboard",
              desc: "Monitor every event, action, and failure in a real-time dashboard with retry capabilities.",
            },
            {
              icon: "🔒",
              title: "Secure by Design",
              desc: "HMAC signature verification, idempotency checks, rate limiting, and encrypted sessions.",
            },
            {
              icon: "📦",
              title: "Multi-Repo Support",
              desc: "Connect multiple repositories and manage them all from a single dashboard.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="glass-card"
              style={{ padding: 28 }}
            >
              <div style={{ fontSize: 32, marginBottom: 16 }}>{feature.icon}</div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 8,
                  color: "var(--text-primary)",
                }}
              >
                {feature.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
