import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabase.js";

const STATUTS = {
  "Disponible":             { bg: "#d1fae5", text: "#065f46" },
  "En cours d'utilisation": { bg: "#fef3c7", text: "#92400e" },
  "Endommagé":              { bg: "#fee2e2", text: "#991b1b" },
  "Retiré":                 { bg: "#f3f4f6", text: "#374151" },
  "Service":                { bg: "#dbeafe", text: "#1e40af" },
  "Manquant":               { bg: "#f3e8ff", text: "#6b21a8" },
  "Volé":                   { bg: "#fce7f3", text: "#9d174d" },
};

const SITE_LABELS = {
  clmtp_sable:  "CLMTP Sablé",
  stmf:         "STMF",
  claisse_rail: "Claisse Rail",
};

const PAGE_SIZE = 100;

function StatutBadge({ statut }) {
  const c = STATUTS[statut] || { bg: "#f3f4f6", text: "#374151" };
  return (
    <span style={{ background: c.bg, color: c.text, padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {statut || "—"}
    </span>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: "#6b7280", fontSize: 14 }}>
      <div style={{ width: 20, height: 20, border: "2px solid #e5e7eb", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      Chargement…
    </div>
  );
}

export default function InventaireOutillage({ user, siteId }) {
  const [equipements, setEquipements] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filterSite, setFilterSite]   = useState(siteId || "tous");
  const [filterCat, setFilterCat]     = useState("tous");
  const [filterStatut, setFilterStatut] = useState("tous");
  const [page, setPage]               = useState(0);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("equipements")
      .select("*")
      .order("nom")
      .then(({ data, error }) => {
        if (error) console.error("equipements:", error);
        setEquipements(data || []);
        setLoading(false);
      });
  }, []);

  // Listes dynamiques pour les selects
  const categories = useMemo(() =>
    [...new Set(equipements.map(e => e.categorie).filter(Boolean))].sort(),
    [equipements]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return equipements.filter(e => {
      if (filterSite !== "tous"   && e.site !== filterSite)     return false;
      if (filterCat  !== "tous"   && e.categorie !== filterCat) return false;
      if (filterStatut !== "tous" && e.statut !== filterStatut) return false;
      if (q && ![e.nom, e.code, e.modele, e.fabricant, e.assigne_a, e.numero_serie]
                .some(v => (v||"").toLowerCase().includes(q)))  return false;
      return true;
    });
  }, [equipements, filterSite, filterCat, filterStatut, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // reset page quand les filtres changent
  useEffect(() => { setPage(0); }, [search, filterSite, filterCat, filterStatut]);

  const stats = useMemo(() => ({
    total:      equipements.length,
    disponible: equipements.filter(e => e.statut === "Disponible").length,
    en_cours:   equipements.filter(e => e.statut === "En cours d'utilisation").length,
    endommage:  equipements.filter(e => ["Endommagé","Volé","Manquant"].includes(e.statut)).length,
  }), [equipements]);

  const TH = ({ children, right }) => (
    <th style={{ padding: "10px 12px", textAlign: right ? "right" : "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
      {children}
    </th>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111827", margin: 0 }}>Inventaire outillage</h1>
        <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>
          {equipements.length} équipements · {stats.disponible} disponibles · {stats.en_cours} en cours
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
        {[
          { l: "Total",       v: stats.total,      icon: "🔧", color: "#111827" },
          { l: "Disponibles", v: stats.disponible, icon: "✅", color: "#065f46" },
          { l: "En cours",    v: stats.en_cours,   icon: "🔨", color: "#92400e" },
          { l: "Incidents",   v: stats.endommage,  icon: "⚠️", color: "#dc2626" },
        ].map(k => (
          <div key={k.l} style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{k.icon}</div>
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
          placeholder="🔍  Code, description, modèle, assigné…"
          style={{ flex: 1, minWidth: 240, padding: "10px 16px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 14, outline: "none" }}
        />

        {/* Site */}
        <select value={filterSite} onChange={e => setFilterSite(e.target.value)}
          style={{ padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff" }}>
          <option value="tous">Tous les sites</option>
          {Object.entries(SITE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          <option value="">Non assigné</option>
        </select>

        {/* Catégorie */}
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          style={{ padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff", maxWidth: 220 }}>
          <option value="tous">Toutes catégories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Statut */}
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          style={{ padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff" }}>
          <option value="tous">Tous les statuts</option>
          {Object.keys(STATUTS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Résultats */}
      {loading ? <Spinner /> : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
              {filtered.length !== equipements.length ? ` (sur ${equipements.length})` : ""}
            </span>
            {totalPages > 1 && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  style={{ padding: "5px 12px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", cursor: page === 0 ? "not-allowed" : "pointer", color: page === 0 ? "#d1d5db" : "#374151", fontWeight: 600, fontSize: 13 }}>←</button>
                <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                  {page + 1} / {totalPages}
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  style={{ padding: "5px 12px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", cursor: page >= totalPages - 1 ? "not-allowed" : "pointer", color: page >= totalPages - 1 ? "#d1d5db" : "#374151", fontWeight: 600, fontSize: 13 }}>→</button>
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 60, textAlign: "center", color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔧</div>
              <div style={{ fontWeight: 700, color: "#374151", fontSize: 15 }}>Aucun équipement trouvé</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Modifiez vos critères de recherche.</div>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#111827" }}>
                      <TH>Code</TH>
                      <TH>Fabricant</TH>
                      <TH>Description</TH>
                      <TH>Modèle</TH>
                      <TH>Catégorie</TH>
                      <TH>Site</TH>
                      <TH>Statut</TH>
                      <TH>Assigné à</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((e, i) => (
                      <tr key={e.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "#7c3aed", whiteSpace: "nowrap" }}>
                          {e.code || "—"}
                        </td>
                        <td style={{ padding: "9px 12px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                          {e.fabricant || "—"}
                        </td>
                        <td style={{ padding: "9px 12px", maxWidth: 280 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nom}</div>
                          {e.numero_serie && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>S/N {e.numero_serie}</div>}
                        </td>
                        <td style={{ padding: "9px 12px", fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>
                          {e.modele || "—"}
                        </td>
                        <td style={{ padding: "9px 12px", fontSize: 12, color: "#374151" }}>
                          {e.categorie || "—"}
                        </td>
                        <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                          {e.site ? (
                            <span style={{ background: "#f0f9ff", color: "#0369a1", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                              {SITE_LABELS[e.site] || e.site}
                            </span>
                          ) : <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                          <StatutBadge statut={e.statut} />
                        </td>
                        <td style={{ padding: "9px 12px", fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>
                          {e.assigne_a || <span style={{ color: "#9ca3af" }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
