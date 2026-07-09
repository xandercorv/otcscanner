import { useState, useCallback } from "react";

// ── sectors ────────────────────────────────────────────────────────
const SECTORS = [
  { id:"defi",  label:"DeFi",           cgId:"decentralized-finance-defi", color:"#6366f1" },
  { id:"ai",    label:"AI + Crypto",    cgId:"artificial-intelligence",    color:"#10b981" },
  { id:"meme",  label:"Memes",          cgId:"meme-token",                 color:"#f59e0b" },
  { id:"infra", label:"Infrastructure", cgId:"infrastructure",             color:"#8b5cf6" },
  { id:"rwa",   label:"RWA",            cgId:"real-world-assets-rwa",      color:"#06b6d4" },
];

// ── criteria ───────────────────────────────────────────────────────
const CRITERIA = [
  {
    id:"c1", num:1, auto:true,
    title:"Market Capitalisation ≥ $300M",
    desc:"Project has a market cap of at least $300M USD",
    short:"MC ≥ $300M",
  },
  {
    id:"c2", num:2, auto:false,
    title:"Liquid Perp Markets on ≥ 2 Tier-1 CEXs",
    desc:"Token has perpetual futures markets on at least 2 Tier-1 exchanges (Binance, OKX, Bybit, Coinbase, Kraken)",
    short:"Perp on 2+ CEXs",
  },
  {
    id:"c3", num:3, auto:true,
    title:"24h Spot Volume > $50M",
    desc:"Sustained 24-hour spot trading volume exceeds $50M",
    short:"Spot Vol > $50M",
  },
  {
    id:"c4", num:4, auto:false,
    title:"24h Futures Volume > $300M",
    desc:"24-hour futures/derivatives trading volume exceeds $300M",
    short:"Futures Vol > $300M",
  },
  {
    id:"c5", num:5, auto:false,
    title:"On-Chain DEX Liquidity",
    desc:"Meaningful on-chain liquidity pool depth across major DEXs (Uniswap, Curve, etc.)",
    short:"DEX Liquidity",
  },
  {
    id:"c6", num:6, auto:true,
    title:"CoinMarketCap Rank Top 200",
    desc:"Project is ranked within the top 200 on CoinMarketCap",
    short:"CMC Top 200",
  },
];

const AUTO_CRITERIA   = CRITERIA.filter(c => c.auto);
const MANUAL_CRITERIA = CRITERIA.filter(c => !c.auto);

// ── scan filter ────────────────────────────────────────────────────
const MIN_MC = 300_000_000; // $300M — no upper limit

// ── localStorage ───────────────────────────────────────────────────
function lsGet(key, fb) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// ── theme ──────────────────────────────────────────────────────────
function Th(dark) {
  return dark ? {
    bg:"#0f0f1a", bgSide:"#0a0a14", bgCard:"#13131f", bgHov:"#1a1a2e",
    border:"#1e1e35", borderMid:"#2a2a45",
    text:"#e8e8ff", textMid:"#9090c0", textDim:"#4a4a6a",
    accent:"#6366f1", accentBg:"#6366f115", accentTxt:"#a5b4fc",
    navAct:"#6366f118", navActTxt:"#a5b4fc",
    statBg:"#0d0d1a", headerBg:"#0a0a14",
    overlay:"rgba(0,0,0,0.8)", modalBg:"#13131f",
    green:"#22c55e", greenBg:"#052e16", greenText:"#4ade80",
    red:"#ef4444", redBg:"#1a0808", redText:"#fca5a5",
    amber:"#f59e0b", amberBg:"#1c1400", amberText:"#fbbf24",
  } : {
    bg:"#f5f5f8", bgSide:"#ffffff", bgCard:"#ffffff", bgHov:"#f9f9fc",
    border:"#e8e8f0", borderMid:"#d0d0e0",
    text:"#111827", textMid:"#6b7280", textDim:"#9ca3af",
    accent:"#6366f1", accentBg:"#6366f110", accentTxt:"#6366f1",
    navAct:"#6366f110", navActTxt:"#6366f1",
    statBg:"#f9f9fc", headerBg:"#ffffff",
    overlay:"rgba(0,0,0,0.5)", modalBg:"#ffffff",
    green:"#16a34a", greenBg:"#dcfce7", greenText:"#166534",
    red:"#dc2626", redBg:"#fef2f2", redText:"#991b1b",
    amber:"#d97706", amberBg:"#fef3c7", amberText:"#92400e",
  };
}

// ── helpers ────────────────────────────────────────────────────────
const fmtUSD = n => {
  if (!n && n !== 0) return "—";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  return "$" + n.toFixed(2);
};
const fmtPrice = n => {
  if (!n && n !== 0) return "—";
  if (n >= 1)    return "$" + n.toFixed(3);
  if (n >= 0.01) return "$" + n.toFixed(4);
  return "$" + n.toExponential(2);
};

function sectorInfo(id) { return SECTORS.find(s => s.id === id) || { label: id, color: "#6366f1" }; }

function projectURL(coin) {
  if (coin.source === "CMC") return `https://coinmarketcap.com/currencies/${coin.name.toLowerCase().replace(/\s+/g, "-")}/`;
  return `https://www.coingecko.com/en/coins/${coin.rawId}`;
}

// ── auto-score from API data ───────────────────────────────────────
function autoScore(coin) {
  return {
    c1: coin.mc >= MIN_MC,
    c3: coin.vol > 50_000_000,
    c6: coin.rank > 0 && coin.rank <= 200,
  };
}

function totalScore(coin, manualChecks) {
  const auto = autoScore(coin);
  const mc   = manualChecks[coin.id] || {};
  return [auto.c1, auto.c3, auto.c6, !!mc.c2, !!mc.c4, !!mc.c5].filter(Boolean).length;
}

