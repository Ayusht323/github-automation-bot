"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "Rules", href: "/rules", icon: "⚙️" },
  { label: "Settings", href: "/settings", icon: "🔗" },
];

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid var(--border)",
        background: "rgba(10, 10, 15, 0.85)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link
          href={session ? "/dashboard" : "/"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "var(--text-primary)",
          }}
        >
          <span style={{ fontSize: 28 }}>🤖</span>
          <span
            style={{
              fontSize: 20,
              fontWeight: 800,
              background: "linear-gradient(135deg, var(--accent), #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            GitBot
          </span>
        </Link>

        {/* Navigation */}
        {session && (
          <nav style={{ display: "flex", gap: 4 }}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: "none",
                  color:
                    pathname === item.href
                      ? "var(--accent)"
                      : "var(--text-secondary)",
                  background:
                    pathname === item.href
                      ? "rgba(108, 92, 231, 0.1)"
                      : "transparent",
                  transition: "all 0.2s ease",
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        )}

        {/* User section */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {status === "loading" && (
            <div className="skeleton" style={{ width: 100, height: 36 }} />
          )}
          {session && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {session.user?.avatarUrl && (
                  <img
                    src={session.user.avatarUrl}
                    alt={session.user.name}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: "2px solid var(--border)",
                    }}
                  />
                )}
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                  }}
                >
                  {session.user?.username || session.user?.name}
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="btn-secondary btn-sm"
              >
                Sign out
              </button>
            </>
          )}
          {!session && status !== "loading" && (
            <button
              onClick={() => signIn("github")}
              className="btn-primary btn-sm"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
