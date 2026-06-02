import { useState, useEffect, useCallback } from "react";
import { ALL_PRODUCTS } from "./products.js";
import { supabase } from "./supabase.js";
import { getStockOverrides, getCatalogue, getUtilisateurs } from "./db.js";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";

// ── HELPERS ───────────────────────────────────────────────────────────────────
function fmt(n) {
  return (n || 0).toLocaleString("fr-FR");
}
function fmtEur(n) {
  return (n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}
function fmtRelative(d) {
  if (!d) return "Jamais connecté";
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000) return "À l'instant";
  if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)} h`;
  return new Date(d).toLocaleDateString("fr-FR");
}

const SITE_META = {
  clmtp_sable:  { label: "CLMTP SABLÉ",   icon: "🏗️", color: "#1e40af", dot: "#3b82f6" },
  claisse_rail: { label: "CLAISSE RAIL",   icon: "🚂", color: "#065f46", dot: "#10b981" },
  stmf:         { label: "STMF",           icon: "⚙️", color: "#7c3aed", dot: "#a78bfa" },
};

const VOLUME_COLORS = ["#3b82f6", "#10b981", "#a78bfa"];
const SITE_LABELS   = { clmtp_sable: "SABLÉ", claisse_rail: "CLAISSE", stmf: "STMF" };

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────
function Skeleton({ h = 100 }) {
  return (
    <div style={{
      background: "#263248", borderRadius: 12, height: h,
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

function ErrorMsg({ msg }) {
  return <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{msg}</p>;
}

function KPICard({ icon, label, value, color, loading }) {
  if (loading) return <Skeleton h={110} />;
  return (
    <div style={{
      background: "#1e293b", borderRadius: 14, padding: "18px 20px",
      border: "1px solid #334155",
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function SiteCard({ siteKey, products, loading, error }) {
  const meta = SITE_META[siteKey];
  if (loading) return <Skeleton h={150} />;
  if (error) return (
    <div style={{
      background: "#1e293b", borderRadius: 14, padding: 20,
      border: "1px solid #334155", flex: 1, minWidth: 220,
    }}>
      <ErrorMsg msg={error} />
    </div>
  );
  const total   = products.length;
  const enStock = products.filter(p => p.stock > 0).length;
  const ruptures = products.filter(p => p.stock === 0).length;
  const faibles  = products.filter(p => p.min > 0 && p.stock > 0 && p.stock < p.min).length;
  const valeur   = products.reduce((s, p) => s + (p.stock * (p.prix || 0)), 0);
  const pct      = total > 0 ? Math.round((enStock / total) * 100) : 0;
  return (
    <div style={{
      background: "#1e293b", borderRadius: 14, padding: "18px 20px",
      border: `1px solid ${meta.color}55`, flex: 1, minWidth: 220,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, fontSize: 20,
          background: meta.color + "33",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{meta.icon}</div>
        <span style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>{meta.label}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { v: fmt(total),     l: "Références",  c: "#f1f5f9" },
          { v: fmtEur(valeur), l: "Valeur stock", c: "#10b981" },
          { v: fmt(ruptures),  l: "Ruptures",     c: "#ef4444" },
          { v: fmt(faibles),   l: "Stock faible", c: "#f59e0b" },
        ].map(({ v, l, c }) => (
          <div key={l}>
            <div style={{ fontSize: 18, fontWeight: 900, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#0f172a", borderRadius: 6, height: 6, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: meta.dot, borderRadius: 6, transition: "width 0.6s ease",
        }} />
      </div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, textAlign: "right" }}>
        {pct}% en stock
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function AdminDashboard({ user, navigateTo }) {
  const [loading,      setLoading]      = useState(false);
  const [lastRefresh,  setLastRefresh]  = useState(null);
  const [errors,       setErrors]       = useState({});
  const [stockSable,   setStockSable]   = useState([]);
  const [stockClaisse, setStockClaisse] = useState([]);
  const [stockStmf,    setStockStmf]    = useState([]);
  const [mouvements,   setMouvements]   = useState([]);
  const [ordres,       setOrdres]       = useState([]);
  const [prets,        setPrets]        = useState([]);
  const [utilisateurs, setUtilisateurs] = useState([]);

  const fetchAll = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setErrors({});
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const [ovRes, clRes, stRes, mvRes, prRes, orRes, usRes] =
      await Promise.allSettled([
        getStockOverrides(),
        getCatalogue("claisse_rail"),
        getCatalogue("stmf"),
        supabase
          .from("mouvements")
          .select("id,created_at,type,site_id")
          .gte("created_at", since30),
        supabase
          .from("prets")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("ordres_reparation")
          .select("id,statut,site_id,created_at"),
        getUtilisateurs(),
      ]);

    const errs = {};

    // Stock SABLÉ — statique + overrides
    const ov = ovRes.status === "fulfilled" ? ovRes.value : null;
    if (!ov) errs.stockSable = "Erreur chargement overrides SABLÉ";
    setStockSable(
      ALL_PRODUCTS.map(p => ({
        ...p,
        stock: ov && ov[p.id] !== undefined ? ov[p.id] : p.stock,
      }))
    );

    // Stock CLAISSE RAIL
    if (clRes.status === "fulfilled") setStockClaisse(clRes.value);
    else errs.stockClaisse = "Erreur chargement stock CLAISSE RAIL";

    // Stock STMF
    if (stRes.status === "fulfilled") setStockStmf(stRes.value);
    else errs.stockStmf = "Erreur chargement stock STMF";

    // Mouvements
    if (mvRes.status === "fulfilled" && !mvRes.value.error)
      setMouvements(mvRes.value.data || []);
    else errs.mouvements = "Erreur chargement mouvements";

    // Prêts
    if (prRes.status === "fulfilled" && !prRes.value.error)
      setPrets(prRes.value.data || []);
    else errs.prets = "Erreur chargement prêts";

    // Ordres
    if (orRes.status === "fulfilled" && !orRes.value.error)
      setOrdres(orRes.value.data || []);
    else errs.ordres = "Erreur chargement ordres";

    // Utilisateurs
    if (usRes.status === "fulfilled") setUtilisateurs(usRes.value);
    else errs.utilisateurs = "Erreur chargement utilisateurs";

    setErrors(errs);
    setLastRefresh(new Date());
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── 403 GUARD ──────────────────────────────────────────────────────────────
  if (user?.role !== "admin") {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: 400, flexDirection: "column", gap: 16,
      }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#f87171" }}>
          Accès réservé aux administrateurs
        </div>
      </div>
    );
  }

  // ── COMPUTED ───────────────────────────────────────────────────────────────
  const allProducts   = [...stockSable, ...stockClaisse, ...stockStmf];
  const totalRefs     = allProducts.length;
  const totalValue    = allProducts.reduce((s, p) => s + p.stock * (p.prix || 0), 0);
  const totalRuptures = allProducts.filter(p => p.stock === 0).length;
  const totalOR       = ordres.filter(o => !["termine", "annule"].includes(o.statut)).length;
  const pretsActifs   = prets.filter(p => !p.date_retour_effective);

  // BarChart entrées/sorties — 7 derniers jours
  const chartMouv = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().slice(0, 10);
    return {
      date:    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      entrees: mouvements.filter(m => m.type === "entree" && (m.created_at || "").slice(0, 10) === ds).length,
      sorties: mouvements.filter(m => m.type === "sortie" && (m.created_at || "").slice(0, 10) === ds).length,
    };
  });

  // BarChart volume par site — 30 jours
  const chartVolume = [
    { site: "SABLÉ",        count: mouvements.filter(m => !m.site_id || m.site_id === "clmtp_sable").length },
    { site: "CLAISSE RAIL", count: mouvements.filter(m => m.site_id === "claisse_rail").length },
    { site: "STMF",         count: mouvements.filter(m => m.site_id === "stmf").length },
  ];

  // Alertes stock bas — triées par criticité
  const alertes = allProducts
    .filter(p => p.min > 0 && p.stock < p.min)
    .sort((a, b) => (a.stock / a.min) - (b.stock / b.min))
    .slice(0, 15);

  // 8 dernières connexions
  const recentUsers = [...utilisateurs]
    .sort((a, b) => new Date(b.derniere_connexion || 0) - new Date(a.derniere_connexion || 0))
    .slice(0, 8);

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: "#0f172a", minHeight: "100vh", padding: 24,
      color: "#f1f5f9", fontFamily: "inherit",
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes spin   { to{transform:rotate(360deg)} }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 28, flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {navigateTo && (
            <button
              onClick={() => navigateTo("dashboard")}
              style={{
                background: "none", border: "1px solid #334155", borderRadius: 8,
                color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600,
                padding: "6px 12px", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              ← Dashboard
            </button>
          )}
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#f1f5f9" }}>
            ⚙️ Administration
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
            {lastRefresh
              ? `Actualisé à ${lastRefresh.toLocaleTimeString("fr-FR")}`
              : "Chargement en cours…"}
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          style={{
            padding: "10px 22px", borderRadius: 10, border: "1px solid #334155",
            background: loading ? "#1e293b" : "#1e40af",
            color: loading ? "#475569" : "#fff",
            fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 14,
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <span style={{
            display: "inline-block",
            animation: loading ? "spin 1s linear infinite" : "none",
          }}>⟳</span>
          {loading ? "Chargement…" : "Actualiser"}
        </button>
      </div>

      {/* ── KPI CARDS ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 14, marginBottom: 24,
      }}>
        <KPICard loading={loading} icon="🗂"  label="Total références"    value={fmt(totalRefs)}          color="#3b82f6" />
        <KPICard loading={loading} icon="💶"  label="Valeur stock globale" value={fmtEur(totalValue)}      color="#10b981" />
        <KPICard loading={loading} icon="🔴"  label="Ruptures totales"     value={fmt(totalRuptures)}      color="#ef4444" />
        <KPICard loading={loading} icon="🔧"  label="OR ouverts"           value={fmt(totalOR)}            color="#8b5cf6" />
        <KPICard loading={loading} icon="🤝"  label="Prêts actifs"         value={fmt(pretsActifs.length)} color="#f59e0b" />
      </div>

      {/* ── STOCK PAR SITE ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <SiteCard siteKey="clmtp_sable"  products={stockSable}   loading={loading} error={errors.stockSable} />
        <SiteCard siteKey="claisse_rail" products={stockClaisse} loading={loading} error={errors.stockClaisse} />
        <SiteCard siteKey="stmf"         products={stockStmf}    loading={loading} error={errors.stockStmf} />
      </div>

      {/* ── MOUVEMENTS 7J + ALERTES ────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 3fr) minmax(220px, 2fr)",
        gap: 14, marginBottom: 24,
      }}>
        {/* BarChart mouvements 7j */}
        <div style={{
          background: "#1e293b", borderRadius: 14, padding: "20px 20px 10px",
          border: "1px solid #334155",
        }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>
            📈 Mouvements — 7 derniers jours
          </h3>
          {errors.mouvements
            ? <ErrorMsg msg={errors.mouvements} />
            : loading
            ? <Skeleton h={220} />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartMouv} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false} tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a", border: "1px solid #334155",
                      borderRadius: 8, color: "#f1f5f9",
                    }}
                    labelStyle={{ color: "#94a3b8", marginBottom: 4 }}
                    cursor={{ fill: "#ffffff08" }}
                  />
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                  <Bar dataKey="entrees" name="Entrées" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sorties" name="Sorties" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Alertes stock bas */}
        <div style={{
          background: "#1e293b", borderRadius: 14, padding: 20,
          border: "1px solid #334155", display: "flex", flexDirection: "column",
        }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>
            ⚠️ Alertes stock bas
          </h3>
          {loading
            ? <Skeleton h={220} />
            : alertes.length === 0
            ? (
              <div style={{ color: "#10b981", fontSize: 13, textAlign: "center", padding: 28 }}>
                ✅ Aucune alerte
              </div>
            )
            : (
              <div style={{ overflowY: "auto", maxHeight: 248, display: "flex", flexDirection: "column", gap: 6 }}>
                {alertes.map(p => {
                  const isRupture = p.stock === 0;
                  return (
                    <div key={p.id} style={{
                      padding: "8px 12px", borderRadius: 8,
                      background: isRupture ? "#3f1212" : "#3f2a0a",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div style={{ flex: 1, overflow: "hidden", marginRight: 8 }}>
                        <div style={{
                          fontWeight: 600, fontSize: 12, color: "#f1f5f9",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{p.fournisseur || "—"}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{
                          fontWeight: 900, fontSize: 16,
                          color: isRupture ? "#f87171" : "#fbbf24",
                        }}>{p.stock}</div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>min: {p.min}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      </div>

      {/* ── PRÊTS ACTIFS + ACTIVITÉ UTILISATEURS ──────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 14,
      }}>
        {/* Prêts actifs */}
        <div style={{
          background: "#1e293b", borderRadius: 14, padding: 20,
          border: "1px solid #334155",
        }}>
          <h3 style={{
            margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: "#f1f5f9",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            🤝 Prêts en cours
            {!loading && (
              <span style={{
                background: "#f59e0b22", color: "#f59e0b",
                borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700,
              }}>
                {pretsActifs.length}
              </span>
            )}
          </h3>
          {errors.prets
            ? <ErrorMsg msg={errors.prets} />
            : loading
            ? <Skeleton h={180} />
            : pretsActifs.length === 0
            ? <div style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: 24 }}>Aucun prêt en cours</div>
            : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Article", "Emprunteur", "Site", "Retour prévu"].map(h => (
                        <th key={h} style={{
                          padding: "6px 8px", textAlign: "left",
                          color: "#64748b", fontWeight: 600,
                          borderBottom: "1px solid #334155",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pretsActifs.slice(0, 10).map(p => {
                      const retour   = p.date_retour_prevue ? new Date(p.date_retour_prevue) : null;
                      const enRetard = retour && retour < new Date();
                      return (
                        <tr key={p.id} style={{ borderBottom: "1px solid #1e3a5f" }}>
                          <td style={{
                            padding: "9px 8px", color: "#e2e8f0",
                            maxWidth: 130, overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {p.article_name || p.article_id || "—"}
                          </td>
                          <td style={{ padding: "9px 8px", color: "#e2e8f0" }}>
                            {p.emprunteur || "—"}
                          </td>
                          <td style={{ padding: "9px 8px", color: "#94a3b8" }}>
                            {SITE_LABELS[p.site_id] || p.site_id || "—"}
                          </td>
                          <td style={{ padding: "9px 8px" }}>
                            <span style={{
                              fontWeight: 700,
                              color: enRetard ? "#f87171" : retour ? "#10b981" : "#64748b",
                            }}>
                              {retour ? retour.toLocaleDateString("fr-FR") : "—"}
                            </span>
                            {enRetard && (
                              <span style={{
                                marginLeft: 6, fontSize: 10,
                                background: "#f8717133", color: "#f87171",
                                padding: "1px 6px", borderRadius: 10,
                              }}>En retard</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>

        {/* Activité utilisateurs */}
        <div style={{
          background: "#1e293b", borderRadius: 14, padding: 20,
          border: "1px solid #334155",
        }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>
            👥 Activité utilisateurs
          </h3>
          {errors.utilisateurs
            ? <ErrorMsg msg={errors.utilisateurs} />
            : loading
            ? <Skeleton h={220} />
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Dernières connexions */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {recentUsers.map(u => {
                    const initials = (
                      ((u.prenom || "")[0] || "").toUpperCase() +
                      ((u.nom    || "")[0] || "").toUpperCase()
                    ) || "?";
                    const sm = SITE_META[u.site_id];
                    return (
                      <div key={u.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 0", borderBottom: "1px solid #263248",
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%",
                          background: sm ? sm.color : "#475569",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0,
                        }}>{initials}</div>
                        <div style={{ flex: 1, overflow: "hidden" }}>
                          <div style={{
                            fontSize: 13, fontWeight: 600, color: "#e2e8f0",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {u.prenom} {u.nom}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{u.role}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "right", flexShrink: 0 }}>
                          {fmtRelative(u.derniere_connexion)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Volume mouvements/site 30j */}
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: 0.5 }}>
                    MOUVEMENTS / SITE — 30 JOURS
                  </p>
                  {errors.mouvements
                    ? <ErrorMsg msg={errors.mouvements} />
                    : (
                      <ResponsiveContainer width="100%" height={90}>
                        <BarChart
                          data={chartVolume}
                          layout="vertical"
                          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                        >
                          <XAxis
                            type="number"
                            tick={{ fill: "#94a3b8", fontSize: 10 }}
                            axisLine={false} tickLine={false}
                            allowDecimals={false}
                          />
                          <YAxis
                            type="category" dataKey="site" width={90}
                            tick={{ fill: "#94a3b8", fontSize: 11 }}
                            axisLine={false} tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#0f172a", border: "1px solid #334155",
                              borderRadius: 8, color: "#f1f5f9",
                            }}
                            cursor={{ fill: "#ffffff08" }}
                          />
                          <Bar dataKey="count" name="Mouvements" radius={[0, 4, 4, 0]}>
                            {chartVolume.map((_, i) => (
                              <Cell key={i} fill={VOLUME_COLORS[i]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )
                  }
                </div>
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}