function scoreLabel(n, dark) {
  if (n >= 5) return { label: "Strong OTC", bg: dark ? "#052e16" : "#dcfce7", text: dark ? "#4ade80" : "#166534", dot: "#22c55e" };
  if (n >= 3) return { label: "Good OTC",   bg: dark ? "#1c1400" : "#fef9c3", text: dark ? "#fbbf24" : "#854d0e", dot: "#f59e0b" };
  if (n >= 1) return { label: "Possible",   bg: dark ? "#1a1a35" : "#ede9fe", text: dark ? "#7070cc" : "#6366f1", dot: "#6366f1" };
  return             { label: "Weak",       bg: dark ? "#1a1a1a" : "#f9f9f9", text: dark ? "#555"    : "#9ca3af", dot: "#d1d5db" };
}

// ── API ────────────────────────────────────────────────────────────
async function fetchCGSector(sector) {
  const results = [];
  for (const page of [1, 2, 3, 4]) {
    try {
      const qs = new URLSearchParams({
        vs_currency: "usd", category: sector.cgId,
        order: "market_cap_desc", per_page: "250", page: String(page),
        sparkline: "false", price_change_percentage: "24h",
      }).toString();
      const res  = await fetch(`/api/coingecko?${qs}`);
      if (!res.ok) break;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      let addedAny = false;
      data.forEach(c => {
        if ((c.market_cap || 0) < MIN_MC) return; // skip below $300M
        results.push({
          id: "cg_" + c.id, rawId: c.id,
          name: c.name, symbol: (c.symbol || "").toUpperCase(),
          image: c.image, mc: c.market_cap || 0,
          price: c.current_price || 0, vol: c.total_volume || 0,
          change24h: c.price_change_percentage_24h || 0,
          rank: c.market_cap_rank || 9999,
          sector: sector.id, source: "CoinGecko", isNew: false,
        });
        addedAny = true;
      });
      // If nothing on this page qualifies, the rest won't either (sorted desc)
      if (!addedAny) break;
      await new Promise(r => setTimeout(r, 900));
    } catch (e) { break; }
  }
  return results;
}

async function fetchCMC() {
  const results = [];
  const now     = Date.now();
  for (const start of [1, 201]) { // top 400 is enough for $300M+
    try {
      const qs = new URLSearchParams({
        limit: "200", start: String(start), convert: "USD",
        sort: "market_cap", sort_dir: "desc",
      }).toString();
      const res  = await fetch(`/api/cmc?${qs}`);
      if (!res.ok) break;
      const data = await res.json();
      if (!data.data?.length) break;
      data.data.forEach(c => {
        const q  = c.quote?.USD || {};
        const mc = q.market_cap || 0;
        if (mc < MIN_MC) return; // skip below $300M
        const ageDays = (now - new Date(c.date_added).getTime()) / 86400000;
        results.push({
          id: "cmc_" + c.id, rawId: String(c.id),
          name: c.name, symbol: c.symbol,
          image: `https://s2.coinmarketcap.com/static/img/coins/64x64/${c.id}.png`,
          mc, price: q.price || 0, vol: q.volume_24h || 0,
          change24h: q.percent_change_24h || 0,
          rank: c.cmc_rank || 9999,
          sector: guessSector(c.tags || []),
          source: "CMC", isNew: ageDays <= 30,
        });
      });
      await new Promise(r => setTimeout(r, 600));
    } catch (e) { break; }
  }
  return results;
}

function guessSector(tags) {
  const t = tags.map(x => x.toLowerCase()).join(" ");
  if (t.includes("real-world-asset") || t.includes("rwa") || t.includes("tokenized")) return "rwa";
  if (t.includes("defi") || t.includes("dex") || t.includes("lending"))               return "defi";
  if (t.includes("ai") || t.includes("artificial-intelligence"))                       return "ai";
  if (t.includes("meme"))                                                               return "meme";
  if (t.includes("layer") || t.includes("infrastructure") || t.includes("oracle"))    return "infra";
  return "other";
}

function exportCSV(coins, manualChecks) {
  const h = ["Name","Symbol","Sector","Source","CMC Rank","Market Cap","Price","24h %","Volume (24h)","OTC Score","C1 MC≥$300M","C2 Perp 2+ CEX","C3 Spot>$50M","C4 Futures>$300M","C5 DEX Liquidity","C6 CMC Top 200"];
  const r = coins.map(c => {
    const auto = autoScore(c);
    const mc   = manualChecks[c.id] || {};
    return [
      `"${c.name}"`, c.symbol, sectorInfo(c.sector).label, c.source, c.rank,
      c.mc.toFixed(0), c.price, (c.change24h || 0).toFixed(2), c.vol.toFixed(0),
      totalScore(c, manualChecks),
      auto.c1 ? "✓" : "", mc.c2 ? "✓" : "", auto.c3 ? "✓" : "",
      mc.c4 ? "✓" : "", mc.c5 ? "✓" : "", auto.c6 ? "✓" : "",
    ].join(",");
  });
  const blob = new Blob([[h.join(","), ...r].join("\n")], { type: "text/csv" });
  Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "otc-scan.csv" }).click();
}

function Spinner() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg>;
}

