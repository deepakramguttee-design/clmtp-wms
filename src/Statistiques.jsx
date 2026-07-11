import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import {
  statsKpi, statsTopProduits, statsTopConsommateurs,
  statsOrParTechnicien, statsOrMensuel, statsSortiesMensuel, statsParSite,
} from "./db.js";

// ── DESIGN TOKENS (alignés sur AdminDashboard.jsx) ────────────────────────────
const CARD = { background: "#ffffff", borderRadius: 14, border: "1px solid #e0e0d8" };
const SITE_META = {
  clmtp_sable:  { label: "CLMTP SABLÉ",  short: "SABLÉ",   color: "#1e40af" },
  claisse_rail: { label: "CLAISSE RAIL", short: "CLAISSE", color: "#065f46" },
  stmf:         { label: "STMF",         short: "STMF",    color: "#7c3aed" },
};
const ACCENT = { blue: "#3b82f6", green: "#10b981", purple: "#8b5cf6", red: "#ef4444", amber: "#f59e0b" };

const PERIODS = [
  { key: "30",  label: "30 jours", days: 30 },
  { key: "90",  label: "90 jours", days: 90 },
  { key: "365", label: "12 mois",  days: 365 },
  { key: "all", label: "Tout",     days: null },
];
const SITE_OPTIONS = [
  { key: "all",          label: "Tous les sites", site: null },
  { key: "clmtp_sable",  label: "CLMTP Sablé",    site: "clmtp_sable" },
  { key: "claisse_rail", label: "Claisse Rail",   site: "claisse_rail" },
  { key: "stmf",         label: "STMF",           site: "stmf" },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt    = (n) => (Number(n) || 0).toLocaleString("fr-FR");
const fmtEur = (n) => (Number(n) || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
const truncate = (s, max = 26) => (s && s.length > max ? s.slice(0, max - 1) + "…" : s || "—");
const monthLabel = (isoDate) => {
  if (!isoDate) return "";
  const [y, m] = String(isoDate).split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
};

const TOOLTIP_STYLE = { background: "#ffffff", border: "1px solid #e0e0d8", borderRadius: 8, color: "#1a1a1a" };
const AXIS_TICK = { fill: "#666", fontSize: 11 };

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────
function Skeleton({ h = 100 }) {
  return <div style={{ background: "#e8e8e2", borderRadius: 12, height: h, animation: "pulse 1.5s ease-in-out infinite" }} />;
}

function KPICard({ icon, label, value, sub, color, loading }) {
  if (loading) return <Skeleton h={110} />;
  return (
    <div style={{ ...CARD, padding: "18px 20px" }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color, letterSpacing: -1, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#666", marginTop: 6, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#999", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, subtitle, children, loading, error, empty, h = 300 }) {
  return (
    <div style={{ ...CARD, padding: "20px 20px 12px", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1a1a1a" }}>{title}</h3>
        {subtitle && <p style={{ margin: "3px 0 0", fontSize: 11, color: "#999" }}>{subtitle}</p>}
      </div>
      {error
        ? <p style={{ color: ACCENT.red, fontSize: 13 }}>{error}</p>
        : loading
        ? <Skeleton h={h - 40} />
        : empty
        ? <div style={{ color: "#999", fontSize: 13, textAlign: "center", padding: "48px 0" }}>Aucune donnée sur la période</div>
        : children}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Statistiques({ user, navigateTo }) {
  const [periodKey, setPeriodKey] = useState("90");
  const [siteKey,   setSiteKey]   = useState("all");
  const [consoDim,  setConsoDim]  = useState("machine");
  const [loading,   setLoading]   = useState(true);
  const [errors,    setErrors]    = useState({});
  const [data,      setData]      = useState({
    kpi: null, topProduits: [], conso: [], orTech: [], orMensuel: [], sortiesMensuel: [], parSite: [],
  });

  const period = PERIODS.find(p => p.key === periodKey) || PERIODS[1];
  const site   = SITE_OPTIONS.find(s => s.key === siteKey) || SITE_OPTIONS[0];

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const pDays = period.days;
    const pSite = site.site;
    const [kpiR, prodR, consoR, orTechR, orMoisR, sortiesR, siteR] = await Promise.allSettled([
      statsKpi(pSite),
      statsTopProduits(pDays, pSite, 20),
      statsTopConsommateurs(pDays, pSite, consoDim, 15),
      statsOrParTechnicien(pDays, pSite, 15),
      statsOrMensuel(12, pSite),
      statsSortiesMensuel(12, pSite),
      statsParSite(pDays),
    ]);
    const errs = {};
    const val = (r, key) => {
      if (r.status === "fulfilled") return r.value;
      errs[key] = "Erreur de chargement";
      return key === "kpi" ? null : [];
    };
    setData({
      kpi:            val(kpiR, "kpi"),
      topProduits:    val(prodR, "topProduits"),
      conso:          val(consoR, "conso"),
      orTech:         val(orTechR, "orTech"),
      orMensuel:      val(orMoisR, "orMensuel"),
      sortiesMensuel: val(sortiesR, "sortiesMensuel"),
      parSite:        val(siteR, "parSite"),
    });
    setErrors(errs);
    setLoading(false);
  }, [period.days, site.site, consoDim]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── 403 GUARD (le RLS/RPC garde aussi côté serveur) ─────────────────────────
  if (user?.role !== "admin") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: ACCENT.red }}>Accès réservé aux administrateurs</div>
      </div>
    );
  }

  // ── EXPORT EXCEL ────────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const add = (rows, name) => {
      if (rows && rows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));
    };
    add(data.topProduits.map(r => ({ Article: r.article_name, Réf: r.article_id, Quantité: r.total_qte, "Coût FIFO €": r.total_cout, "Nb sorties": r.nb_sorties })), "Top produits");
    add(data.conso.map(r => ({ [consoDim === "technicien" ? "Technicien" : "Machine"]: r.label, Quantité: r.total_qte, "Coût FIFO €": r.total_cout, "Nb OR": r.nb_or })), "Top consommateurs");
    add(data.orTech.map(r => ({ Technicien: r.technicien, "Nb OR": r.nb_or })), "OR par technicien");
    add(data.sortiesMensuel.map(r => ({ Mois: r.mois, Quantité: r.total_qte, "Coût FIFO €": r.total_cout })), "Volume mensuel");
    add(data.orMensuel.map(r => ({ Mois: r.mois, "Nb OR": r.nb_or })), "OR mensuel");
    add(data.parSite.map(r => ({ Site: SITE_META[r.site]?.label || r.site, Quantité: r.total_qte, "Coût FIFO €": r.total_cout, "Nb OR": r.nb_or })), "Répartition site");
    if (data.kpi) add([{ "Sorties du mois": data.kpi.sorties_mois, "Valeur consommée €": data.kpi.cout_mois, "OR du mois": data.kpi.nb_or_mois, "Réf la plus demandée": data.kpi.ref_top_name, "Qté réf top": data.kpi.ref_top_qte }], "KPI");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `statistiques_${site.key}_${period.key}_${stamp}.xlsx`);
  };

  const kpi = data.kpi;
  const parSiteChart = data.parSite.map(r => ({ ...r, label: SITE_META[r.site]?.short || r.site }));
  const dimLabel = consoDim === "technicien" ? "technicien" : "véhicule / engin";

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, color: "#1a1a1a", minHeight: "100vh" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {navigateTo && (
            <button onClick={() => navigateTo("admin")}
              style={{ background: "#fff", border: "1px solid #e0e0d8", borderRadius: 8, color: "#1a1a1a", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "6px 12px" }}>
              ← Administration
            </button>
          )}
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>📊 Statistiques</h1>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={exportExcel} disabled={loading}
            style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#065f46", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 13 }}>
            ⬇️ Export Excel
          </button>
          <button onClick={fetchAll} disabled={loading}
            style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #e0e0d8", background: loading ? "#e0e0d8" : "#1e2330", color: loading ? "#475569" : "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-block", animation: loading ? "spin 1s linear infinite" : "none" }}>⟳</span>
            {loading ? "Chargement…" : "Actualiser"}
          </button>
        </div>
      </div>

      {/* GLOBAL FILTERS */}
      <div style={{ ...CARD, padding: "12px 16px", marginBottom: 22, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#777", fontWeight: 700 }}>PÉRIODE</span>
          <div style={{ display: "flex", gap: 4, background: "#f5f5f0", padding: 4, borderRadius: 10 }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriodKey(p.key)}
                style={{ padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: periodKey === p.key ? "#1e2330" : "transparent", color: periodKey === p.key ? "#fff" : "#666" }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#777", fontWeight: 700 }}>SITE</span>
          <select value={siteKey} onChange={e => setSiteKey(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid #e0e0d8", background: "#fff", color: "#1a1a1a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {SITE_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 22 }}>
        <KPICard loading={loading} icon="📤" label="Sorties du mois"    value={fmt(kpi?.sorties_mois)}               color={ACCENT.blue} />
        <KPICard loading={loading} icon="💶" label="Valeur consommée (mois)" value={fmtEur(kpi?.cout_mois)}          color={ACCENT.green} />
        <KPICard loading={loading} icon="🔧" label="OR créés ce mois"   value={fmt(kpi?.nb_or_mois)}                 color={ACCENT.purple} />
        <KPICard loading={loading} icon="🥇" label="Réf. la plus demandée" value={truncate(kpi?.ref_top_name, 18)} sub={kpi?.ref_top_qte ? `${fmt(kpi.ref_top_qte)} sortis ce mois` : "—"} color={ACCENT.amber} />
      </div>

      {/* #1 TOP 20 PRODUITS */}
      <div style={{ marginBottom: 18 }}>
        <Panel title="🏆 TOP 20 produits les plus sortis" subtitle={`Quantités sorties · ${period.label.toLowerCase()} · ${site.label.toLowerCase()}`}
          loading={loading} error={errors.topProduits} empty={!loading && data.topProduits.length === 0} h={560}>
          <ResponsiveContainer width="100%" height={Math.max(320, data.topProduits.length * 26)}>
            <BarChart data={data.topProduits} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="article_name" width={220} tick={{ fill: "#444", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => truncate(v, 32)} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#00000008" }}
                formatter={(v, n) => n === "total_cout" ? [fmtEur(v), "Coût FIFO"] : [fmt(v), "Quantité"]} />
              <Bar dataKey="total_qte" name="Quantité" fill={ACCENT.blue} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* #2 CONSOMMATEURS + #5 RÉPARTITION SITE */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, marginBottom: 18 }}>
        <Panel
          title="👷 TOP consommateurs"
          subtitle={`Par ${dimLabel} · quantité sortie · sorties liées à un OR uniquement`}
          loading={loading} error={errors.conso} empty={!loading && data.conso.length === 0} h={400}>
          <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "#f5f5f0", padding: 4, borderRadius: 9, width: "fit-content" }}>
            {[["machine", "🚜 Véhicule / engin"], ["technicien", "🧑‍🔧 Technicien"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setConsoDim(k)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: consoDim === k ? "#1e2330" : "transparent", color: consoDim === k ? "#fff" : "#666" }}>
                {lbl}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={Math.max(240, data.conso.length * 24)}>
            <BarChart data={data.conso} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={180} tick={{ fill: "#444", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => truncate(v, 26)} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#00000008" }}
                formatter={(v, n, p) => [`${fmt(v)} pièces · ${fmtEur(p?.payload?.total_cout)} · ${fmt(p?.payload?.nb_or)} OR`, "Consommation"]} />
              <Bar dataKey="total_qte" name="Quantité" fill={ACCENT.green} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="🏭 Répartition par site" subtitle={`Quantité de sorties · ${period.label.toLowerCase()}`}
          loading={loading} error={errors.parSite} empty={!loading && parSiteChart.length === 0} h={400}>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={parSiteChart} dataKey="total_qte" nameKey="label" cx="50%" cy="50%" outerRadius={110} innerRadius={55}
                label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {parSiteChart.map(r => <Cell key={r.site} fill={SITE_META[r.site]?.color || "#94a3b8"} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n, p) => [`${fmt(v)} pièces · ${fmt(p?.payload?.nb_or)} OR`, p?.payload?.label]} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#666" }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* #3 OR PAR TECHNICIEN + ÉVOLUTION MENSUELLE */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, marginBottom: 18 }}>
        <Panel title="📝 TOP créateurs d'OR" subtitle="Par technicien (proxy — pas de créateur en base) · nombre d'OR"
          loading={loading} error={errors.orTech} empty={!loading && data.orTech.length === 0} h={400}>
          <ResponsiveContainer width="100%" height={Math.max(240, data.orTech.length * 24)}>
            <BarChart data={data.orTech} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="technicien" width={150} tick={{ fill: "#444", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => truncate(v, 22)} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#00000008" }} formatter={(v) => [fmt(v), "OR créés"]} />
              <Bar dataKey="nb_or" name="OR créés" fill={ACCENT.purple} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="📅 Évolution mensuelle des OR" subtitle="12 derniers mois"
          loading={loading} error={errors.orMensuel} empty={!loading && data.orMensuel.length === 0} h={400}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data.orMensuel} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
              <XAxis dataKey="mois" tickFormatter={monthLabel} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={monthLabel} formatter={(v) => [fmt(v), "OR"]} />
              <Line type="monotone" dataKey="nb_or" name="OR créés" stroke={ACCENT.purple} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* #4 VOLUME SORTIES PAR MOIS */}
      <Panel title="📉 Volume de sorties par mois" subtitle="12 derniers mois · quantité et valeur consommée (coût FIFO)"
        loading={loading} error={errors.sortiesMensuel} empty={!loading && data.sortiesMensuel.length === 0} h={380}>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data.sortiesMensuel} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
            <XAxis dataKey="mois" tickFormatter={monthLabel} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis yAxisId="q" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis yAxisId="c" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={monthLabel}
              formatter={(v, n) => n === "total_cout" ? [fmtEur(v), "Valeur consommée"] : [fmt(v), "Quantité"]} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#666" }} />
            <Line yAxisId="q" type="monotone" dataKey="total_qte"  name="Quantité"          stroke={ACCENT.blue}  strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line yAxisId="c" type="monotone" dataKey="total_cout" name="Valeur consommée €" stroke={ACCENT.green} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}
