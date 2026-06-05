import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase.js";

// ── CONSTANTES ────────────────────────────────────────────────────────────────
const STATUTS = {
  planifie: { bg: "#dbeafe", text: "#1e40af", label: "Planifié",  icon: "📋" },
  en_cours: { bg: "#fef3c7", text: "#92400e", label: "En cours",  icon: "🔨" },
  termine:  { bg: "#d1fae5", text: "#065f46", label: "Terminé",   icon: "✅" },
  suspendu: { bg: "#f3e8ff", text: "#6b21a8", label: "Suspendu",  icon: "⏸️" },
  annule:   { bg: "#fee2e2", text: "#991b1b", label: "Annulé",    icon: "❌" },
};

const FORM_EMPTY = {
  nom: "", code: "", client: "", localisation: "",
  date_debut: "", date_fin: "", statut: "planifie",
  budget: "", description: "",
};

const CAN_WRITE = ["admin", "preparateur", "magasinier_preparateur"];

// ── UI UTILS ──────────────────────────────────────────────────────────────────
function StatutBadge({ statut }) {
  const c = STATUTS[statut] || { bg: "#f3f4f6", text: "#374151", label: statut, icon: "?" };
  return (
    <span style={{ background: c.bg, color: c.text, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {c.icon} {c.label}
    </span>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, gap: 12, color: "#6b7280", fontSize: 14 }}>
      <div style={{ width: 20, height: 20, border: "2px solid #e5e7eb", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      Chargement…
    </div>
  );
}

// ── DB HELPERS ────────────────────────────────────────────────────────────────
/*
  SQL Supabase à exécuter une fois (voir CHANTIERS_SETUP.sql à la racine du projet)
*/
const db = {
  getChantiers: async (siteId) => {
    const { data, error } = await supabase.from("chantiers").select("*").eq("site_id", siteId).order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }
    return data || [];
  },
  createChantier: async (d) => {
    const { data, error } = await supabase.from("chantiers").insert([d]).select();
    if (error) { console.error(error); return null; }
    return data?.[0];
  },
  updateChantier: async (id, d) => {
    const { error } = await supabase.from("chantiers").update(d).eq("id", id);
    return !error;
  },
  deleteChantier: async (id) => {
    const { error } = await supabase.from("chantiers").delete().eq("id", id);
    return !error;
  },
  getMateriels: async (cid) => {
    const { data } = await supabase.from("chantier_materiels").select("*").eq("chantier_id", cid).order("id");
    return data || [];
  },
  addMateriel: async (d) => {
    const { data } = await supabase.from("chantier_materiels").insert([d]).select();
    return data?.[0];
  },
  delMateriel: async (id) => { await supabase.from("chantier_materiels").delete().eq("id", id); },
  getAgents: async (cid) => {
    const { data } = await supabase.from("chantier_agents").select("*").eq("chantier_id", cid).order("id");
    return data || [];
  },
  addAgent: async (d) => {
    const { data } = await supabase.from("chantier_agents").insert([d]).select();
    return data?.[0];
  },
  delAgent: async (id) => { await supabase.from("chantier_agents").delete().eq("id", id); },
  getDepenses: async (cid) => {
    const { data } = await supabase.from("chantier_depenses").select("*").eq("chantier_id", cid).order("date", { ascending: false });
    return data || [];
  },
  addDepense: async (d) => {
    const { data } = await supabase.from("chantier_depenses").insert([d]).select();
    return data?.[0];
  },
  delDepense: async (id) => { await supabase.from("chantier_depenses").delete().eq("id", id); },
};

// ── FORMULAIRE CRÉATION / ÉDITION ────────────────────────────────────────────
function ChantierForm({ initial, siteId, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { ...FORM_EMPTY, ...initial } : FORM_EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.nom || !form.code) return;
    setSaving(true);
    const payload = {
      ...form,
      site_id: siteId,
      budget: form.budget ? parseFloat(form.budget) : null,
      date_debut: form.date_debut || null,
      date_fin: form.date_fin || null,
    };
    let saved;
    if (initial?.id) {
      const ok = await db.updateChantier(initial.id, payload);
      saved = ok ? { ...initial, ...payload } : null;
    } else {
      saved = await db.createChantier(payload);
    }
    setSaving(false);
    if (saved) onSave(saved);
    else alert("Erreur lors de la sauvegarde");
  };

  const fields = [
    { l: "Nom du chantier *", k: "nom",          ph: "Rénovation bâtiment A…",  col: 2 },
    { l: "Code chantier *",   k: "code",          ph: "CH-2026-001",              col: 1 },
    { l: "Client",            k: "client",        ph: "Nom du client…",           col: 1 },
    { l: "Localisation",      k: "localisation",  ph: "Adresse, ville…",          col: 2 },
    { l: "Date début",        k: "date_debut",    ph: "",   t: "date",            col: 1 },
    { l: "Date fin prévue",   k: "date_fin",      ph: "",   t: "date",            col: 1 },
    { l: "Budget (€)",        k: "budget",        ph: "0.00", t: "number",        col: 1 },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(2px)" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 30, width: "min(96vw,580px)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111827", margin: 0 }}>
            {initial?.id ? "✏️ Modifier le chantier" : "🏗️ Nouveau chantier"}
          </h2>
          <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 15 }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {fields.map(f => (
            <div key={f.k} style={{ gridColumn: f.col === 2 ? "span 2" : undefined }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{f.l}</label>
              <input
                type={f.t || "text"}
                value={form[f.k]}
                onChange={e => set(f.k, e.target.value)}
                placeholder={f.ph}
                step={f.t === "number" ? "0.01" : undefined}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          ))}

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Statut</label>
            <select value={form.statut} onChange={e => set("statut", e.target.value)}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 9, fontSize: 13, outline: "none" }}>
              {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Description</label>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Détails du chantier, remarques…"
              rows={3}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", background: "#f3f4f6", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={saving || !form.nom || !form.code}
            style={{ flex: 2, padding: "11px", background: saving || !form.nom || !form.code ? "#e5e7eb" : "#111827", color: saving || !form.nom || !form.code ? "#9ca3af" : "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
            {saving ? "⏳ Enregistrement…" : "💾 Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FICHE CHANTIER ────────────────────────────────────────────────────────────
function ChantierDetail({ chantier, mouvements, user, onBack, onUpdate, onDelete }) {
  const [tab, setTab] = useState(0);
  const [materiels, setMateriels] = useState([]);
  const [agents, setAgents] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMatForm, setShowMatForm] = useState(false);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [showDepForm, setShowDepForm] = useState(false);
  const [matForm, setMatForm] = useState({ nom: "", type: "Machine", qte: 1, notes: "" });
  const [agentForm, setAgentForm] = useState({ nom: "", role: "Technicien", date_debut: "", date_fin: "" });
  const [depForm, setDepForm] = useState({ designation: "", montant: "", date: new Date().toISOString().split("T")[0], type: "Fournitures", notes: "" });

  const canWrite = CAN_WRITE.includes(user?.role);

  const loadTabData = useCallback(async (t) => {
    setLoading(true);
    if (t === 2) setMateriels(await db.getMateriels(chantier.id));
    if (t === 3) setAgents(await db.getAgents(chantier.id));
    if (t === 4) setDepenses(await db.getDepenses(chantier.id));
    setLoading(false);
  }, [chantier.id]);

  useEffect(() => { loadTabData(tab); }, [tab, loadTabData]);

  // Stock consommé = sorties dont num_bdc correspond au code du chantier
  const stockConsomme = mouvements.filter(m =>
    m.type === "sortie" &&
    (m.num_bdc || "").toLowerCase() === (chantier.code || "").toLowerCase()
  );
  const totalStockVal = stockConsomme.reduce((a, m) => a + (m.cout_fifo || (m.quantite * (m.prix_unitaire || 0))), 0);
  const totalDepenses = depenses.reduce((a, d) => a + (parseFloat(d.montant) || 0), 0);

  const TABS_LABELS = ["📋 Infos", "📦 Stock consommé", "🔧 Matériels", "👷 Agents", "💶 Dépenses"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onBack}
          style={{ background: "#f3f4f6", border: "none", borderRadius: 9, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13, color: "#374151", flexShrink: 0 }}>
          ← Retour
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: "#111827", margin: 0 }}>{chantier.nom}</h1>
            <StatutBadge statut={chantier.statut} />
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>
            {chantier.code && <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#7c3aed", marginRight: 10 }}>#{chantier.code}</span>}
            {chantier.client && <span>{chantier.client}</span>}
            {chantier.localisation && <span style={{ marginLeft: 8 }}>📍 {chantier.localisation}</span>}
          </p>
        </div>
        {canWrite && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setShowEdit(true)}
              style={{ padding: "8px 14px", background: "#f3f4f6", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: 12, color: "#374151" }}>
              ✏️ Modifier
            </button>
            <button onClick={() => { if (window.confirm(`Supprimer "${chantier.nom}" ?`)) onDelete(chantier.id); }}
              style={{ padding: "8px 14px", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 9, cursor: "pointer", fontSize: 12, color: "#dc2626", fontWeight: 700 }}>
              🗑 Supprimer
            </button>
          </div>
        )}
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", flexWrap: "wrap" }}>
        {TABS_LABELS.map((label, i) => (
          <button key={i} onClick={() => setTab(i)}
            style={{ padding: "9px 16px", background: "none", border: "none", borderBottom: `3px solid ${tab === i ? "#3b82f6" : "transparent"}`, marginBottom: -2, cursor: "pointer", fontWeight: tab === i ? 700 : 500, fontSize: 13, color: tab === i ? "#1d4ed8" : "#6b7280", whiteSpace: "nowrap" }}>
            {label}
          </button>
        ))}
      </div>

      {loading && <Spinner />}

      {/* ── TAB 0 : INFOS ── */}
      {!loading && tab === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 20 }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: 0.5 }}>Informations générales</h3>
            {[
              { l: "Code",        v: chantier.code,        mono: true },
              { l: "Client",      v: chantier.client },
              { l: "Localisation",v: chantier.localisation },
              { l: "Statut",      v: <StatutBadge statut={chantier.statut} /> },
            ].filter(r => r.v).map(r => (
              <div key={r.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
                <span style={{ color: "#6b7280" }}>{r.l}</span>
                <span style={{ fontWeight: 600, color: "#111827", fontFamily: r.mono ? "monospace" : undefined }}>{r.v}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 20 }}>
              <h3 style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: 0.5 }}>Planning & Budget</h3>
              {[
                { l: "Date début",       v: chantier.date_debut ? new Date(chantier.date_debut).toLocaleDateString("fr-FR") : "—" },
                { l: "Date fin prévue",  v: chantier.date_fin   ? new Date(chantier.date_fin).toLocaleDateString("fr-FR")   : "—" },
                { l: "Budget",           v: chantier.budget ? `${parseFloat(chantier.budget).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : "—" },
                { l: "Stock consommé",   v: totalStockVal > 0 ? `${totalStockVal.toFixed(2)} €` : "—" },
              ].map(r => (
                <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
                  <span style={{ color: "#6b7280" }}>{r.l}</span>
                  <span style={{ fontWeight: 600, color: "#111827" }}>{r.v}</span>
                </div>
              ))}
            </div>
            {chantier.description && (
              <div style={{ background: "#f9fafb", borderRadius: 14, border: "1px solid #e5e7eb", padding: 16 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", margin: "0 0 8px", textTransform: "uppercase" }}>Description</h3>
                <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.6 }}>{chantier.description}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 1 : STOCK CONSOMMÉ ── */}
      {!loading && tab === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 10 }}>
            {[
              { l: "Sorties liées",     v: stockConsomme.length,                                                               icon: "📤", color: "#dc2626" },
              { l: "Pièces utilisées",  v: stockConsomme.reduce((a, m) => a + m.quantite, 0),                                  icon: "🔩", color: "#374151" },
              { l: "Coût FIFO total",   v: totalStockVal > 0 ? `${totalStockVal.toFixed(2)} €` : "—",                          icon: "💶", color: "#3b82f6" },
            ].map(s => (
              <div key={s.l} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.v}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {stockConsomme.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 40, textAlign: "center", color: "#9ca3af" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
              <div style={{ fontWeight: 700, color: "#374151", marginBottom: 6 }}>Aucun stock consommé</div>
              <div style={{ fontSize: 12 }}>
                Les sorties enregistrées avec <strong>N° chantier = {chantier.code}</strong> apparaîtront ici automatiquement.
              </div>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#111827" }}>
                  {["Date", "Article", "Qté", "Avant", "Après", "Motif", "Coût FIFO"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {stockConsomme.map((m, i) => (
                    <tr key={m.id || i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "9px 12px", fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>{new Date(m.created_at || m.date).toLocaleDateString("fr-FR")}</td>
                      <td style={{ padding: "9px 12px", maxWidth: 200 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.article_name || m.articleName}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af" }}>{m.article_id || m.articleId}</div>
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "center" }}><span style={{ fontSize: 14, fontWeight: 900, color: "#dc2626" }}>-{m.quantite}</span></td>
                      <td style={{ padding: "9px 12px", textAlign: "center", fontSize: 12, color: "#6b7280" }}>{m.stock_avant ?? m.stockAvant}</td>
                      <td style={{ padding: "9px 12px", textAlign: "center", fontSize: 13, fontWeight: 700, color: (m.stock_apres ?? m.stockApres) === 0 ? "#dc2626" : "#059669" }}>{m.stock_apres ?? m.stockApres}</td>
                      <td style={{ padding: "9px 12px", fontSize: 11, color: "#374151" }}>{m.motif || "—"}</td>
                      <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: "#3b82f6", textAlign: "right", whiteSpace: "nowrap" }}>
                        {m.cout_fifo ? `${parseFloat(m.cout_fifo).toFixed(2)} €` : m.prix_unitaire && m.quantite ? `${(m.prix_unitaire * m.quantite).toFixed(2)} €` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2 : MATÉRIELS ── */}
      {!loading && tab === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {canWrite && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setShowMatForm(true)}
                style={{ background: "#111827", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                + Ajouter un matériel
              </button>
            </div>
          )}

          {showMatForm && (
            <div style={{ background: "#f0f9ff", borderRadius: 14, border: "2px solid #bae6fd", padding: 18 }}>
              <h3 style={{ margin: "0 0 12px", fontWeight: 800, color: "#0369a1", fontSize: 14 }}>➕ Nouveau matériel</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 1fr", gap: 10, marginBottom: 12 }}>
                {[
                  { l: "Désignation *", k: "nom",  ph: "Pelleteuse, perceuse…" },
                  { l: "Type",          k: "type",  isSelect: true, opts: ["Machine", "Outillage", "Véhicule", "Équipement", "Autre"] },
                  { l: "Qté",           k: "qte",   t: "number" },
                  { l: "Notes",         k: "notes", ph: "Immat., référence…" },
                ].map(f => (
                  <div key={f.k}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{f.l}</label>
                    {f.isSelect
                      ? <select value={matForm[f.k]} onChange={e => setMatForm(p => ({ ...p, [f.k]: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none" }}>
                          {f.opts.map(o => <option key={o}>{o}</option>)}
                        </select>
                      : <input type={f.t || "text"} min={f.t === "number" ? 1 : undefined} value={matForm[f.k]} onChange={e => setMatForm(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.ph || ""} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                    }
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowMatForm(false)} style={{ padding: "8px 16px", background: "#f3f4f6", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 600 }}>Annuler</button>
                <button onClick={async () => {
                  if (!matForm.nom) return;
                  const saved = await db.addMateriel({ ...matForm, chantier_id: chantier.id, qte: parseInt(matForm.qte) || 1 });
                  if (saved) { setMateriels(p => [...p, saved]); setMatForm({ nom: "", type: "Machine", qte: 1, notes: "" }); setShowMatForm(false); }
                }} style={{ padding: "8px 16px", background: "#111827", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700 }}>💾 Ajouter</button>
              </div>
            </div>
          )}

          {materiels.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 40, textAlign: "center", color: "#9ca3af" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔧</div>
              <div style={{ fontWeight: 700, color: "#374151" }}>Aucun matériel assigné</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {materiels.map(m => (
                <div key={m.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{m.nom}</div>
                    {canWrite && (
                      <button onClick={async () => { await db.delMateriel(m.id); setMateriels(p => p.filter(x => x.id !== m.id)); }}
                        style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12, color: "#dc2626", fontWeight: 700 }}>✕</button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ background: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{m.type}</span>
                    <span style={{ background: "#eff6ff", color: "#1e40af", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>Qté: {m.qte}</span>
                  </div>
                  {m.notes && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>{m.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3 : AGENTS ── */}
      {!loading && tab === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {canWrite && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setShowAgentForm(true)}
                style={{ background: "#111827", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                + Ajouter un agent
              </button>
            </div>
          )}

          {showAgentForm && (
            <div style={{ background: "#f0f9ff", borderRadius: 14, border: "2px solid #bae6fd", padding: 18 }}>
              <h3 style={{ margin: "0 0 12px", fontWeight: 800, color: "#0369a1", fontSize: 14 }}>➕ Nouvel agent</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                {[
                  { l: "Nom *",        k: "nom",        ph: "Prénom Nom" },
                  { l: "Rôle",         k: "role",       isSelect: true, opts: ["Chef de chantier", "Technicien", "Maçon", "Électricien", "Mécanicien", "Autre"] },
                  { l: "Date arrivée", k: "date_debut", t: "date" },
                  { l: "Date départ",  k: "date_fin",   t: "date" },
                ].map(f => (
                  <div key={f.k}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{f.l}</label>
                    {f.isSelect
                      ? <select value={agentForm[f.k]} onChange={e => setAgentForm(p => ({ ...p, [f.k]: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none" }}>
                          {f.opts.map(o => <option key={o}>{o}</option>)}
                        </select>
                      : <input type={f.t || "text"} value={agentForm[f.k]} onChange={e => setAgentForm(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.ph || ""} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                    }
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowAgentForm(false)} style={{ padding: "8px 16px", background: "#f3f4f6", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 600 }}>Annuler</button>
                <button onClick={async () => {
                  if (!agentForm.nom) return;
                  const saved = await db.addAgent({ ...agentForm, chantier_id: chantier.id });
                  if (saved) { setAgents(p => [...p, saved]); setAgentForm({ nom: "", role: "Technicien", date_debut: "", date_fin: "" }); setShowAgentForm(false); }
                }} style={{ padding: "8px 16px", background: "#111827", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700 }}>💾 Ajouter</button>
              </div>
            </div>
          )}

          {agents.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 40, textAlign: "center", color: "#9ca3af" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>👷</div>
              <div style={{ fontWeight: 700, color: "#374151" }}>Aucun agent assigné</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {agents.map(a => (
                <div key={a.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#b45309,#d97706)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                        {a.nom?.[0]?.toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{a.nom}</div>
                    </div>
                    {canWrite && (
                      <button onClick={async () => { await db.delAgent(a.id); setAgents(p => p.filter(x => x.id !== a.id)); }}
                        style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12, color: "#dc2626", fontWeight: 700 }}>✕</button>
                    )}
                  </div>
                  <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{a.role}</span>
                  {(a.date_debut || a.date_fin) && (
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                      {a.date_debut && `Du ${new Date(a.date_debut).toLocaleDateString("fr-FR")}`}
                      {a.date_fin   && ` au ${new Date(a.date_fin).toLocaleDateString("fr-FR")}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4 : DÉPENSES ── */}
      {!loading && tab === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 20px", display: "flex", gap: 24 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#111827" }}>{totalDepenses.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Total dépenses</div>
              </div>
              {chantier.budget > 0 && (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: totalDepenses > chantier.budget ? "#dc2626" : "#059669" }}>
                    {(parseFloat(chantier.budget) - totalDepenses).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Reste budget</div>
                </div>
              )}
            </div>
            {canWrite && (
              <button onClick={() => setShowDepForm(true)}
                style={{ background: "#111827", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                + Ajouter une dépense
              </button>
            )}
          </div>

          {showDepForm && (
            <div style={{ background: "#f0f9ff", borderRadius: 14, border: "2px solid #bae6fd", padding: 18 }}>
              <h3 style={{ margin: "0 0 12px", fontWeight: 800, color: "#0369a1", fontSize: 14 }}>➕ Nouvelle dépense</h3>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                {[
                  { l: "Désignation *", k: "designation", ph: "Location nacelle, béton…" },
                  { l: "Montant (€) *", k: "montant",     t: "number", ph: "0.00" },
                  { l: "Date",          k: "date",         t: "date" },
                  { l: "Type",          k: "type",         isSelect: true, opts: ["Main d'œuvre", "Fournitures", "Location", "Transport", "Sous-traitance", "Autre"] },
                ].map(f => (
                  <div key={f.k}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{f.l}</label>
                    {f.isSelect
                      ? <select value={depForm[f.k]} onChange={e => setDepForm(p => ({ ...p, [f.k]: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none" }}>
                          {f.opts.map(o => <option key={o}>{o}</option>)}
                        </select>
                      : <input type={f.t || "text"} value={depForm[f.k]} onChange={e => setDepForm(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.ph || ""} step={f.t === "number" ? "0.01" : undefined} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                    }
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Notes</label>
                <input value={depForm.notes} onChange={e => setDepForm(p => ({ ...p, notes: e.target.value }))} placeholder="Fournisseur, référence bon…"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowDepForm(false)} style={{ padding: "8px 16px", background: "#f3f4f6", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 600 }}>Annuler</button>
                <button onClick={async () => {
                  if (!depForm.designation || !depForm.montant) return;
                  const saved = await db.addDepense({ ...depForm, chantier_id: chantier.id, montant: parseFloat(depForm.montant) });
                  if (saved) { setDepenses(p => [saved, ...p]); setDepForm({ designation: "", montant: "", date: new Date().toISOString().split("T")[0], type: "Fournitures", notes: "" }); setShowDepForm(false); }
                }} style={{ padding: "8px 16px", background: "#111827", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700 }}>💾 Ajouter</button>
              </div>
            </div>
          )}

          {depenses.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 40, textAlign: "center", color: "#9ca3af" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>💶</div>
              <div style={{ fontWeight: 700, color: "#374151" }}>Aucune dépense enregistrée</div>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#111827" }}>
                  {["Date", "Désignation", "Type", "Montant", "Notes", ""].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {depenses.map((d, i) => (
                    <tr key={d.id || i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "9px 12px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{d.date ? new Date(d.date).toLocaleDateString("fr-FR") : "—"}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 600, fontSize: 13, color: "#111827" }}>{d.designation}</td>
                      <td style={{ padding: "9px 12px" }}><span style={{ background: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{d.type}</span></td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 800, color: "#374151", fontSize: 14, whiteSpace: "nowrap" }}>{parseFloat(d.montant).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</td>
                      <td style={{ padding: "9px 12px", fontSize: 11, color: "#9ca3af" }}>{d.notes || "—"}</td>
                      <td style={{ padding: "9px 12px" }}>
                        {canWrite && (
                          <button onClick={async () => { await db.delDepense(d.id); setDepenses(p => p.filter(x => x.id !== d.id)); }}
                            style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "#dc2626", fontWeight: 700 }}>🗑</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showEdit && (
        <ChantierForm
          initial={chantier}
          siteId={chantier.site_id}
          onSave={(updated) => { onUpdate(updated); setShowEdit(false); }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}

// ── COMPOSANT PRINCIPAL ───────────────────────────────────────────────────────
export default function Chantiers({ user, siteId, mouvements = [] }) {
  const [chantiers, setChantiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("tous");

  const canWrite = CAN_WRITE.includes(user?.role);

  useEffect(() => {
    setLoading(true);
    db.getChantiers(siteId).then(data => { setChantiers(data); setLoading(false); });
  }, [siteId]);

  const handleUpdate = (updated) => {
    setChantiers(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSelected(updated);
  };

  const handleDelete = async (id) => {
    await db.deleteChantier(id);
    setChantiers(prev => prev.filter(c => c.id !== id));
    setSelected(null);
  };

  const filtered = chantiers.filter(c => {
    const okS = filterStatut === "tous" || c.statut === filterStatut;
    const s = search.toLowerCase();
    const okQ = !s || (c.nom || "").toLowerCase().includes(s) || (c.code || "").toLowerCase().includes(s) || (c.client || "").toLowerCase().includes(s);
    return okS && okQ;
  });

  const stats = {
    total:    chantiers.length,
    en_cours: chantiers.filter(c => c.statut === "en_cours").length,
    planifie: chantiers.filter(c => c.statut === "planifie").length,
    termine:  chantiers.filter(c => c.statut === "termine").length,
    budget:   chantiers.reduce((a, c) => a + (parseFloat(c.budget) || 0), 0),
  };

  if (selected) {
    return (
      <ChantierDetail
        chantier={selected}
        mouvements={mouvements}
        user={user}
        onBack={() => setSelected(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111827", margin: 0 }}>Chantiers</h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>
            {chantiers.length} chantier{chantiers.length !== 1 ? "s" : ""} · {stats.en_cours} en cours
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setShowForm(true)}
            style={{ background: "#111827", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            🏗️ Nouveau chantier
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {[
          { l: "Total",        v: stats.total,    icon: "🏗️", color: "#111827" },
          { l: "En cours",     v: stats.en_cours, icon: "🔨", color: "#92400e" },
          { l: "Planifiés",    v: stats.planifie, icon: "📋", color: "#1e40af" },
          { l: "Terminés",     v: stats.termine,  icon: "✅", color: "#065f46" },
          { l: "Budget total", v: stats.budget > 0 ? `${stats.budget.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €` : "—", icon: "💶", color: "#3b82f6" },
        ].map(k => (
          <div key={k.l} style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{k.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color, letterSpacing: -0.5 }}>{k.v}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Rechercher par nom, code, client…"
          style={{ flex: 1, minWidth: 240, padding: "10px 16px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 14, outline: "none" }}
        />
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {[{ v: "tous", l: "Tous" }, ...Object.entries(STATUTS).map(([k, s]) => ({ v: k, l: `${s.icon} ${s.label}` }))].map(btn => (
            <button key={btn.v} onClick={() => setFilterStatut(btn.v)}
              style={{ padding: "8px 14px", borderRadius: 9, border: `2px solid ${filterStatut === btn.v ? "#111827" : "#e5e7eb"}`, background: filterStatut === btn.v ? "#111827" : "#fff", color: filterStatut === btn.v ? "#fff" : "#374151", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
              {btn.l}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 60, textAlign: "center", color: "#9ca3af" }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🏗️</div>
          <div style={{ fontWeight: 800, color: "#374151", fontSize: 16, marginBottom: 8 }}>
            {chantiers.length === 0 ? "Aucun chantier créé" : "Aucun résultat"}
          </div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>
            {chantiers.length === 0
              ? "Créez votre premier chantier pour commencer le suivi."
              : "Modifiez vos critères de recherche."}
          </div>
          {canWrite && chantiers.length === 0 && (
            <button onClick={() => setShowForm(true)}
              style={{ background: "#111827", color: "#fff", border: "none", borderRadius: 10, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              🏗️ Créer le premier chantier
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {filtered.map(c => {
            const mouvC = mouvements.filter(m =>
              m.type === "sortie" && (m.num_bdc || "").toLowerCase() === (c.code || "").toLowerCase()
            );
            const consomme = mouvC.reduce((a, m) => a + (m.cout_fifo || 0), 0);
            const pct = c.budget > 0 && consomme > 0 ? Math.min(100, Math.round((consomme / c.budget) * 100)) : null;

            return (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20, cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";  e.currentTarget.style.transform = "translateY(0)"; }}>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#111827", marginBottom: 4 }}>{c.nom}</div>
                    <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#7c3aed", background: "#f3e8ff", padding: "2px 7px", borderRadius: 6 }}>#{c.code}</span>
                  </div>
                  <StatutBadge statut={c.statut} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                  {c.client      && <div style={{ fontSize: 12, color: "#6b7280" }}>👤 {c.client}</div>}
                  {c.localisation && <div style={{ fontSize: 12, color: "#6b7280" }}>📍 {c.localisation}</div>}
                  {(c.date_debut || c.date_fin) && (
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      📅 {c.date_debut ? new Date(c.date_debut).toLocaleDateString("fr-FR") : "?"} → {c.date_fin ? new Date(c.date_fin).toLocaleDateString("fr-FR") : "?"}
                    </div>
                  )}
                </div>

                {c.budget > 0 && (
                  <div style={{ background: "#f9fafb", borderRadius: 9, padding: "8px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: pct !== null ? 6 : 0, fontSize: 12 }}>
                      <span style={{ color: "#6b7280" }}>Budget</span>
                      <span style={{ fontWeight: 700, color: "#111827" }}>{parseFloat(c.budget).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</span>
                    </div>
                    {pct !== null && (
                      <>
                        <div style={{ height: 5, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: pct >= 90 ? "#dc2626" : pct >= 70 ? "#d97706" : "#059669", borderRadius: 99, transition: "width 0.4s" }} />
                        </div>
                        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, textAlign: "right" }}>{pct}% consommé</div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ChantierForm
          siteId={siteId}
          onSave={(saved) => { setChantiers(prev => [saved, ...prev]); setShowForm(false); }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