// ── Project Modal ──────────────────────────────────────────────────
function ProjectModal({ coin, dark, onClose, isWatched, onToggleWatch, manualChecks, onToggleManual }) {
  const theme  = Th(dark);
  const auto   = autoScore(coin);
  const mc     = manualChecks[coin.id] || {};
  const score  = totalScore(coin, manualChecks);
  const sl     = scoreLabel(score, dark);
  const sec    = sectorInfo(coin.sector);
  const url    = projectURL(coin);
  const isCMC  = coin.source === "CMC";

  const criteriaStatus = { c1: auto.c1, c2: !!mc.c2, c3: auto.c3, c4: !!mc.c4, c5: !!mc.c5, c6: auto.c6 };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:theme.overlay, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:theme.modalBg, border:`1px solid ${theme.border}`, borderRadius:16, width:"100%", maxWidth:500, boxShadow:"0 25px 60px rgba(0,0,0,0.4)", animation:"modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)", overflow:"hidden", margin:"auto" }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,${sec.color}20,${sec.color}06)`, borderBottom:`1px solid ${theme.border}`, padding:"18px 20px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <img src={coin.image} alt={coin.name} width={48} height={48} style={{ borderRadius:"50%", border:`2px solid ${sec.color}40`, flexShrink:0 }} onError={e => { e.target.style.display = "none"; }} />
            <div>
              <div style={{ fontSize:17, fontWeight:700, color:theme.text, display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                {coin.name}
                {coin.isNew && <span style={{ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:4, background:dark?"#1a0808":"#fff5f5", color:"#ef4444", border:"1px solid #ef444430" }}>NEW</span>}
              </div>
              <div style={{ fontSize:12, color:theme.textDim, marginTop:3, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <span style={{ fontWeight:600 }}>{coin.symbol}</span>
                <span>·</span>
                <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:sec.color }} />
                  {sec.label}
                </span>
                <span>·</span>
                <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:4, background:isCMC?(dark?"#1a0a30":"#f5f3ff"):(dark?"#0a1a2e":"#eff6ff"), color:isCMC?"#8b5cf6":"#3b82f6" }}>
                  {isCMC ? "CMC" : "CoinGecko"}
                </span>
                <span>· Rank #{coin.rank}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", cursor:"pointer", color:theme.textDim, padding:4, flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* OTC score bar */}
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${theme.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:theme.textDim, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>OTC Prospect Score</div>
            <div style={{ display:"flex", gap:4 }}>
              {[1,2,3,4,5,6].map(i => (
                <div key={i} style={{ width:26, height:7, borderRadius:4, background:i<=score?sl.dot:theme.border, transition:"background 0.2s" }} />
              ))}
            </div>
          </div>
          <span style={{ display:"inline-flex", alignItems:"center", gap:6, background:sl.bg, color:sl.text, borderRadius:20, padding:"5px 14px", fontSize:12, fontWeight:700, flexShrink:0 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:sl.dot }} />{sl.label} ({score}/6)
          </span>
        </div>

        {/* Market data */}
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${theme.border}`, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
          {[
            { label:"Market Cap",   value:fmtUSD(coin.mc) },
            { label:"Price",        value:fmtPrice(coin.price) },
            { label:"24h Change",   value:(coin.change24h >= 0 ? "+" : "") + coin.change24h.toFixed(1) + "%", color:coin.change24h >= 0 ? theme.green : theme.red },
            { label:"Spot Vol 24h", value:fmtUSD(coin.vol) },
            { label:"CMC Rank",     value:"#" + coin.rank },
            { label:"Source",       value:coin.source },
          ].map(row => (
            <div key={row.label} style={{ background:theme.statBg, borderRadius:8, padding:"10px 12px", border:`1px solid ${theme.border}` }}>
              <div style={{ fontSize:9, color:theme.textDim, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>{row.label}</div>
              <div style={{ fontSize:13, fontWeight:700, color:row.color || theme.text }}>{row.value}</div>
            </div>
          ))}
        </div>

        {/* Criteria checklist */}
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${theme.border}` }}>
          <div style={{ fontSize:11, fontWeight:700, color:theme.textDim, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>OTC Criteria Checklist</div>
          {CRITERIA.map(cr => {
            const met      = criteriaStatus[cr.id];
            const isManual = !cr.auto;
            return (
              <div key={cr.id}
                onClick={isManual ? () => onToggleManual(coin.id, cr.id) : undefined}
                style={{
                  display:"flex", alignItems:"flex-start", gap:10,
                  padding:"9px 11px", borderRadius:8, marginBottom:5,
                  background: met ? (dark ? "#0a1a0a" : "#f0fdf4") : theme.statBg,
                  border: `1px solid ${met ? (dark ? "#14532d40" : "#bbf7d040") : theme.border}`,
                  cursor: isManual ? "pointer" : "default",
                  transition:"all 0.15s",
                }}>
                <div style={{
                  width:18, height:18, borderRadius:isManual ? 4 : 9,
                  border:`1.5px solid ${met ? "#22c55e" : theme.borderMid}`,
                  background: met ? "#22c55e" : "transparent",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  flexShrink:0, marginTop:1, transition:"all 0.15s",
                }}>
                  {met && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:met ? theme.green : theme.textMid, display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:10, color:theme.textDim }}>#{cr.num}</span>
                    {cr.title}
                    {isManual && <span style={{ fontSize:9, color:theme.textDim, fontWeight:400, marginLeft:"auto" }}>tap to verify</span>}
                  </div>
                  <div style={{ fontSize:11, color:theme.textDim, marginTop:2, lineHeight:1.4 }}>{cr.desc}</div>
                </div>
              </div>
            );
          })}
          <div style={{ fontSize:10, color:theme.textDim, marginTop:8, padding:"7px 10px", background:theme.statBg, borderRadius:6, border:`1px solid ${theme.border}`, lineHeight:1.5 }}>
            💡 Criteria #2, #4, #5 require manual research — verify externally then tap to mark.
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding:"14px 20px", display:"flex", gap:8, flexDirection:"column" }}>
          <a href={url} target="_blank" rel="noopener noreferrer"
            style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"11px 16px", borderRadius:9, background:isCMC?"linear-gradient(135deg,#3b48ff,#6366f1)":"linear-gradient(135deg,#2ec97b,#10b981)", color:"#fff", fontSize:13, fontWeight:700, textDecoration:"none" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            {isCMC ? "View on CoinMarketCap" : "View on CoinGecko"}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
          <button onClick={() => onToggleWatch(coin.id, coin)}
            style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"10px 16px", borderRadius:9, border:`1px solid ${isWatched ? theme.accent+"60" : theme.border}`, background:isWatched ? theme.accentBg : "transparent", color:isWatched ? theme.accentTxt : theme.textMid, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            {isWatched ? "✓ Saved to Watchlist" : "Save to Watchlist"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── main app ───────────────────────────────────────────────────────
export default function App() {
  const [dark,       setDark]      = useState(() => lsGet("otc_dark", false));
  const [sideOpen,   setSideOpen]  = useState(false);
  const [allCoins,   setAllCoins]  = useState(() => lsGet("otc_coins", []));
  const [errors,     setErrors]    = useState(() => lsGet("otc_errors", []));
  const [lastScan,   setLastScan]  = useState(() => { const v = lsGet("otc_lastscan", null); return v ? new Date(v) : null; });
  const [scanning,   setScanning]  = useState(false);
  const [progress,   setProgress]  = useState("");
  const [activeTab,  setActiveTab] = useState("all");
  const [sortBy,     setSortBy]    = useState("score");
  const [filterMin,  setFilterMin] = useState(0);
  const [page,       setPage]      = useState(0);
  const [modalCoin,  setModalCoin] = useState(null);

  // Watchlist — full coin objects, always persists
  const [watchMap, setWatchMapRaw] = useState(() => new Map(lsGet("otc_watchmap", [])));
  const setWatchMap = fn => {
    setWatchMapRaw(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      lsSet("otc_watchmap", [...next.entries()]);
      return next;
    });
  };
  const toggleWatch = (id, coinObj) => setWatchMap(prev => {
    const next = new Map(prev);
    next.has(id) ? next.delete(id) : next.set(id, coinObj || prev.get(id));
    return next;
  });

  // Manual criteria checks per coin — persists
  const [manualChecks, setManualChecksRaw] = useState(() => lsGet("otc_manual", {}));
  const setManualChecks = fn => {
    setManualChecksRaw(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      lsSet("otc_manual", next);
      return next;
    });
  };
  const toggleManual = (coinId, criteriaId) => {
    setManualChecks(prev => {
      const coinChecks = { ...(prev[coinId] || {}) };
      coinChecks[criteriaId] = !coinChecks[criteriaId];
      return { ...prev, [coinId]: coinChecks };
    });
    if (modalCoin?.id === coinId) setModalCoin(mc => mc ? { ...mc } : mc);
  };

  const persist = (coins, errs, ts) => {
    setAllCoins(coins); lsSet("otc_coins", coins);
    setErrors(errs);    lsSet("otc_errors", errs);
    setLastScan(ts);    lsSet("otc_lastscan", ts?.toISOString() || null);
  };

  // ── scan ─────────────────────────────────────────────────────────
  const scan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setAllCoins([]); lsSet("otc_coins", []);
    setErrors([]); setPage(0);

    const fetched = [], errs = [];

    // CoinGecko — each sector
    for (let i = 0; i < SECTORS.length; i++) {
      const sec = SECTORS[i];
      setProgress(`CoinGecko: ${sec.label} (${i + 1}/${SECTORS.length})`);
      try { fetched.push(...await fetchCGSector(sec)); }
      catch (e) { errs.push(`CG/${sec.label}: ${e.message}`); }
      if (i < SECTORS.length - 1) await new Promise(r => setTimeout(r, 1200));
    }

    // CMC
    setProgress("CMC: fetching…");
    const cgSymbols = new Set(fetched.map(c => c.symbol));
    try {
      const cmcCoins = await fetchCMC();
      for (const c of cmcCoins) {
        if (cgSymbols.has(c.symbol)) continue; // dedup — CG version kept
        fetched.push(c);
      }
    } catch (e) { errs.push(`CMC: ${e.message}`); }

    // Dedup by rawId
    const seen  = new Set();
    const final = fetched.filter(c => {
      if (seen.has(c.rawId)) return false;
      seen.add(c.rawId);
      return true;
    });

    persist(final, errs, new Date());
    setScanning(false);
    setProgress("");
  }, [scanning]);

  const clearScan = () => {
    setAllCoins([]); lsSet("otc_coins", []);
    setErrors([]);   lsSet("otc_errors", []);
    setLastScan(null); lsSet("otc_lastscan", null);
    setPage(0);
  };
  const clearWatchlist = () => setWatchMap(new Map());
  const watchCoins = [...watchMap.values()];

  const SORT_OPTIONS = [
    { value:"score",   label:"OTC Score"    },
    { value:"rank",    label:"CMC Rank"     },
    { value:"mc_desc", label:"Market Cap ↓" },
    { value:"mc_asc",  label:"Market Cap ↑" },
    { value:"vol",     label:"Volume ↓"     },
    { value:"change",  label:"24h Change"   },
  ];

  const tabs = [
    { id:"all",   label:"All",            count:allCoins.length },
    { id:"defi",  label:"DeFi",           count:allCoins.filter(c => c.sector==="defi").length,  color:"#6366f1" },
    { id:"ai",    label:"AI + Crypto",    count:allCoins.filter(c => c.sector==="ai").length,    color:"#10b981" },
    { id:"meme",  label:"Memes",          count:allCoins.filter(c => c.sector==="meme").length,  color:"#f59e0b" },
    { id:"infra", label:"Infrastructure", count:allCoins.filter(c => c.sector==="infra").length, color:"#8b5cf6" },
    { id:"rwa",   label:"RWA",            count:allCoins.filter(c => c.sector==="rwa").length,   color:"#06b6d4" },
    { id:"watch", label:"Watchlist",      count:watchCoins.length },
  ];

  const baseList = activeTab === "watch" ? watchCoins
    : activeTab === "all" ? allCoins
    : allCoins.filter(c => c.sector === activeTab);

  const filtered = [...baseList]
    .filter(c => totalScore(c, manualChecks) >= filterMin)
    .sort((a, b) => {
      if (sortBy === "score")   return totalScore(b, manualChecks) - totalScore(a, manualChecks);
      if (sortBy === "rank")    return (a.rank || 9999) - (b.rank || 9999);
      if (sortBy === "mc_desc") return b.mc - a.mc;
      if (sortBy === "mc_asc")  return a.mc - b.mc;
      if (sortBy === "vol")     return b.vol - a.vol;
      if (sortBy === "change")  return (b.change24h || 0) - (a.change24h || 0);
      return 0;
    });

  const PAGE_SIZE = 10;
  const pageStart = page * PAGE_SIZE;
  const visible   = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const hasMore   = pageStart + PAGE_SIZE < filtered.length;
  const selectTab = id => { setActiveTab(id); setPage(0); setSideOpen(false); };
  const theme     = Th(dark);
  const strongCount = allCoins.filter(c => totalScore(c, manualChecks) >= 3).length;

  // ── sidebar ───────────────────────────────────────────────────────
  const SidebarInner = () => (
    <>
      <div style={{ padding:"20px 18px 14px", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:theme.text }}>OTC Scanner</div>
          <div style={{ fontSize:11, color:theme.textDim, marginTop:1 }}>Web3 Deal Flow</div>
        </div>
      </div>

      <div style={{ padding:"0 10px", flex:1 }}>
        <div style={{ fontSize:10, fontWeight:700, color:theme.textDim, letterSpacing:"0.1em", textTransform:"uppercase", padding:"6px 8px 8px" }}>Sectors</div>
        {tabs.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => selectTab(t.id)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 10px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", background:active ? theme.navAct : "transparent", color:active ? theme.navActTxt : theme.textMid, fontSize:14, fontWeight:active ? 600 : 400, marginBottom:2, transition:"all 0.12s", textAlign:"left" }}>
              <span style={{ display:"flex", alignItems:"center", gap:8 }}>
                {t.color && <span style={{ width:7, height:7, borderRadius:"50%", background:active ? t.color : theme.borderMid, flexShrink:0, transition:"background 0.12s" }} />}
                {t.label}
              </span>
              {t.count > 0 && <span style={{ background:active ? theme.accent : theme.border, color:active ? "#fff" : theme.textDim, fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:20, minWidth:22, textAlign:"center" }}>{t.count}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ borderTop:`1px solid ${theme.border}`, padding:"14px 18px", marginTop:8 }}>
        <div style={{ fontSize:10, fontWeight:700, color:theme.textDim, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>Criteria (6)</div>
        {CRITERIA.map(cr => (
          <div key={cr.id} style={{ display:"flex", alignItems:"flex-start", gap:7, marginBottom:7 }}>
            <span style={{ fontSize:9, fontWeight:700, color:theme.textDim, minWidth:16, marginTop:1 }}>#{cr.num}</span>
            <div>
              <div style={{ fontSize:11, color:theme.textMid, fontWeight:600 }}>{cr.short}</div>
              {!cr.auto && <div style={{ fontSize:9, color:theme.textDim }}>manual</div>}
            </div>
          </div>
        ))}
        <div style={{ marginTop:12, fontSize:11, color:theme.textDim, lineHeight:1.5, padding:"8px", background:theme.statBg, borderRadius:7, border:`1px solid ${theme.border}` }}>
          3+ criteria = Strong OTC prospect
        </div>
        <div style={{ marginTop:8, fontSize:10, color:theme.textDim, lineHeight:1.5, padding:"7px 8px", background:theme.statBg, borderRadius:7, border:`1px solid ${theme.border}` }}>
          Scan filter: MC ≥ $300M only
        </div>
      </div>
    </>
  );

  // ── table row ─────────────────────────────────────────────────────
  const renderRow = (coin, i, arr) => {
    const auto  = autoScore(coin);
    const score = totalScore(coin, manualChecks);
    const sl    = scoreLabel(score, dark);
    const sec   = sectorInfo(coin.sector);
    const isW   = watchMap.has(coin.id);
    const chg   = coin.change24h || 0;
    const volPct = coin.mc > 0 ? (coin.vol / coin.mc * 100).toFixed(1) + "%" : "—";
    return (
      <tr key={coin.id} onClick={() => setModalCoin(coin)}
        style={{ borderBottom:i < arr.length - 1 ? `1px solid ${theme.border}` : "none", cursor:"pointer", transition:"background 0.1s" }}
        onMouseEnter={e => e.currentTarget.style.background = theme.bgHov}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <td style={{ padding:"10px 12px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <img src={coin.image} alt="" width={28} height={28} style={{ borderRadius:"50%", flexShrink:0 }} onError={e => { e.target.style.display = "none"; }} />
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:theme.text, display:"flex", alignItems:"center", gap:5 }}>
                {coin.name}
                {coin.isNew && <span style={{ fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:4, background:dark?"#1a0808":"#fff5f5", color:"#ef4444", border:"1px solid #ef444430" }}>NEW</span>}
              </div>
              <div style={{ fontSize:10, color:theme.textDim, marginTop:1 }}>{coin.symbol} · #{coin.rank}</div>
            </div>
          </div>
        </td>
        <td style={{ padding:"10px 12px" }}>
          <span style={{ fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:4, background:coin.source==="CMC"?(dark?"#1a0a30":"#f5f3ff"):(dark?"#0a1a2e":"#eff6ff"), color:coin.source==="CMC"?"#8b5cf6":"#3b82f6" }}>
            {coin.source === "CMC" ? "CMC" : "CG"}
          </span>
        </td>
        <td style={{ padding:"10px 12px", fontSize:13, color:theme.text, fontWeight:500 }}>{fmtUSD(coin.mc)}</td>
        <td style={{ padding:"10px 12px", fontSize:13, color:theme.textMid }}>{fmtUSD(coin.vol)}</td>
        <td style={{ padding:"10px 12px", fontSize:12, color:theme.textDim }}>{volPct}</td>
        <td style={{ padding:"10px 12px", fontSize:13, fontWeight:700, color:chg >= 0 ? theme.green : theme.red }}>
          {(chg >= 0 ? "+" : "") + chg.toFixed(1) + "%"}
        </td>
        <td style={{ padding:"10px 12px" }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:sec.color+"18", color:sec.color, border:`1px solid ${sec.color}30`, borderRadius:5, padding:"2px 7px", fontSize:10, fontWeight:700 }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:sec.color }} />{sec.label}
          </span>
        </td>
        {/* Auto criteria dots — C1, C3, C6 */}
        <td style={{ padding:"10px 12px" }}>
          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            {[{id:"c1",met:auto.c1,title:"MC ≥ $300M"},{id:"c3",met:auto.c3,title:"Spot Vol > $50M"},{id:"c6",met:auto.c6,title:"CMC Top 200"}].map(({ id, met, title }) => (
              <div key={id} title={title} style={{ width:9, height:9, borderRadius:"50%", background:met ? theme.green : theme.border, transition:"background 0.2s" }} />
            ))}
          </div>
        </td>
        <td style={{ padding:"10px 12px" }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:sl.bg, color:sl.text, borderRadius:20, padding:"3px 10px", fontSize:10, fontWeight:700, whiteSpace:"nowrap" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:sl.dot }} />{sl.label} ({score}/6)
          </span>
        </td>
        <td style={{ padding:"10px 12px" }} onClick={e => e.stopPropagation()}>
          <button onClick={e => { e.stopPropagation(); toggleWatch(coin.id, coin); }}
            style={{ padding:"4px 10px", borderRadius:7, border:`1px solid ${isW ? theme.accent+"50" : theme.border}`, background:isW ? theme.accentBg : "transparent", color:isW ? theme.accentTxt : theme.textDim, fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit" }}>
            {isW ? "✓" : "Save"}
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div style={{ minHeight:"100vh", background:theme.bg, color:theme.text, fontFamily:"'DM Sans',system-ui,sans-serif", display:"flex", transition:"background 0.2s,color 0.2s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        @keyframes modalIn { from { opacity:0; transform:scale(0.93); } to { opacity:1; transform:scale(1); } }
        * { box-sizing:border-box; margin:0; padding:0; }
        button,select,input { font-family:inherit; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:#6366f140; border-radius:4px; }
        .d-side  { display:flex; }
        .m-side  { display:none; position:fixed; top:0; left:0; bottom:0; width:250px; z-index:50; overflow-y:auto; flex-direction:column; }
        .m-btn   { display:none; }
        .desk-tbl  { display:block; }
        .mob-cards { display:none; }
        @media(max-width:768px) { .d-side{display:none} .m-btn{display:flex!important} .m-side{display:flex} }
        @media(max-width:640px) { .desk-tbl{display:none!important} .mob-cards{display:block!important} }
      `}</style>

      {modalCoin && (
        <ProjectModal
          coin={modalCoin} dark={dark}
          onClose={() => setModalCoin(null)}
          isWatched={watchMap.has(modalCoin.id)}
          onToggleWatch={toggleWatch}
          manualChecks={manualChecks}
          onToggleManual={toggleManual}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="d-side" style={{ width:230, background:theme.bgSide, borderRight:`1px solid ${theme.border}`, flexDirection:"column", flexShrink:0, position:"sticky", top:0, height:"100vh", overflowY:"auto", transition:"background 0.2s" }}>
        <SidebarInner />
      </aside>

      {sideOpen && <div onClick={() => setSideOpen(false)} style={{ position:"fixed", inset:0, background:theme.overlay, zIndex:40 }} />}

      {/* Mobile drawer */}
      <aside className="m-side" style={{ background:theme.bgSide, borderRight:`1px solid ${theme.border}`, boxShadow:"2px 0 20px rgba(0,0,0,0.2)", transform:sideOpen ? "translateX(0)" : "translateX(-100%)", transition:"transform 0.25s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ display:"flex", justifyContent:"flex-end", padding:"12px 12px 0" }}>
          <button onClick={() => setSideOpen(false)} style={{ background:"transparent", border:"none", cursor:"pointer", color:theme.textMid, padding:6 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <SidebarInner />
      </aside>

      {/* Main */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        {/* Header */}
        <header style={{ background:theme.headerBg, borderBottom:`1px solid ${theme.border}`, padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, position:"sticky", top:0, zIndex:20, flexWrap:"wrap", transition:"background 0.2s" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button className="m-btn" onClick={() => setSideOpen(true)} style={{ background:"transparent", border:`1px solid ${theme.border}`, borderRadius:8, padding:"7px 9px", cursor:"pointer", color:theme.textMid, display:"none", alignItems:"center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
            <div>
              <h1 style={{ fontSize:17, fontWeight:700, color:theme.text, lineHeight:1.2 }}>{tabs.find(t => t.id === activeTab)?.label || "All"}</h1>
              <p style={{ fontSize:12, color:theme.textDim, marginTop:2 }}>{lastScan ? `Last scanned ${lastScan.toLocaleTimeString()}` : "Press Scan now to fetch live data"}</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <button onClick={() => setDark(d => !d)} style={{ width:36, height:36, borderRadius:8, border:`1px solid ${theme.border}`, background:theme.bgCard, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:theme.textMid, flexShrink:0 }}>
              {dark
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>
            {allCoins.length > 0 && (
              <button onClick={() => exportCSV(filtered, manualChecks)} style={{ padding:"7px 13px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", border:`1px solid ${theme.border}`, background:theme.bgCard, color:theme.textMid, display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Export CSV
              </button>
            )}
            <button onClick={scan} disabled={scanning} style={{ padding:"8px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:scanning ? "not-allowed" : "pointer", border:"none", background:scanning ? (dark?"#1a1a35":"#e0e7ff") : "linear-gradient(135deg,#6366f1,#8b5cf6)", color:scanning ? theme.accent : "#fff", display:"flex", alignItems:"center", gap:7, whiteSpace:"nowrap", boxShadow:scanning ? "none" : "0 2px 8px #6366f140" }}>
              {scanning ? <><Spinner />{progress || "Scanning…"}</> : "Scan now"}
            </button>
          </div>
        </header>

        <div style={{ padding:"20px", flex:1 }}>
          {errors.length > 0 && (
            <div style={{ background:theme.redBg, border:`1px solid ${theme.red}30`, borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:12, color:theme.redText }}>
              <strong>Notices:</strong> {errors.join(" · ")}
            </div>
          )}

          {/* Stat cards */}
          {allCoins.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:20, animation:"fadeUp 0.3s ease" }}>
              {[
                { label:"Total scanned", value:allCoins.length,    sub:"MC ≥ $300M",       accent:"#6366f1" },
                { label:"Strong OTC",    value:strongCount,         sub:"3+ criteria met",  accent:"#22c55e" },
                { label:"New listings",  value:allCoins.filter(c=>c.isNew).length, sub:"last 30 days", accent:"#ef4444" },
                { label:"Watchlist",     value:watchCoins.length,   sub:"saved projects",   accent:"#f59e0b" },
              ].map(s => (
                <div key={s.label} style={{ background:theme.bgCard, border:`1px solid ${theme.border}`, borderRadius:10, padding:"14px 16px", borderTop:`3px solid ${s.accent}`, transition:"background 0.2s" }}>
                  <div style={{ fontSize:10, fontWeight:700, color:theme.textDim, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>{s.label}</div>
                  <div style={{ fontSize:24, fontWeight:700, color:theme.text, lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:11, color:theme.textDim, marginTop:4 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* Controls */}
          {(filtered.length > 0 || allCoins.length > 0) && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              {activeTab !== "watch" && (
                <>
                  <span style={{ fontSize:12, color:theme.textDim }}>Sort</span>
                  <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(0); }} style={{ background:theme.bgCard, border:`1px solid ${theme.border}`, borderRadius:7, padding:"6px 10px", fontSize:12, color:theme.textMid, cursor:"pointer" }}>
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <span style={{ fontSize:12, color:theme.textDim }}>Min score</span>
                  <select value={filterMin} onChange={e => { setFilterMin(Number(e.target.value)); setPage(0); }} style={{ background:theme.bgCard, border:`1px solid ${theme.border}`, borderRadius:7, padding:"6px 10px", fontSize:12, color:theme.textMid, cursor:"pointer" }}>
                    <option value={0}>Any</option>
                    <option value={1}>1+</option>
                    <option value={2}>2+</option>
                    <option value={3}>3+ (Strong)</option>
                    <option value={4}>4+</option>
                    <option value={5}>5+</option>
                  </select>
                </>
              )}
              <span style={{ fontSize:11, color:theme.textDim }}>· Click row for details</span>
              <span style={{ marginLeft:"auto", fontSize:12, color:theme.textDim }}>
                {Math.min(pageStart + 1, filtered.length)}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              {activeTab === "watch" && watchCoins.length > 0 && (
                <button onClick={clearWatchlist} style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${theme.red}30`, background:theme.redBg, color:theme.red, fontSize:12, cursor:"pointer", fontWeight:600 }}>Clear watchlist</button>
              )}
              {activeTab !== "watch" && allCoins.length > 0 && (
                <button onClick={clearScan} style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${theme.border}`, background:"transparent", color:theme.textMid, fontSize:12, cursor:"pointer", fontWeight:600 }}>Clear scan</button>
              )}
            </div>
          )}

          {/* Empty state */}
          {!scanning && allCoins.length === 0 && activeTab !== "watch" && (
            <div style={{ textAlign:"center", padding:"80px 20px", animation:"fadeUp 0.3s ease" }}>
              <div style={{ width:56, height:56, borderRadius:14, background:theme.accentBg, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={theme.accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ fontSize:16, fontWeight:600, color:theme.text, marginBottom:8 }}>Ready to scan</div>
              <div style={{ fontSize:13, color:theme.textDim, maxWidth:380, margin:"0 auto", lineHeight:1.7 }}>
                Click <strong style={{ color:theme.accent }}>Scan now</strong> to fetch projects with MC ≥ $300M across 5 sectors from CoinGecko + CMC and score them against all 6 OTC criteria.
              </div>
            </div>
          )}

          {activeTab === "watch" && watchCoins.length === 0 && (
            <div style={{ textAlign:"center", padding:"60px 0", color:theme.textDim, fontSize:13 }}>No saved projects — click any row then Save to Watchlist.</div>
          )}

          {/* Desktop table */}
          {visible.length > 0 && (
            <div className="desk-tbl" style={{ background:theme.bgCard, border:`1px solid ${theme.border}`, borderRadius:12, overflow:"hidden", animation:"fadeUp 0.25s ease" }}>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", minWidth:860 }}>
                  <thead>
                    <tr style={{ background:theme.statBg, borderBottom:`1px solid ${theme.border}` }}>
                      {["Project","Src","Market Cap","Volume (24h)","Vol/MC","24h %","Sector","Auto ✓","OTC Score",""].map(h => (
                        <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontSize:10, fontWeight:700, color:theme.textDim, letterSpacing:"0.06em", textTransform:"uppercase", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>{visible.map((coin, i) => renderRow(coin, i, visible))}</tbody>
                </table>
              </div>
              <div style={{ padding:"12px 16px", borderTop:`1px solid ${theme.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                <span style={{ fontSize:12, color:theme.textDim }}>Showing {Math.min(pageStart + 1, filtered.length)}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                <div style={{ display:"flex", gap:8 }}>
                  {page > 0 && <button onClick={() => setPage(p => p - 1)} style={{ padding:"6px 14px", borderRadius:7, border:`1px solid ${theme.border}`, background:"transparent", color:theme.textMid, fontSize:12, fontWeight:600, cursor:"pointer" }}>← Prev</button>}
                  {hasMore && <button onClick={() => setPage(p => p + 1)} style={{ padding:"6px 14px", borderRadius:7, border:"none", background:theme.accent, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", boxShadow:"0 2px 6px #6366f130" }}>Next →</button>}
                </div>
              </div>
            </div>
          )}

          {/* Mobile cards */}
          {visible.length > 0 && (
            <div className="mob-cards">
              {visible.map(coin => {
                const score = totalScore(coin, manualChecks);
                const sl    = scoreLabel(score, dark);
                const sec   = sectorInfo(coin.sector);
                const isW   = watchMap.has(coin.id);
                const chg   = coin.change24h || 0;
                const auto  = autoScore(coin);
                return (
                  <div key={coin.id} onClick={() => setModalCoin(coin)} style={{ background:theme.bgCard, border:`1px solid ${theme.border}`, borderRadius:10, padding:14, marginBottom:10, cursor:"pointer", transition:"border-color 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = theme.accent + "60"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                        <img src={coin.image} alt="" width={32} height={32} style={{ borderRadius:"50%" }} onError={e => { e.target.style.display = "none"; }} />
                        <div>
                          <div style={{ fontSize:14, fontWeight:700, color:theme.text }}>{coin.name} {coin.isNew && <span style={{ fontSize:9, padding:"1px 5px", borderRadius:4, background:"#fff5f5", color:"#ef4444", border:"1px solid #ef444430" }}>NEW</span>}</div>
                          <div style={{ fontSize:10, color:theme.textDim }}>{coin.symbol} · #{coin.rank}</div>
                        </div>
                      </div>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:sl.bg, color:sl.text, borderRadius:20, padding:"3px 9px", fontSize:10, fontWeight:700 }}>
                        <span style={{ width:5, height:5, borderRadius:"50%", background:sl.dot }} />{sl.label}
                      </span>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                      {[["Market Cap",fmtUSD(coin.mc)],["Volume",fmtUSD(coin.vol)],["24h %",(chg>=0?"+":"")+chg.toFixed(1)+"%",chg>=0?theme.green:theme.red],["Rank","#"+coin.rank]].map(([k,v,c]) => (
                        <div key={k} style={{ background:theme.statBg, borderRadius:7, padding:"8px 10px" }}>
                          <div style={{ fontSize:10, color:theme.textDim, marginBottom:3 }}>{k}</div>
                          <div style={{ fontSize:13, fontWeight:600, color:c || theme.text }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:sec.color+"18", color:sec.color, border:`1px solid ${sec.color}30`, borderRadius:5, padding:"2px 6px", fontSize:10, fontWeight:700 }}>
                          <span style={{ width:5, height:5, borderRadius:"50%", background:sec.color }} />{sec.label}
                        </span>
                        <div style={{ display:"flex", gap:3 }}>
                          {[{id:"c1",met:auto.c1},{id:"c3",met:auto.c3},{id:"c6",met:auto.c6}].map(({ id, met }) => (
                            <div key={id} style={{ width:7, height:7, borderRadius:"50%", background:met ? theme.green : theme.border }} />
                          ))}
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); toggleWatch(coin.id, coin); }} style={{ padding:"5px 10px", borderRadius:7, border:`1px solid ${isW ? theme.accent+"50" : theme.border}`, background:isW ? theme.accentBg : "transparent", color:isW ? theme.accentTxt : theme.textDim, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                        {isW ? "✓ Saved" : "Save"}
                      </button>
                    </div>
                  </div>
                );
              })}
              <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:12 }}>
                {page > 0 && <button onClick={() => setPage(p => p - 1)} style={{ padding:"8px 18px", borderRadius:8, border:`1px solid ${theme.border}`, background:"transparent", color:theme.textMid, fontSize:13, fontWeight:600, cursor:"pointer" }}>← Prev</button>}
                {hasMore && <button onClick={() => setPage(p => p + 1)} style={{ padding:"8px 18px", borderRadius:8, border:"none", background:theme.accent, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>Next →</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
