import { useState, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════
//  ✏️  PASTE YOUR API KEYS HERE — then save the file
// ═══════════════════════════════════════════════════════════════════
const CONFIG = {
  COINGECKO_KEY: "CG-9Kwdxg3gFF4btQXSQRxbqfV9",   // free at coingecko.com/en/api
  CMC_KEY:       "ac8d270e35bc41428ab1d5705d688bf5",          // free at pro.coinmarketcap.com
};
// ═══════════════════════════════════════════════════════════════════

const MIN_MC    = 1_000_000;
const MAX_MC    = 10_000_000;
const MIN_VOL   = 400_000;
const PAGE_SIZE = 10;

const CG_CATS = [
  { id:"defi",  label:"DeFi",           cgId:"decentralized-finance-defi", color:"#6366f1" },
  { id:"ai",    label:"AI + Crypto",    cgId:"artificial-intelligence",    color:"#10b981" },
  { id:"meme",  label:"Memes",          cgId:"meme-token",                 color:"#f59e0b" },
  { id:"infra", label:"Infrastructure", cgId:"infrastructure",             color:"#8b5cf6" },
];

const SORT_OPTIONS = [
  { value:"otc",     label:"OTC Score"    },
  { value:"mc_asc",  label:"Market Cap ↑" },
  { value:"mc_desc", label:"Market Cap ↓" },
  { value:"vol",     label:"Volume ↓"     },
  { value:"change",  label:"24h Change"   },
];

// ── theme ──────────────────────────────────────────────────────────
function T(dark) {
  return dark ? {
    bg:"#0f0f1a", bgSide:"#0a0a14", bgCard:"#13131f", bgHov:"#1a1a2e",
    bgInput:"#0a0a14", border:"#1e1e35", borderMid:"#2a2a45",
    text:"#e8e8ff", textMid:"#9090c0", textDim:"#4a4a6a",
    accent:"#6366f1", accentBg:"#6366f115", accentTxt:"#a5b4fc",
    navAct:"#6366f118", navActTxt:"#a5b4fc",
    statBg:"#0d0d1a", headerBg:"#0a0a14",
    shadow:"0 1px 3px rgba(0,0,0,0.5)", overlay:"rgba(0,0,0,0.75)",
    modalBg:"#13131f",
  } : {
    bg:"#f5f5f8", bgSide:"#ffffff", bgCard:"#ffffff", bgHov:"#f9f9fc",
    bgInput:"#ffffff", border:"#e8e8f0", borderMid:"#d0d0e0",
    text:"#111827", textMid:"#6b7280", textDim:"#9ca3af",
    accent:"#6366f1", accentBg:"#6366f110", accentTxt:"#6366f1",
    navAct:"#6366f110", navActTxt:"#6366f1",
    statBg:"#f9f9fc", headerBg:"#ffffff",
    shadow:"0 1px 3px rgba(0,0,0,0.07)", overlay:"rgba(0,0,0,0.5)",
    modalBg:"#ffffff",
  };
}

// ── helpers ────────────────────────────────────────────────────────
const fmtUSD = n => {
  if (!n && n!==0) return "—";
  if (n>=1e9) return "$"+(n/1e9).toFixed(2)+"B";
  if (n>=1e6) return "$"+(n/1e6).toFixed(2)+"M";
  if (n>=1e3) return "$"+(n/1e3).toFixed(1)+"K";
  return "$"+n.toFixed(4);
};
const fmtPrice = n => {
  if (!n&&n!==0) return "—";
  if (n>=1)    return "$"+n.toFixed(3);
  if (n>=0.01) return "$"+n.toFixed(4);
  return "$"+n.toExponential(2);
};
function otcScore(mc,vol) {
  let s=0;
  if (mc>=MIN_MC&&mc<=MAX_MC)         s+=3;
  if (vol>=MIN_VOL)                   s+=1;
  if (vol>0&&mc>0&&vol/mc<0.1)       s+=1;
  if (mc<5_000_000)                  s+=1;
  return Math.min(s,6);
}
function scoreInfo(s,dark) {
  if (s>=5) return {label:"Strong",bg:dark?"#052e16":"#dcfce7",text:dark?"#4ade80":"#166534",dot:"#22c55e"};
  if (s>=3) return {label:"Good",  bg:dark?"#1c1400":"#fef9c3",text:dark?"#fbbf24":"#854d0e",dot:"#f59e0b"};
  return          {label:"Weak",  bg:dark?"#1a1a2e":"#f3f4f6", text:dark?"#6b7280":"#6b7280",dot:"#9ca3af"};
}
function catInfo(id) { return CG_CATS.find(c=>c.id===id)||{label:id,color:"#6366f1"}; }

function projectURL(coin) {
  if (coin.source === "CMC") {
    return `https://coinmarketcap.com/currencies/${coin.name.toLowerCase().replace(/\s+/g,"-")}/`;
  }
  return `https://www.coingecko.com/en/coins/${coin.rawId}`;
}

// ── API ────────────────────────────────────────────────────────────
async function fetchCG(cat) {
  const res = await fetch(
    `/cg-api/api/v3/coins/markets` +
    `?vs_currency=usd&category=${cat.cgId}` +
    `&order=market_cap_asc&per_page=250&page=1` +
    `&sparkline=false&price_change_percentage=24h`,
    { headers: { "x-cg-demo-api-key": CONFIG.COINGECKO_KEY, Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(res.status===429?"Rate limited (wait 60s)":`CG ${res.status}`);
  const data = await res.json();
  return data
    .filter(c=>c.market_cap>=MIN_MC&&c.market_cap<=MAX_MC&&(c.total_volume||0)>=MIN_VOL)
    .map(c=>({
      id:"cg_"+c.id, rawId:c.id,
      name:c.name, symbol:(c.symbol||"").toUpperCase(),
      image:c.image, mc:c.market_cap, price:c.current_price,
      vol:c.total_volume, change24h:c.price_change_percentage_24h,
      cat:cat.id, source:"CoinGecko", isNew:false,
    }));
}

async function fetchCMC() {
  const res = await fetch(
    `/cmc-api/v1/cryptocurrency/listings/latest` +
    `?limit=500&convert=USD&sort=date_added&sort_dir=desc`,
    { headers: { "X-CMC_PRO_API_KEY": CONFIG.CMC_KEY, Accept: "application/json" } }
  );
  if (!res.ok) {
    const e=await res.json().catch(()=>({}));
    throw new Error(e?.status?.error_message||`CMC ${res.status}`);
  }
  const data=await res.json();
  const now=Date.now();
  return (data.data||[])
    .filter(c=>{
      const mc=c.quote?.USD?.market_cap||0,vol=c.quote?.USD?.volume_24h||0;
      return mc>=MIN_MC&&mc<=MAX_MC&&vol>=MIN_VOL;
    })
    .map(c=>{
      const q=c.quote?.USD||{};
      const ageDays=(now-new Date(c.date_added).getTime())/86400000;
      return {
        id:"cmc_"+c.id, rawId:String(c.id),
        name:c.name, symbol:c.symbol,
        image:`https://s2.coinmarketcap.com/static/img/coins/64x64/${c.id}.png`,
        mc:q.market_cap||0, price:q.price||0, vol:q.volume_24h||0,
        change24h:q.percent_change_24h||0,
        cat:guessCat(c.tags||[]), source:"CMC",
        isNew:ageDays<=30, dateAdded:c.date_added,
      };
    });
}

function guessCat(tags) {
  const t=tags.map(x=>x.toLowerCase()).join(" ");
  if (t.includes("defi")||t.includes("dex")||t.includes("lending")) return "defi";
  if (t.includes("ai")||t.includes("artificial"))                    return "ai";
  if (t.includes("meme")||t.includes("dog")||t.includes("cat"))     return "meme";
  if (t.includes("layer")||t.includes("infra")||t.includes("oracle"))return "infra";
  return "other";
}

function exportCSV(coins) {
  const h=["Name","Symbol","Category","Source","Market Cap","Price","24h %","Volume","OTC Score","New?"];
  const r=coins.map(c=>[`"${c.name}"`,c.symbol,catInfo(c.cat).label,c.source,c.mc.toFixed(0),c.price,(c.change24h||0).toFixed(2),c.vol.toFixed(0),otcScore(c.mc,c.vol),c.isNew?"YES":""].join(","));
  const blob=new Blob([[h.join(","),...r].join("\n")],{type:"text/csv"});
  Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:"otc-scan.csv"}).click();
}

function Spinner() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{animation:"spin 0.8s linear infinite",flexShrink:0}}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>;
}

