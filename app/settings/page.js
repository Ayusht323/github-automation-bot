"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

export default function SettingsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [connected, setConnected] = useState([]);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [showRepos, setShowRepos] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/repos?include_github=true");
      if (res.ok) {
        const data = await res.json();
        setConnected(data.connected || []);
        setAvailable(data.available || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/");
    if (authStatus === "authenticated") fetchData();
  }, [authStatus, router, fetchData]);

  const connectRepo = async (repo) => {
    setConnecting(repo.id);
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubRepoId: repo.id, fullName: repo.fullName }),
      });
      if (res.ok) fetchData();
      else {
        const err = await res.json();
        alert(err.error || "Failed to connect");
      }
    } catch (err) { alert("Failed to connect"); }
    finally { setConnecting(null); }
  };

  const disconnectRepo = async (repoId) => {
    if (!confirm("Disconnect this repository? The webhook will be removed.")) return;
    try {
      await fetch(`/api/repos/${repoId}`, { method: "DELETE" });
      fetchData();
    } catch (err) { alert("Failed to disconnect"); }
  };

  if (authStatus === "loading") return <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}><div className="skeleton" style={{ height: 300 }} /></div>;

  const connectedIds = new Set(connected.map(r => r.githubRepoId));
  const unconnected = available.filter(r => !connectedIds.has(r.id));

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }} className="animate-fade-in">
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Manage connected repositories and integrations</p>
      </div>

      {/* Connected Repositories */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Connected Repositories</h2>
          <button className="btn-primary btn-sm" onClick={() => { setShowRepos(!showRepos); if (!showRepos && available.length === 0) fetchData(); }}>
            {showRepos ? "Hide" : "+ Connect Repo"}
          </button>
        </div>
        {loading ? (
          <div style={{ padding: 20 }}>{[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />)}</div>
        ) : connected.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No repositories connected yet.</p>
          </div>
        ) : (
          <div style={{ padding: 12 }}>
            {connected.map(repo => (
              <div key={repo.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 8px", borderBottom: "1px solid rgba(42,42,64,0.3)" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{repo.fullName}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 12, marginTop: 4 }}>
                    <span className={`badge ${repo.webhookActive ? "badge-success" : "badge-failed"}`}>
                      {repo.webhookActive ? "Webhook active" : "Webhook inactive"}
                    </span>
                  </div>
                </div>
                <button className="btn-danger btn-sm" onClick={() => disconnectRepo(repo.id)}>Disconnect</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Repos Dropdown */}
      {showRepos && (
        <div className="glass-card animate-scale-in" style={{ marginBottom: 24 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Your GitHub Repositories</h2>
          </div>
          {unconnected.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", fontSize: 14, color: "var(--text-muted)" }}>All repositories are connected!</div>
          ) : (
            <div style={{ padding: 12, maxHeight: 400, overflowY: "auto" }}>
              {unconnected.map(repo => (
                <div key={repo.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 8px", borderBottom: "1px solid rgba(42,42,64,0.3)" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{repo.fullName}</div>
                    {repo.description && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{repo.description}</div>}
                  </div>
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => connectRepo(repo)}
                    disabled={connecting === repo.id}
                  >
                    {connecting === repo.id ? "Connecting..." : "Connect"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Integration Info */}
      <div className="glass-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Integration Status</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(42,42,64,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🔗</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>GitHub OAuth</span>
            </div>
            <span className="badge badge-success">Connected</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(42,42,64,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>💬</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Slack Notifications</span>
            </div>
            <span className="badge badge-received">Configured via ENV</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>AI Triage (Gemini)</span>
            </div>
            <span className="badge badge-received">Configured via ENV</span>
          </div>
        </div>
      </div>
    </div>
  );
}
