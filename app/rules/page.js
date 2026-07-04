"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

const actionTypeLabels = {
  add_label: "Add Label",
  post_comment: "Post Comment",
  add_label_and_comment: "Add Label + Comment",
};

const eventTypeIcons = { issues: "🐛", pull_request: "🔀", push: "📦" };

const defaultForm = {
  name: "", eventType: "issues", keyword: "", actionType: "add_label",
  label: "", commentTemplate: "", slackNotify: true, aiTriage: false, repositoryId: "",
};

export default function RulesPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [rules, setRules] = useState([]);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [form, setForm] = useState(defaultForm);

  const fetchData = useCallback(async () => {
    try {
      const [rulesRes, reposRes] = await Promise.all([fetch("/api/rules"), fetch("/api/repos")]);
      if (rulesRes.ok) setRules((await rulesRes.json()).rules);
      if (reposRes.ok) setRepos((await reposRes.json()).connected || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/");
    if (authStatus === "authenticated") fetchData();
  }, [authStatus, router, fetchData]);

  const resetForm = () => { setForm(defaultForm); setEditingRule(null); setShowForm(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = { ...form, repositoryId: form.repositoryId ? parseInt(form.repositoryId) : null };
    const url = editingRule ? `/api/rules/${editingRule.id}` : "/api/rules";
    const method = editingRule ? "PATCH" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    resetForm(); fetchData();
  };

  const handleToggle = async (rule) => {
    await fetch(`/api/rules/${rule.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !rule.enabled }) });
    fetchData();
  };

  const handleDelete = async (id) => { if (confirm("Delete this rule?")) { await fetch(`/api/rules/${id}`, { method: "DELETE" }); fetchData(); } };

  const handleEdit = (rule) => {
    setForm({ name: rule.name, eventType: rule.eventType, keyword: rule.keyword || "", actionType: rule.actionType, label: rule.label || "", commentTemplate: rule.commentTemplate || "", slackNotify: rule.slackNotify, aiTriage: rule.aiTriage, repositoryId: rule.repositoryId ? String(rule.repositoryId) : "" });
    setEditingRule(rule); setShowForm(true);
  };

  if (authStatus === "loading") return <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}><div className="skeleton" style={{ height: 400 }} /></div>;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }} className="animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Automation Rules</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Configure how GitBot reacts to events</p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>+ New Rule</button>
      </div>

      {showForm && (
        <div className="glass-card animate-scale-in" style={{ padding: 28, marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{editingRule ? "Edit Rule" : "Create Rule"}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Rule Name</label>
                <input className="input" placeholder="e.g., Bug Tagger" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Event Type</label>
                <select className="input" value={form.eventType} onChange={(e) => setForm(f => ({ ...f, eventType: e.target.value }))}>
                  <option value="issues">🐛 Issues</option>
                  <option value="pull_request">🔀 Pull Requests</option>
                  <option value="push">📦 Push</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Keyword (in title)</label>
                <input className="input" placeholder="e.g., bug (empty = match all)" value={form.keyword} onChange={(e) => setForm(f => ({ ...f, keyword: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Action Type</label>
                <select className="input" value={form.actionType} onChange={(e) => setForm(f => ({ ...f, actionType: e.target.value }))}>
                  <option value="add_label">Add Label</option>
                  <option value="post_comment">Post Comment</option>
                  <option value="add_label_and_comment">Add Label + Comment</option>
                </select>
              </div>
              {(form.actionType === "add_label" || form.actionType === "add_label_and_comment") && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Label Name</label>
                  <input className="input" placeholder="e.g., bug" value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} required />
                </div>
              )}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Repository Scope</label>
                <select className="input" value={form.repositoryId} onChange={(e) => setForm(f => ({ ...f, repositoryId: e.target.value }))}>
                  <option value="">All repositories</option>
                  {repos.map(r => <option key={r.id} value={r.id}>{r.fullName}</option>)}
                </select>
              </div>
            </div>
            {(form.actionType === "post_comment" || form.actionType === "add_label_and_comment") && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Comment Template</label>
                <textarea className="input" rows={3} placeholder="Variables: {title}, {sender}, {repo}" value={form.commentTemplate} onChange={(e) => setForm(f => ({ ...f, commentTemplate: e.target.value }))} style={{ resize: "vertical" }} />
              </div>
            )}
            <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
              <label className="toggle" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" checked={form.slackNotify} onChange={(e) => setForm(f => ({ ...f, slackNotify: e.target.checked }))} />
                <span className="toggle-slider" /><span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Slack notify</span>
              </label>
              <label className="toggle" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" checked={form.aiTriage} onChange={(e) => setForm(f => ({ ...f, aiTriage: e.target.checked }))} />
                <span className="toggle-slider" /><span style={{ fontSize: 13, color: "var(--text-secondary)" }}>AI Triage</span>
              </label>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" className="btn-primary">{editingRule ? "Save" : "Create Rule"}</button>
              <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      ) : rules.length === 0 ? (
        <div className="glass-card" style={{ padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No rules yet</h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>Create your first automation rule.</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ Create First Rule</button>
        </div>
      ) : (
        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rules.map(rule => (
            <div key={rule.id} className="glass-card" style={{ padding: 20, opacity: rule.enabled ? 1 : 0.5, transition: "opacity 0.3s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>{eventTypeIcons[rule.eventType]}</span>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{rule.name}</h3>
                    {!rule.enabled && <span className="badge" style={{ background: "rgba(96,96,120,0.2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Disabled</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", flexWrap: "wrap", gap: 16 }}>
                    <span>📌 {rule.eventType}</span>
                    {rule.keyword && <span>🔍 &quot;{rule.keyword}&quot;</span>}
                    <span>⚡ {actionTypeLabels[rule.actionType]}</span>
                    {rule.label && <span>🏷️ {rule.label}</span>}
                    <span>📂 {rule.repoFullName}</span>
                    {rule.slackNotify && <span>💬 Slack</span>}
                    {rule.aiTriage && <span>🤖 AI</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label className="toggle"><input type="checkbox" checked={rule.enabled} onChange={() => handleToggle(rule)} /><span className="toggle-slider" /></label>
                  <button className="btn-secondary btn-sm" onClick={() => handleEdit(rule)}>Edit</button>
                  <button className="btn-danger btn-sm" onClick={() => handleDelete(rule.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