// ── Project Modal ──────────────────────────────────────────────────
function ProjectModal({ coin, dark, onClose, onToggleWatch, isWatched }) {
  const theme = T(dark);
  const sc  = otcScore(coin.mc, coin.vol);
  const si  = scoreInfo(sc, dark);
  const cat = catInfo(coin.cat);
  const chg = coin.change24h || 0;
  const vr  = coin.mc > 0 ? ((coin.vol / coin.mc) * 100).toFixed(1) : "—";
  const url = projectURL(coin);
  const isCMC = coin.source === "CMC";

  return (
    <div
      onClick={onClose}
      style={{position:"fixed",inset:0,background:theme.overlay,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
    >
      <div
        onClick={e=>e.stopPropagation()}
        style={{
          background:theme.modalBg,
          border:`1px solid ${theme.border}`,
          borderRadius:16,
          width:"100%",
          maxWidth:420,
          boxShadow:"0 25px 60px rgba(0,0,0,0.3)",
          animation:"modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",
          overflow:"hidden",
        }}
      >
        {/* Modal header */}
        <div style={{
          background: `linear-gradient(135deg, ${cat.color}22, ${cat.color}08)`,
          borderBottom:`1px solid ${theme.border}`,
          padding:"20px 20px 16px",
          display:"flex",alignItems:"flex-start",justifyContent:"space-between",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <img
              src={coin.image} alt={coin.name}
              width={52} height={52}
              style={{borderRadius:"50%",border:`2px solid ${cat.color}40`,flexShrink:0}}
              onError={e=>{e.target.style.display="none";}}
            />
            <div>
              <div style={{fontSize:18,fontWeight:700,color:theme.text,display:"flex",alignItems:"center",gap:7}}>
                {coin.name}
                {coin.isNew&&<span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,background:dark?"#1a0808":"#fff5f5",color:"#ef4444",border:"1px solid #ef444430",animation:"pulse 2s infinite"}}>NEW</span>}
              </div>
              <div style={{fontSize:13,color:theme.textDim,marginTop:3,display:"flex",alignItems:"center",gap:6}}>
                <span>{coin.symbol}</span>
                <span style={{width:3,height:3,borderRadius:"50%",background:theme.textDim}}/>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:isCMC?(dark?"#1a0a30":"#f5f3ff"):(dark?"#0a1a2e":"#eff6ff"),color:isCMC?"#8b5cf6":"#3b82f6",border:`1px solid ${isCMC?"#8b5cf630":"#3b82f630"}`}}>
                  {isCMC?"CMC":"CoinGecko"}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",cursor:"pointer",color:theme.textDim,padding:4,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* OTC Score bar */}
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${theme.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:11,fontWeight:700,color:theme.textDim,textTransform:"uppercase",letterSpacing:"0.07em"}}>OTC Score</div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{display:"flex",gap:4}}>
              {[1,2,3,4,5,6].map(i=>(
                <div key={i} style={{width:22,height:6,borderRadius:3,background:i<=sc?si.dot:theme.border,transition:"background 0.2s"}}/>
              ))}
            </div>
            <span style={{display:"inline-flex",alignItems:"center",gap:5,background:si.bg,color:si.text,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:si.dot}}/>{si.label} {sc}/6
            </span>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{padding:"16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            {label:"Market Cap",     value:fmtUSD(coin.mc),                                           },
            {label:"Price",          value:fmtPrice(coin.price),                                      },
            {label:"24h Change",     value:(chg>=0?"+":"")+chg.toFixed(2)+"%", color:chg>=0?"#22c55e":"#ef4444"},
            {label:"Volume (24h)",   value:fmtUSD(coin.vol),                                          },
            {label:"Vol / MC Ratio", value:vr!=="—"?vr+"%":"—",                                       },
            {label:"Category",       value:cat.label,                           color:cat.color        },
          ].map(row=>(
            <div key={row.label} style={{background:theme.statBg,borderRadius:9,padding:"12px 14px",border:`1px solid ${theme.border}`}}>
              <div style={{fontSize:10,color:theme.textDim,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>{row.label}</div>
              <div style={{fontSize:15,fontWeight:700,color:row.color||theme.text}}>{row.value}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{padding:"0 20px 20px",display:"flex",gap:8,flexDirection:"column"}}>
          {/* View on source button */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              padding:"11px 16px",borderRadius:9,
              background:isCMC?"linear-gradient(135deg,#3b48ff,#6366f1)":"linear-gradient(135deg,#2ec97b,#10b981)",
              color:"#fff",fontSize:13,fontWeight:700,
              textDecoration:"none",transition:"opacity 0.15s",
            }}
            onMouseEnter={e=>e.currentTarget.style.opacity="0.88"}
            onMouseLeave={e=>e.currentTarget.style.opacity="1"}
          >
            {isCMC
              ? <><CmcIcon/>View on CoinMarketCap</>
              : <><CgIcon/>View on CoinGecko</>
            }
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{marginLeft:2}}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>

          {/* Save to watchlist */}
          <button
            onClick={()=>onToggleWatch(coin.id)}
            style={{
              display:"flex",alignItems:"center",justifyContent:"center",gap:7,
              padding:"10px 16px",borderRadius:9,
              border:`1px solid ${isWatched?theme.accent+"60":theme.border}`,
              background:isWatched?theme.accentBg:"transparent",
              color:isWatched?theme.accentTxt:theme.textMid,
              fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              transition:"all 0.15s",
            }}
          >
            {isWatched?"✓ Saved to Watchlist":"Save to Watchlist"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CmcIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>;
}
function CgIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-1-5h2V7h-2v8zm0 4h2v-2h-2v2z"/></svg>;
}

