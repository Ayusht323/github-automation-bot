"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

const eventTypeIcons = {
  issues: "🐛",
  pull_request: "🔀",
  push: "📦",
};

const statusClass = {
  received: "badge-received",
  processing: "badge-processing",
  completed: "badge-success",
  failed: "badge-failed",
};

function StatsCards({ stats, loading }) {
  const cards = [
    { label: "Total Events", value: stats?.totalEvents ?? 0, icon: "📬", color: "var(--info)" },
    { label: "Successful", value: stats?.successfulActions ?? 0, icon: "✅", color: "var(--success)" },
    { label: "Failed", value: stats?.failedActions ?? 0, icon: "❌", color: "var(--danger)" },
    { label: "Active Rules", value: stats?.activeRules ?? 0, icon: "⚙️", color: "var(--accent)" },
    { label: "Repositories", value: stats?.connectedRepos ?? 0, icon: "📦", color: "var(--warning)" },
  ];

  return (
    <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
      {cards.map((card) => (
        <div key={card.label} className="glass-card" style={{ padding: 20 }}>
          {loading ? (
            <div className="skeleton" style={{ height: 60 }} />
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{card.label}</span>
                <span style={{ fontSize: 20 }}>{card.icon}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: card.color }}>{card.value}</div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function EventRow({ event, onRetry }) {
  const [expanded, setExpanded] = useState(false);

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <>
      <tr onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer" }}>
        <td>
          <span style={{ fontSize: 20 }}>{eventTypeIcons[event.eventType] || "📌"}</span>
        </td>
        <td>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{event.title || "No title"}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{event.repoFullName}</div>
        </td>
        <td>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {event.eventType}{event.action ? `.${event.action}` : ""}
          </span>
        </td>
        <td>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{event.sender}</span>
        </td>
        <td>
          <span className={`badge ${statusClass[event.status] || "badge-received"}`}>{event.status}</span>
        </td>
        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{timeAgo(event.createdAt)}</td>
      </tr>
      {expanded && event.actions?.length > 0 && (
        <tr>
          <td colSpan={6} style={{ padding: "8px 16px 16px 56px", background: "rgba(108, 92, 231, 0.03)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>ACTIONS</div>
            {event.actions.map((action) => (
              <div key={action.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, fontSize: 13 }}>
                <span className={`badge ${action.status === "success" ? "badge-success" : action.status === "failed" ? "badge-failed" : "badge-pending"}`}>
                  {action.status}
                </span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {action.actionType === "label_added" && `Added label: ${action.label}`}
                  {action.actionType === "comment_posted" && "Posted comment"}
                  {action.actionType === "slack_sent" && "Slack notification"}
                </span>
                {action.status === "failed" && (
                  <>
                    <span style={{ color: "var(--danger)", fontSize: 12 }}>{action.errorMessage}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRetry(action.id); }}
                      className="btn-secondary btn-sm"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                    >
                      🔄 Retry
                    </button>
                  </>
                )}
              </div>
            ))}
            {event.aiSummary && (
              <div style={{ marginTop: 12, padding: 12, background: "rgba(108, 92, 231, 0.08)", borderRadius: 10, border: "1px solid rgba(108, 92, 231, 0.2)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 4 }}>🤖 AI Summary</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{event.aiSummary}</div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: "", status: "", repo: "" });
  const [repos, setRepos] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter.type) params.set("type", filter.type);
      if (filter.status) params.set("status", filter.status);
      if (filter.repo) params.set("repo", filter.repo);

      const [eventsRes, statsRes, reposRes] = await Promise.all([
        fetch(`/api/events?${params}`),
        fetch("/api/events/stats"),
        fetch("/api/repos"),
      ]);

      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEvents(data.events);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
      if (reposRes.ok) {
        const data = await reposRes.json();
        setRepos(data.connected || []);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/");
      return;
    }
    if (authStatus === "authenticated") {
      fetchData();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [authStatus, router, fetchData]);

  const handleRetry = async (actionId) => {
    try {
      const res = await fetch("/api/events/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Retry failed:", err);
    }
  };

  if (authStatus === "loading") {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
        <div className="skeleton" style={{ height: 200, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 400 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }} className="animate-fade-in">
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Real-time overview of your GitHub automation events
          <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", animation: "pulse-badge 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 12 }}>Live</span>
          </span>
        </p>
      </div>

      <StatsCards stats={stats} loading={loading} />

      {/* Filters */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Filter:</span>
          <select className="input" style={{ width: 160 }} value={filter.type} onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}>
            <option value="">All event types</option>
            <option value="issues">🐛 Issues</option>
            <option value="pull_request">🔀 Pull Requests</option>
            <option value="push">📦 Pushes</option>
          </select>
          <select className="input" style={{ width: 160 }} value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
            <option value="">All statuses</option>
            <option value="received">Received</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <select className="input" style={{ width: 200 }} value={filter.repo} onChange={(e) => setFilter((f) => ({ ...f, repo: e.target.value }))}>
            <option value="">All repositories</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>{r.fullName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Event log table */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Event Log</h2>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{events.length} events</span>
        </div>

        {loading ? (
          <div style={{ padding: 20 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8 }} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No events yet</h3>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Connect a repository and trigger some activity to see events here.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Event</th>
                  <th>Type</th>
                  <th>Sender</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <EventRow key={event.id} event={event} onRetry={handleRetry} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