// ── main app ───────────────────────────────────────────────────────
export default function App() {
  const [dark,       setDark]       = useState(false);
  const [sideOpen,   setSideOpen]   = useState(false);
  const [allCoins,   setAllCoins]   = useState([]);
  const [page,       setPage]       = useState(0);
  const [watchlist,  setWatchlist]  = useState(new Set());
  const [activeTab,  setActiveTab]  = useState("all");
  const [sortBy,     setSortBy]     = useState("otc");
  const [scanning,   setScanning]   = useState(false);
  const [progress,   setProgress]   = useState("");
  const [errors,     setErrors]     = useState([]);
  const [lastScan,   setLastScan]   = useState(null);
  const [newAlerts,  setNewAlerts]  = useState([]);
  const [modalCoin,  setModalCoin]  = useState(null);
  const theme = T(dark);

  const keysSet =
    CONFIG.COINGECKO_KEY !== "YOUR_COINGECKO_KEY_HERE" &&
    CONFIG.CMC_KEY       !== "YOUR_CMC_KEY_HERE";

  const scan = useCallback(async () => {
    if (scanning) return;
    setScanning(true); setErrors([]); setNewAlerts([]); setAllCoins([]);
    const fetched=[], errs=[];

    for (let i=0;i<CG_CATS.length;i++) {
      const cat=CG_CATS[i];
      setProgress(`CoinGecko: ${cat.label} (${i+1}/${CG_CATS.length})`);
      if (i>0) await new Promise(r=>setTimeout(r,1500));
      try   { fetched.push(...await fetchCG(cat)); }
      catch(e) { errs.push(`CG/${cat.label}: ${e.message}`); }
    }

    const cgSyms=new Set(fetched.map(c=>c.symbol.toUpperCase()));

    if (CONFIG.CMC_KEY!=="YOUR_CMC_KEY_HERE") {
      setProgress("CMC: fetching listings…");
      await new Promise(r=>setTimeout(r,800));
      try {
        const cmcCoins=await fetchCMC();
        const newOnes=[];
        for (const c of cmcCoins) {
          if (cgSyms.has(c.symbol.toUpperCase())) continue;
          fetched.push(c);
          if (c.isNew) newOnes.push(c);
        }
        if (newOnes.length) setNewAlerts(newOnes.slice(0,10));
      } catch(e) { errs.push(`CMC: ${e.message}`); }
    }

    const seen=new Set();
    setAllCoins(fetched.filter(c=>{if(seen.has(c.rawId))return false;seen.add(c.rawId);return true;}));
    setPage(0); setErrors(errs); setLastScan(new Date());
    setProgress(""); setScanning(false);
  },[scanning]);

  const tabs=[
    {id:"all",   label:"All projects",   count:allCoins.length},
    {id:"defi",  label:"DeFi",           count:allCoins.filter(c=>c.cat==="defi").length,  color:"#6366f1"},
    {id:"ai",    label:"AI + Crypto",    count:allCoins.filter(c=>c.cat==="ai").length,    color:"#10b981"},
    {id:"meme",  label:"Memes",          count:allCoins.filter(c=>c.cat==="meme").length,  color:"#f59e0b"},
    {id:"infra", label:"Infrastructure", count:allCoins.filter(c=>c.cat==="infra").length, color:"#8b5cf6"},
    {id:"new",   label:"New Listings",   count:allCoins.filter(c=>c.isNew).length,         color:"#ef4444"},
    {id:"watch", label:"Watchlist",      count:watchlist.size},
  ];

  const filtered=(() => {
    let list=activeTab==="watch"?allCoins.filter(c=>watchlist.has(c.id)):activeTab==="new"?allCoins.filter(c=>c.isNew):activeTab==="all"?allCoins:allCoins.filter(c=>c.cat===activeTab);
    return [...list].sort((a,b)=>{
      if(sortBy==="otc")     return otcScore(b.mc,b.vol)-otcScore(a.mc,a.vol);
      if(sortBy==="mc_asc")  return a.mc-b.mc;
      if(sortBy==="mc_desc") return b.mc-a.mc;
      if(sortBy==="vol")     return b.vol-a.vol;
      if(sortBy==="change")  return (b.change24h||0)-(a.change24h||0);
      return 0;
    });
  })();

  const pageStart=page*PAGE_SIZE;
  const visible=filtered.slice(pageStart,pageStart+PAGE_SIZE);
  const hasMore=pageStart+PAGE_SIZE<filtered.length;
  const toggleWatch=id=>setWatchlist(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  const selectTab=id=>{setActiveTab(id);setPage(0);setSideOpen(false);};

  const SidebarInner=()=>(
    <>
      <div style={{padding:"20px 18px 14px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:theme.text}}>OTC Scanner</div>
          <div style={{fontSize:11,color:theme.textDim,marginTop:1}}>Web3 Deal Flow</div>
        </div>
      </div>
      <div style={{padding:"0 10px",flex:1}}>
        <div style={{fontSize:10,fontWeight:700,color:theme.textDim,letterSpacing:"0.1em",textTransform:"uppercase",padding:"6px 8px 8px"}}>Categories</div>
        {tabs.map(t=>{
          const active=activeTab===t.id;
          return(
            <button key={t.id} onClick={()=>selectTab(t.id)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 10px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",background:active?theme.navAct:"transparent",color:active?theme.navActTxt:theme.textMid,fontSize:14,fontWeight:active?600:400,marginBottom:2,transition:"all 0.12s",textAlign:"left"}}>
              <span style={{display:"flex",alignItems:"center",gap:8}}>
                {t.color&&<span style={{width:7,height:7,borderRadius:"50%",background:active?t.color:theme.borderMid,flexShrink:0}}/>}
                {t.label}
              </span>
              {t.count>0&&<span style={{background:active?theme.accent:theme.border,color:active?"#fff":theme.textDim,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20,minWidth:22,textAlign:"center"}}>{t.count}</span>}
            </button>
          );
        })}
      </div>
      <div style={{borderTop:`1px solid ${theme.border}`,padding:"14px 18px",marginTop:8}}>
        <div style={{fontSize:10,fontWeight:700,color:theme.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Active Filters</div>
        {[["Market cap","$1M – $10M"],["Min 24h vol","≥ $400K"],["Categories","4 active"]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
            <span style={{fontSize:12,color:theme.textDim}}>{k}</span>
            <span style={{fontSize:12,fontWeight:600,color:theme.textMid}}>{v}</span>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div style={{minHeight:"100vh",background:theme.bg,color:theme.text,fontFamily:"'DM Sans',system-ui,sans-serif",display:"flex",transition:"background 0.2s,color 0.2s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin    {to{transform:rotate(360deg)}}
        @keyframes pulse   {0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes fadeUp  {from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes modalIn {from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
        *{box-sizing:border-box;margin:0;padding:0}
        button,select,input{font-family:inherit}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#6366f140;border-radius:4px}
        .d-side{display:flex}
        .m-side{display:none;position:fixed;top:0;left:0;bottom:0;width:240px;z-index:50;overflow-y:auto;flex-direction:column}
        .m-btn{display:none}
        .desk-tbl{display:block}
        .mob-cards{display:none}
        .row-click{cursor:pointer}
        .row-click:hover td{background:inherit}
        @media(max-width:768px){.d-side{display:none}.m-btn{display:flex!important}.m-side{display:flex}}
        @media(max-width:640px){.desk-tbl{display:none!important}.mob-cards{display:block!important}}
      `}</style>

      {/* Modal */}
      {modalCoin && (
        <ProjectModal
          coin={modalCoin}
          dark={dark}
          onClose={()=>setModalCoin(null)}
          onToggleWatch={toggleWatch}
          isWatched={watchlist.has(modalCoin.id)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="d-side" style={{width:220,background:theme.bgSide,borderRight:`1px solid ${theme.border}`,flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh",overflowY:"auto",transition:"background 0.2s"}}>
        <SidebarInner/>
      </aside>

      {/* Mobile overlay */}
      {sideOpen&&<div onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:theme.overlay,zIndex:40}}/>}

      {/* Mobile drawer */}
      <aside className="m-side" style={{background:theme.bgSide,borderRight:`1px solid ${theme.border}`,boxShadow:"2px 0 20px rgba(0,0,0,0.15)",transform:sideOpen?"translateX(0)":"translateX(-100%)",transition:"transform 0.25s cubic-bezier(0.4,0,0.2,1)"}}>
        <div style={{display:"flex",justifyContent:"flex-end",padding:"12px 12px 0"}}>
          <button onClick={()=>setSideOpen(false)} style={{background:"transparent",border:"none",cursor:"pointer",color:theme.textMid,padding:6}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        <SidebarInner/>
      </aside>

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <header style={{background:theme.headerBg,borderBottom:`1px solid ${theme.border}`,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,position:"sticky",top:0,zIndex:20,flexWrap:"wrap",transition:"background 0.2s"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button className="m-btn" onClick={()=>setSideOpen(true)} style={{background:"transparent",border:`1px solid ${theme.border}`,borderRadius:8,padding:"7px 9px",cursor:"pointer",color:theme.textMid,display:"none",alignItems:"center"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <div>
              <h1 style={{fontSize:17,fontWeight:700,color:theme.text,lineHeight:1.2}}>{tabs.find(t=>t.id===activeTab)?.label||"All projects"}</h1>
              <p style={{fontSize:12,color:theme.textDim,marginTop:2}}>{lastScan?`Last scanned ${lastScan.toLocaleTimeString()}`:"Press Scan now to fetch live data"}</p>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={()=>setDark(d=>!d)} title="Toggle theme" style={{width:36,height:36,borderRadius:8,border:`1px solid ${theme.border}`,background:theme.bgCard,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:theme.textMid,flexShrink:0}}>
              {dark
                ?<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                :<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>
            {allCoins.length>0&&(
              <button onClick={()=>exportCSV(visible)} style={{padding:"7px 13px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",border:`1px solid ${theme.border}`,background:theme.bgCard,color:theme.textMid,display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Export CSV
              </button>
            )}
            <button onClick={scan} disabled={scanning} style={{padding:"8px 20px",borderRadius:8,fontSize:13,fontWeight:700,cursor:scanning?"not-allowed":"pointer",border:"none",background:scanning?(dark?"#1a1a35":"#e0e7ff"):"linear-gradient(135deg,#6366f1,#8b5cf6)",color:scanning?theme.accent:"#fff",display:"flex",alignItems:"center",gap:7,whiteSpace:"nowrap",boxShadow:scanning?"none":"0 2px 8px #6366f140"}}>
              {scanning?<><Spinner/>{progress||"Scanning…"}</>:"Scan now"}
            </button>
          </div>
        </header>

        <div style={{padding:"20px",flex:1}}>
          {!keysSet&&(
            <div style={{background:dark?"#1c1400":"#fffbeb",border:"1px solid #f59e0b50",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:12,color:dark?"#fbbf24":"#92400e"}}>
              <strong>⚠ API keys not set.</strong> Open <code style={{background:dark?"#0a0a14":"#fef3c7",padding:"1px 5px",borderRadius:4}}>src/App.jsx</code> and replace the placeholder text in the CONFIG block at the top with your actual keys.
            </div>
          )}

          {errors.length>0&&(
            <div style={{background:dark?"#1a0808":"#fef2f2",border:`1px solid ${dark?"#7f1d1d50":"#fecaca"}`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:dark?"#fca5a5":"#991b1b"}}>
              <strong>Notices:</strong> {errors.join(" · ")}
            </div>
          )}

          {newAlerts.length>0&&(
            <div style={{background:dark?"#1a0808":"#fff5f5",border:"1px solid #ef444430",borderRadius:10,padding:"14px 16px",marginBottom:16,animation:"fadeUp 0.3s ease"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#ef4444",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:"#ef4444",animation:"pulse 1.5s infinite",flexShrink:0}}/>
                {newAlerts.length} NEW LISTING{newAlerts.length>1?"S":""} meet your OTC criteria (last 30 days)
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {newAlerts.map(c=>(
                  <span key={c.id} onClick={()=>setModalCoin(c)} style={{background:dark?"#0a0a14":"#fff",border:"1px solid #ef444430",borderRadius:6,padding:"3px 10px",fontSize:12,color:dark?"#fca5a5":"#dc2626",fontWeight:600,cursor:"pointer"}}>
                    {c.name} <span style={{opacity:.7,fontSize:10}}>{c.symbol}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {allCoins.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:20,animation:"fadeUp 0.3s ease"}}>
              {[
                {label:"Total found",  value:allCoins.length,                                        sub:"after all filters", accent:"#6366f1"},
                {label:"Strong OTC",   value:allCoins.filter(c=>otcScore(c.mc,c.vol)>=5).length,     sub:"score 5–6 / 6",    accent:"#22c55e"},
                {label:"New listings", value:allCoins.filter(c=>c.isNew).length,                     sub:"last 30 days",     accent:"#ef4444"},
                {label:"Watchlist",    value:watchlist.size,                                          sub:"saved projects",   accent:"#f59e0b"},
              ].map(s=>(
                <div key={s.label} style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:10,padding:"14px 16px",borderTop:`3px solid ${s.accent}`,transition:"background 0.2s"}}>
                  <div style={{fontSize:10,fontWeight:700,color:theme.textDim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{s.label}</div>
                  <div style={{fontSize:24,fontWeight:700,color:theme.text,lineHeight:1}}>{s.value}</div>
                  <div style={{fontSize:11,color:theme.textDim,marginTop:4}}>{s.sub}</div>
                </div>
              ))}
            </div>
          )}

          {filtered.length>0&&(
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:theme.textDim}}>Sort by</span>
              <select value={sortBy} onChange={e=>{setSortBy(e.target.value);setPage(0);}} style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:7,padding:"6px 10px",fontSize:12,color:theme.textMid,cursor:"pointer"}}>
                {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span style={{fontSize:11,color:theme.textDim,marginLeft:4}}>Click any row to view details</span>
              <span style={{marginLeft:"auto",fontSize:12,color:theme.textDim}}>{Math.min(pageStart+1,filtered.length)}–{Math.min(pageStart+PAGE_SIZE,filtered.length)} of {filtered.length}</span>
              <button onClick={()=>{setAllCoins([]);setPage(0);setErrors([]);setNewAlerts([]);setLastScan(null);}} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${theme.border}`,background:"transparent",color:theme.textMid,fontSize:12,cursor:"pointer",fontWeight:600}}>Clear all</button>
            </div>
          )}

          {!scanning&&allCoins.length===0&&(
            <div style={{textAlign:"center",padding:"80px 20px",animation:"fadeUp 0.3s ease"}}>
              <div style={{width:56,height:56,borderRadius:14,background:theme.accentBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={theme.accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{fontSize:16,fontWeight:600,color:theme.text,marginBottom:8}}>Ready to scan</div>
              <div style={{fontSize:13,color:theme.textDim,maxWidth:300,margin:"0 auto",lineHeight:1.7}}>
                Click <strong style={{color:theme.accent}}>Scan now</strong> to pull live projects from CoinGecko + CMC. Results show 10 at a time.
              </div>
            </div>
          )}

          {activeTab==="watch"&&watchlist.size===0&&allCoins.length>0&&(
            <div style={{textAlign:"center",padding:"60px 0",color:theme.textDim,fontSize:13}}>No saved projects — click any row then Save to Watchlist.</div>
          )}

          {/* Desktop table */}
          {visible.length>0&&(
            <div className="desk-tbl" style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:12,overflow:"hidden",animation:"fadeUp 0.25s ease"}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:820}}>
                  <thead>
                    <tr style={{background:theme.statBg,borderBottom:`1px solid ${theme.border}`}}>
                      {["Project","Src","Market Cap","Price","24h %","Volume","Vol/MC","Category","OTC Score",""].map(h=>(
                        <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:theme.textDim,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((coin,i)=>{
                      const chg=coin.change24h||0, vr=coin.mc>0?((coin.vol/coin.mc)*100).toFixed(1):"—";
                      const sc=otcScore(coin.mc,coin.vol), si=scoreInfo(sc,dark);
                      const cat=catInfo(coin.cat), isW=watchlist.has(coin.id);
                      return(
                        <tr
                          key={coin.id}
                          className="row-click"
                          onClick={()=>setModalCoin(coin)}
                          style={{borderBottom:i<visible.length-1?`1px solid ${theme.border}`:"none",transition:"background 0.1s"}}
                          onMouseEnter={e=>e.currentTarget.style.background=theme.bgHov}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                        >
                          <td style={{padding:"11px 12px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:9}}>
                              <img src={coin.image} alt="" width={26} height={26} style={{borderRadius:"50%",flexShrink:0}} onError={e=>{e.target.style.display="none";}}/>
                              <div>
                                <div style={{fontSize:13,fontWeight:600,color:theme.text,display:"flex",alignItems:"center",gap:5}}>
                                  {coin.name}
                                  {coin.isNew&&<span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:4,background:dark?"#1a0808":"#fff5f5",color:"#ef4444",border:"1px solid #ef444430",animation:"pulse 2s infinite"}}>NEW</span>}
                                </div>
                                <div style={{fontSize:10,color:theme.textDim,marginTop:1}}>{coin.symbol}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{padding:"11px 12px"}}>
                            <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:coin.source==="CMC"?(dark?"#1a0a30":"#f5f3ff"):(dark?"#0a1a2e":"#eff6ff"),color:coin.source==="CMC"?"#8b5cf6":"#3b82f6",border:`1px solid ${coin.source==="CMC"?"#8b5cf630":"#3b82f630"}`}}>
                              {coin.source==="CMC"?"CMC":"CG"}
                            </span>
                          </td>
                          <td style={{padding:"11px 12px",fontSize:13,fontWeight:500,color:theme.text}}>{fmtUSD(coin.mc)}</td>
                          <td style={{padding:"11px 12px",fontSize:13,color:theme.textMid}}>{fmtPrice(coin.price)}</td>
                          <td style={{padding:"11px 12px",fontSize:13,fontWeight:700,color:chg>=0?"#22c55e":"#ef4444"}}>{(chg>=0?"+":"")+chg.toFixed(1)+"%"}</td>
                          <td style={{padding:"11px 12px",fontSize:13,color:theme.textMid}}>{fmtUSD(coin.vol)}</td>
                          <td style={{padding:"11px 12px",fontSize:12,color:theme.textDim}}>{vr!=="—"?vr+"%":"—"}</td>
                          <td style={{padding:"11px 12px"}}>
                            <span style={{display:"inline-flex",alignItems:"center",gap:5,background:cat.color+"18",color:cat.color,border:`1px solid ${cat.color}30`,borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700}}>
                              <span style={{width:5,height:5,borderRadius:"50%",background:cat.color,flexShrink:0}}/>{cat.label}
                            </span>
                          </td>
                          <td style={{padding:"11px 12px"}}>
                            <span style={{display:"inline-flex",alignItems:"center",gap:5,background:si.bg,color:si.text,borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700}}>
                              <span style={{width:6,height:6,borderRadius:"50%",background:si.dot,flexShrink:0}}/>{si.label} {sc}/6
                            </span>
                          </td>
                          <td style={{padding:"11px 12px"}} onClick={e=>e.stopPropagation()}>
                            <button onClick={e=>{e.stopPropagation();toggleWatch(coin.id);}} style={{padding:"5px 11px",borderRadius:7,border:`1px solid ${isW?theme.accent+"50":theme.border}`,background:isW?theme.accentBg:"transparent",color:isW?theme.accentTxt:theme.textDim,fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit"}}>
                              {isW?"✓ Saved":"Save"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{padding:"12px 16px",borderTop:`1px solid ${theme.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                <span style={{fontSize:12,color:theme.textDim}}>Showing {Math.min(pageStart+1,filtered.length)}–{Math.min(pageStart+PAGE_SIZE,filtered.length)} of {filtered.length}</span>
                <div style={{display:"flex",gap:8}}>
                  {page>0&&<button onClick={()=>setPage(p=>p-1)} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${theme.border}`,background:"transparent",color:theme.textMid,fontSize:12,fontWeight:600,cursor:"pointer"}}>← Prev</button>}
                  {hasMore&&<button onClick={()=>setPage(p=>p+1)} style={{padding:"6px 14px",borderRadius:7,border:"none",background:theme.accent,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 6px #6366f130"}}>Next 10 →</button>}
                </div>
              </div>
            </div>
          )}

          {/* Mobile cards */}
          {visible.length>0&&(
            <div className="mob-cards">
              {visible.map(coin=>{
                const chg=coin.change24h||0, sc=otcScore(coin.mc,coin.vol), si=scoreInfo(sc,dark), cat=catInfo(coin.cat), isW=watchlist.has(coin.id);
                return(
                  <div key={coin.id} onClick={()=>setModalCoin(coin)} style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:10,padding:14,marginBottom:10,cursor:"pointer",transition:"border-color 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=theme.accent+"60"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=theme.border}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                        <img src={coin.image} alt="" width={30} height={30} style={{borderRadius:"50%"}} onError={e=>{e.target.style.display="none";}}/>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:theme.text}}>{coin.name} {coin.isNew&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:4,background:"#fff5f5",color:"#ef4444",border:"1px solid #ef444430"}}>NEW</span>}</div>
                          <div style={{fontSize:11,color:theme.textDim}}>{coin.symbol}</div>
                        </div>
                      </div>
                      <span style={{display:"inline-flex",alignItems:"center",gap:4,background:si.bg,color:si.text,borderRadius:20,padding:"3px 9px",fontSize:10,fontWeight:700}}>
                        <span style={{width:5,height:5,borderRadius:"50%",background:si.dot}}/>{si.label} {sc}/6
                      </span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                      {[["Market Cap",fmtUSD(coin.mc)],["Price",fmtPrice(coin.price)],["24h %",(chg>=0?"+":"")+chg.toFixed(1)+"%",chg>=0?"#22c55e":"#ef4444"],["Volume",fmtUSD(coin.vol)]].map(([k,v,c])=>(
                        <div key={k} style={{background:theme.statBg,borderRadius:7,padding:"8px 10px"}}>
                          <div style={{fontSize:10,color:theme.textDim,marginBottom:3}}>{k}</div>
                          <div style={{fontSize:13,fontWeight:600,color:c||theme.text}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:5,background:cat.color+"18",color:cat.color,border:`1px solid ${cat.color}30`,borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700}}>
                        <span style={{width:5,height:5,borderRadius:"50%",background:cat.color}}/>{cat.label}
                      </span>
                      <span style={{fontSize:11,color:theme.textDim}}>Tap to view details →</span>
                    </div>
                  </div>
                );
              })}
              <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
                {page>0&&<button onClick={()=>setPage(p=>p-1)} style={{padding:"8px 18px",borderRadius:8,border:`1px solid ${theme.border}`,background:"transparent",color:theme.textMid,fontSize:13,fontWeight:600,cursor:"pointer"}}>← Prev</button>}
                {hasMore&&<button onClick={()=>setPage(p=>p+1)} style={{padding:"8px 18px",borderRadius:8,border:"none",background:theme.accent,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Next 10 →</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
