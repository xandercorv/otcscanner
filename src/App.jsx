import { useState, useCallback } from "react";

const MIN_MC  = 1_000_000;
const MAX_MC  = 50_000_000;
const MIN_VOL = 400_000;
const MAX_VOL = 7_000_000;

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

function lsGet(key,fb){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):fb; }catch{ return fb; } }
function lsSet(key,val){ try{ localStorage.setItem(key,JSON.stringify(val)); }catch{} }

function qualifies(mc,vol){
  return mc>=MIN_MC && mc<=MAX_MC && vol>=MIN_VOL && vol<=MAX_VOL;
}

function Th(dark){
  return dark?{
    bg:"#0f0f1a",bgSide:"#0a0a14",bgCard:"#13131f",bgHov:"#1a1a2e",
    border:"#1e1e35",borderMid:"#2a2a45",
    text:"#e8e8ff",textMid:"#9090c0",textDim:"#4a4a6a",
    accent:"#6366f1",accentBg:"#6366f115",accentTxt:"#a5b4fc",
    navAct:"#6366f118",navActTxt:"#a5b4fc",
    statBg:"#0d0d1a",headerBg:"#0a0a14",
    shadow:"0 1px 3px rgba(0,0,0,0.5)",overlay:"rgba(0,0,0,0.75)",modalBg:"#13131f",
  }:{
    bg:"#f5f5f8",bgSide:"#ffffff",bgCard:"#ffffff",bgHov:"#f9f9fc",
    border:"#e8e8f0",borderMid:"#d0d0e0",
    text:"#111827",textMid:"#6b7280",textDim:"#9ca3af",
    accent:"#6366f1",accentBg:"#6366f110",accentTxt:"#6366f1",
    navAct:"#6366f110",navActTxt:"#6366f1",
    statBg:"#f9f9fc",headerBg:"#ffffff",
    shadow:"0 1px 3px rgba(0,0,0,0.07)",overlay:"rgba(0,0,0,0.5)",modalBg:"#ffffff",
  };
}

const fmtUSD=n=>{
  if(!n&&n!==0)return"—";
  if(n>=1e9)return"$"+(n/1e9).toFixed(2)+"B";
  if(n>=1e6)return"$"+(n/1e6).toFixed(2)+"M";
  if(n>=1e3)return"$"+(n/1e3).toFixed(1)+"K";
  return"$"+n.toFixed(4);
};
const fmtPrice=n=>{
  if(!n&&n!==0)return"—";
  if(n>=1)return"$"+n.toFixed(3);
  if(n>=0.01)return"$"+n.toFixed(4);
  return"$"+n.toExponential(2);
};
function otcScore(mc,vol){
  let s=0;
  if(mc>=MIN_MC&&mc<=MAX_MC) s+=3;
  if(vol>=MIN_VOL&&vol<=MAX_VOL) s+=1;
  if(vol>0&&mc>0&&vol/mc<0.1) s+=1;
  if(mc<10_000_000) s+=1;
  return Math.min(s,6);
}
function scoreInfo(s,dark){
  if(s>=5)return{label:"Strong",bg:dark?"#052e16":"#dcfce7",text:dark?"#4ade80":"#166534",dot:"#22c55e"};
  if(s>=3)return{label:"Good",bg:dark?"#1c1400":"#fef9c3",text:dark?"#fbbf24":"#854d0e",dot:"#f59e0b"};
  return{label:"Weak",bg:dark?"#1a1a2e":"#f3f4f6",text:dark?"#6b7280":"#6b7280",dot:"#9ca3af"};
}
function catInfo(id){ return CG_CATS.find(c=>c.id===id)||{label:id,color:"#6366f1"}; }
function projectURL(coin){
  if(coin.source==="CMC")return`https://coinmarketcap.com/currencies/${coin.name.toLowerCase().replace(/\s+/g,"-")}/`;
  return`https://www.coingecko.com/en/coins/${coin.rawId}`;
}

// ── simple fetchers ────────────────────────────────────────────────
async function fetchCGCat(cat){
  const results=[];
  for(const page of[1,2]){
    try{
      const qs=new URLSearchParams({
        vs_currency:"usd",category:cat.cgId,
        order:"market_cap_asc",per_page:"250",page:String(page),
        sparkline:"false",price_change_percentage:"24h",
      }).toString();
      const res=await fetch(`/api/coingecko?${qs}`);
      if(!res.ok) break;
      const data=await res.json();
      if(!Array.isArray(data)||data.length===0) break;
      const batch=data
        .filter(c=>qualifies(c.market_cap,c.total_volume||0))
        .map(c=>({
          id:"cg_"+c.id,rawId:c.id,
          name:c.name,symbol:(c.symbol||"").toUpperCase(),
          image:c.image,mc:c.market_cap,price:c.current_price,
          vol:c.total_volume,change24h:c.price_change_percentage_24h,
          cat:cat.id,source:"CoinGecko",isNew:false,
        }));
      results.push(...batch);
      await new Promise(r=>setTimeout(r,1000));
    }catch(e){ break; }
  }
  return results;
}

async function fetchCMC(){
  const results=[];
  const now=Date.now();
  for(const start of[1,201,401]){
    try{
      const qs=new URLSearchParams({
        limit:"200",start:String(start),convert:"USD",
        sort:"market_cap",sort_dir:"asc",
      }).toString();
      const res=await fetch(`/api/cmc?${qs}`);
      if(!res.ok) break;
      const data=await res.json();
      const batch=(data.data||[])
        .filter(c=>{
          const mc=c.quote?.USD?.market_cap||0,vol=c.quote?.USD?.volume_24h||0;
          return qualifies(mc,vol);
        })
        .map(c=>{
          const q=c.quote?.USD||{};
          const ageDays=(now-new Date(c.date_added).getTime())/86400000;
          return{
            id:"cmc_"+c.id,rawId:String(c.id),
            name:c.name,symbol:c.symbol,
            image:`https://s2.coinmarketcap.com/static/img/coins/64x64/${c.id}.png`,
            mc:q.market_cap||0,price:q.price||0,vol:q.volume_24h||0,
            change24h:q.percent_change_24h||0,
            cat:guessCat(c.tags||[]),source:"CMC",isNew:ageDays<=30,
          };
        });
      results.push(...batch);
      await new Promise(r=>setTimeout(r,600));
    }catch(e){ break; }
  }
  return results;
}

function guessCat(tags){
  const t=tags.map(x=>x.toLowerCase()).join(" ");
  if(t.includes("defi")||t.includes("dex")||t.includes("lending"))return"defi";
  if(t.includes("ai")||t.includes("artificial"))return"ai";
  if(t.includes("meme")||t.includes("dog")||t.includes("cat"))return"meme";
  if(t.includes("layer")||t.includes("infra")||t.includes("oracle"))return"infra";
  return"other";
}

function exportCSV(coins){
  const h=["Name","Symbol","Category","Source","Market Cap","Price","24h %","Volume","OTC Score","New?"];
  const r=coins.map(c=>[`"${c.name}"`,c.symbol,catInfo(c.cat).label,c.source,c.mc.toFixed(0),c.price,(c.change24h||0).toFixed(2),c.vol.toFixed(0),otcScore(c.mc,c.vol),c.isNew?"YES":""].join(","));
  const blob=new Blob([[h.join(","),...r].join("\n")],{type:"text/csv"});
  Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:"otc-scan.csv"}).click();
}

function Spinner(){
  return<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{animation:"spin 0.8s linear infinite",flexShrink:0}}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>;
}

// ── Modal ──────────────────────────────────────────────────────────
function ProjectModal({coin,dark,onClose,onToggleWatch,isWatched}){
  const theme=Th(dark);
  const sc=otcScore(coin.mc,coin.vol),si=scoreInfo(sc,dark);
  const cat=catInfo(coin.cat),chg=coin.change24h||0;
  const vr=coin.mc>0?((coin.vol/coin.mc)*100).toFixed(1):"—";
  const url=projectURL(coin),isCMC=coin.source==="CMC";
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:theme.overlay,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:theme.modalBg,border:`1px solid ${theme.border}`,borderRadius:16,width:"100%",maxWidth:420,boxShadow:"0 25px 60px rgba(0,0,0,0.3)",animation:"modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${cat.color}22,${cat.color}08)`,borderBottom:`1px solid ${theme.border}`,padding:"20px 20px 16px",display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <img src={coin.image} alt={coin.name} width={52} height={52} style={{borderRadius:"50%",border:`2px solid ${cat.color}40`,flexShrink:0}} onError={e=>{e.target.style.display="none";}}/>
            <div>
              <div style={{fontSize:18,fontWeight:700,color:theme.text,display:"flex",alignItems:"center",gap:7}}>
                {coin.name}
                {coin.isNew&&<span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,background:dark?"#1a0808":"#fff5f5",color:"#ef4444",border:"1px solid #ef444430",animation:"pulse 2s infinite"}}>NEW</span>}
              </div>
              <div style={{fontSize:13,color:theme.textDim,marginTop:3,display:"flex",alignItems:"center",gap:6}}>
                <span>{coin.symbol}</span>
                <span style={{width:3,height:3,borderRadius:"50%",background:theme.textDim}}/>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:isCMC?(dark?"#1a0a30":"#f5f3ff"):(dark?"#0a1a2e":"#eff6ff"),color:isCMC?"#8b5cf6":"#3b82f6",border:`1px solid ${isCMC?"#8b5cf630":"#3b82f630"}`}}>
                  {isCMC?"CoinMarketCap":"CoinGecko"}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",cursor:"pointer",color:theme.textDim,padding:4,borderRadius:6}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${theme.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:11,fontWeight:700,color:theme.textDim,textTransform:"uppercase",letterSpacing:"0.07em"}}>OTC Score</div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{display:"flex",gap:4}}>
              {[1,2,3,4,5,6].map(i=><div key={i} style={{width:22,height:6,borderRadius:3,background:i<=sc?si.dot:theme.border}}/>)}
            </div>
            <span style={{display:"inline-flex",alignItems:"center",gap:5,background:si.bg,color:si.text,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:si.dot}}/>{si.label} {sc}/6
            </span>
          </div>
        </div>
        <div style={{padding:"16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            {label:"Market Cap",value:fmtUSD(coin.mc)},
            {label:"Price",value:fmtPrice(coin.price)},
            {label:"24h Change",value:(chg>=0?"+":"")+chg.toFixed(2)+"%",color:chg>=0?"#22c55e":"#ef4444"},
            {label:"Volume (24h)",value:fmtUSD(coin.vol)},
            {label:"Vol / MC",value:vr!=="—"?vr+"%":"—"},
            {label:"Category",value:cat.label,color:cat.color},
          ].map(row=>(
            <div key={row.label} style={{background:theme.statBg,borderRadius:9,padding:"12px 14px",border:`1px solid ${theme.border}`}}>
              <div style={{fontSize:10,color:theme.textDim,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>{row.label}</div>
              <div style={{fontSize:15,fontWeight:700,color:row.color||theme.text}}>{row.value}</div>
            </div>
          ))}
        </div>
        <div style={{padding:"0 20px 20px",display:"flex",gap:8,flexDirection:"column"}}>
          <a href={url} target="_blank" rel="noopener noreferrer"
            style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"11px 16px",borderRadius:9,background:isCMC?"linear-gradient(135deg,#3b48ff,#6366f1)":"linear-gradient(135deg,#2ec97b,#10b981)",color:"#fff",fontSize:13,fontWeight:700,textDecoration:"none"}}
            onMouseEnter={e=>e.currentTarget.style.opacity="0.88"}
            onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
            {isCMC?"View on CoinMarketCap":"View on CoinGecko"}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          <button onClick={()=>onToggleWatch(coin.id,coin)}
            style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"10px 16px",borderRadius:9,border:`1px solid ${isWatched?theme.accent+"60":theme.border}`,background:isWatched?theme.accentBg:"transparent",color:isWatched?theme.accentTxt:theme.textMid,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {isWatched?"✓ Saved to Watchlist":"Save to Watchlist"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── main ───────────────────────────────────────────────────────────
export default function App(){
  const [dark,      setDark]     =useState(()=>lsGet("otc_dark",false));
  const [sideOpen,  setSideOpen] =useState(false);
  const [allCoins,  setAllCoins] =useState(()=>lsGet("otc_coins",[]));
  const [errors,    setErrors]   =useState(()=>lsGet("otc_errors",[]));
  const [lastScan,  setLastScan] =useState(()=>{ const v=lsGet("otc_lastscan",null); return v?new Date(v):null; });
  const [newAlerts, setNewAlerts]=useState(()=>lsGet("otc_alerts",[]));
  const [scanning,  setScanning] =useState(false);
  const [progress,  setProgress] =useState("");
  const [activeTab, setActiveTab]=useState("all");
  const [sortBy,    setSortBy]   =useState("otc");
  const [page,      setPage]     =useState(0);
  const [modalCoin, setModalCoin]=useState(null);

  // Watchlist stores full coin objects — always persists
  const [watchMap,setWatchMapRaw]=useState(()=>new Map(lsGet("otc_watchmap",[])));
  const setWatchMap=fn=>{
    setWatchMapRaw(prev=>{
      const next=typeof fn==="function"?fn(prev):fn;
      lsSet("otc_watchmap",[...next.entries()]);
      return next;
    });
  };
  const toggleWatch=(id,coinObj)=>setWatchMap(prev=>{
    const next=new Map(prev);
    next.has(id)?next.delete(id):next.set(id,coinObj||prev.get(id));
    return next;
  });

  const persist=(coins,errs,alerts,ts)=>{
    setAllCoins(coins);   lsSet("otc_coins",coins);
    setErrors(errs);      lsSet("otc_errors",errs);
    setNewAlerts(alerts); lsSet("otc_alerts",alerts);
    setLastScan(ts);      lsSet("otc_lastscan",ts?.toISOString()||null);
  };

  // ── simple scan: fetch each CG category + CMC, merge, dedup ──────
  const scan=useCallback(async()=>{
    if(scanning) return;
    setScanning(true);
    setAllCoins([]); lsSet("otc_coins",[]);
    setErrors([]); setNewAlerts([]); setPage(0);

    const fetched=[], errs=[];

    // CoinGecko — one category at a time
    for(let i=0;i<CG_CATS.length;i++){
      const cat=CG_CATS[i];
      setProgress(`CoinGecko: ${cat.label} (${i+1}/${CG_CATS.length})`);
      try{ fetched.push(...await fetchCGCat(cat)); }
      catch(e){ errs.push(`CG/${cat.label}: ${e.message}`); }
      if(i<CG_CATS.length-1) await new Promise(r=>setTimeout(r,1200));
    }

    // CoinMarketCap
    setProgress("CMC: fetching…");
    const cgSymbols=new Set(fetched.map(c=>c.symbol));
    try{
      const cmcCoins=await fetchCMC();
      const newOnes=[];
      for(const c of cmcCoins){
        if(cgSymbols.has(c.symbol)) continue; // dedup: CMC wins on overlap
        fetched.push(c);
        if(c.isNew) newOnes.push(c);
      }
      if(newOnes.length) persist([],errs,newOnes.slice(0,10),null);
    }catch(e){ errs.push(`CMC: ${e.message}`); }

    // Final dedup by rawId
    const seen=new Set();
    const final=fetched.filter(c=>{
      if(seen.has(c.rawId)) return false;
      seen.add(c.rawId);
      return true;
    });

    // Collect new alerts from CG too
    const allNew=final.filter(c=>c.isNew);

    persist(final, errs, allNew.slice(0,10), new Date());
    setScanning(false);
    setProgress("");
  },[scanning]);

  const clearScan=()=>{
    setAllCoins([]); lsSet("otc_coins",[]);
    setErrors([]); lsSet("otc_errors",[]);
    setNewAlerts([]); lsSet("otc_alerts",[]);
    setLastScan(null); lsSet("otc_lastscan",null);
    setPage(0);
  };
  const clearWatchlist=()=>setWatchMap(new Map());
  const watchCoins=[...watchMap.values()];

  const tabs=[
    {id:"all",   label:"All projects",   count:allCoins.length},
    {id:"defi",  label:"DeFi",           count:allCoins.filter(c=>c.cat==="defi").length,  color:"#6366f1"},
    {id:"ai",    label:"AI + Crypto",    count:allCoins.filter(c=>c.cat==="ai").length,    color:"#10b981"},
    {id:"meme",  label:"Memes",          count:allCoins.filter(c=>c.cat==="meme").length,  color:"#f59e0b"},
    {id:"infra", label:"Infrastructure", count:allCoins.filter(c=>c.cat==="infra").length, color:"#8b5cf6"},
    {id:"new",   label:"New Listings",   count:allCoins.filter(c=>c.isNew).length,         color:"#ef4444"},
    {id:"watch", label:"Watchlist",      count:watchCoins.length},
  ];

  const filtered=(()=>{
    let list=
      activeTab==="watch"?watchCoins:
      activeTab==="new"?allCoins.filter(c=>c.isNew):
      activeTab==="all"?allCoins:
      allCoins.filter(c=>c.cat===activeTab);
    return[...list].sort((a,b)=>{
      if(sortBy==="otc")    return otcScore(b.mc,b.vol)-otcScore(a.mc,a.vol);
      if(sortBy==="mc_asc") return a.mc-b.mc;
      if(sortBy==="mc_desc")return b.mc-a.mc;
      if(sortBy==="vol")    return b.vol-a.vol;
      if(sortBy==="change") return(b.change24h||0)-(a.change24h||0);
      return 0;
    });
  })();

  const PAGE_SIZE=10;
  const pageStart=page*PAGE_SIZE;
  const visible=filtered.slice(pageStart,pageStart+PAGE_SIZE);
  const hasMore=pageStart+PAGE_SIZE<filtered.length;
  const selectTab=id=>{setActiveTab(id);setPage(0);setSideOpen(false);};
  const theme=Th(dark);

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
        {[["Market cap","$1M – $50M"],["Volume (24h)","$400K – $7M"]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
            <span style={{fontSize:12,color:theme.textDim}}>{k}</span>
            <span style={{fontSize:12,fontWeight:600,color:theme.textMid}}>{v}</span>
          </div>
        ))}
      </div>
    </>
  );

  const renderRow=(coin,i,arr)=>{
    const chg=coin.change24h||0,vr=coin.mc>0?((coin.vol/coin.mc)*100).toFixed(1):"—";
    const sc=otcScore(coin.mc,coin.vol),si=scoreInfo(sc,dark);
    const cat=catInfo(coin.cat),isW=watchMap.has(coin.id);
    return(
      <tr key={coin.id} onClick={()=>setModalCoin(coin)}
        style={{borderBottom:i<arr.length-1?`1px solid ${theme.border}`:"none",cursor:"pointer",transition:"background 0.1s"}}
        onMouseEnter={e=>e.currentTarget.style.background=theme.bgHov}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
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
          <button onClick={e=>{e.stopPropagation();toggleWatch(coin.id,coin);}}
            style={{padding:"5px 11px",borderRadius:7,border:`1px solid ${isW?theme.accent+"50":theme.border}`,background:isW?theme.accentBg:"transparent",color:isW?theme.accentTxt:theme.textDim,fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit"}}>
            {isW?"✓ Saved":"Save"}
          </button>
        </td>
      </tr>
    );
  };

  return(
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
        @media(max-width:768px){.d-side{display:none}.m-btn{display:flex!important}.m-side{display:flex}}
        @media(max-width:640px){.desk-tbl{display:none!important}.mob-cards{display:block!important}}
      `}</style>

      {modalCoin&&<ProjectModal coin={modalCoin} dark={dark} onClose={()=>setModalCoin(null)} onToggleWatch={toggleWatch} isWatched={watchMap.has(modalCoin.id)}/>}

      <aside className="d-side" style={{width:220,background:theme.bgSide,borderRight:`1px solid ${theme.border}`,flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh",overflowY:"auto",transition:"background 0.2s"}}>
        <SidebarInner/>
      </aside>

      {sideOpen&&<div onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:theme.overlay,zIndex:40}}/>}

      <aside className="m-side" style={{background:theme.bgSide,borderRight:`1px solid ${theme.border}`,boxShadow:"2px 0 20px rgba(0,0,0,0.15)",transform:sideOpen?"translateX(0)":"translateX(-100%)",transition:"transform 0.25s cubic-bezier(0.4,0,0.2,1)"}}>
        <div style={{display:"flex",justifyContent:"flex-end",padding:"12px 12px 0"}}>
          <button onClick={()=>setSideOpen(false)} style={{background:"transparent",border:"none",cursor:"pointer",color:theme.textMid,padding:6}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        <SidebarInner/>
      </aside>

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
            <button onClick={()=>setDark(d=>!d)} style={{width:36,height:36,borderRadius:8,border:`1px solid ${theme.border}`,background:theme.bgCard,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:theme.textMid,flexShrink:0}}>
              {dark
                ?<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                :<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>
            {allCoins.length>0&&(
              <button onClick={()=>exportCSV(filtered)} style={{padding:"7px 13px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",border:`1px solid ${theme.border}`,background:theme.bgCard,color:theme.textMid,display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
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
          {errors.length>0&&(
            <div style={{background:dark?"#1a0808":"#fef2f2",border:`1px solid ${dark?"#7f1d1d50":"#fecaca"}`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:dark?"#fca5a5":"#991b1b"}}>
              <strong>Notices:</strong> {errors.join(" · ")}
            </div>
          )}

          {newAlerts.length>0&&(
            <div style={{background:dark?"#1a0808":"#fff5f5",border:"1px solid #ef444430",borderRadius:10,padding:"14px 16px",marginBottom:16,animation:"fadeUp 0.3s ease"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#ef4444",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:"#ef4444",animation:"pulse 1.5s infinite",flexShrink:0}}/>
                {newAlerts.length} NEW LISTING{newAlerts.length>1?"S":""} in this scan (listed in last 30 days)
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {newAlerts.map(c=><span key={c.id} onClick={()=>setModalCoin(c)} style={{background:dark?"#0a0a14":"#fff",border:"1px solid #ef444430",borderRadius:6,padding:"3px 10px",fontSize:12,color:dark?"#fca5a5":"#dc2626",fontWeight:600,cursor:"pointer"}}>{c.name} <span style={{opacity:.7,fontSize:10}}>{c.symbol}</span></span>)}
              </div>
            </div>
          )}

          {allCoins.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:20,animation:"fadeUp 0.3s ease"}}>
              {[
                {label:"Total found",  value:allCoins.length,                                       sub:"after all filters", accent:"#6366f1"},
                {label:"Strong OTC",   value:allCoins.filter(c=>otcScore(c.mc,c.vol)>=5).length,    sub:"score 5–6 / 6",    accent:"#22c55e"},
                {label:"New listings", value:allCoins.filter(c=>c.isNew).length,                    sub:"last 30 days",     accent:"#ef4444"},
                {label:"Watchlist",    value:watchCoins.length,                                      sub:"saved projects",   accent:"#f59e0b"},
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
              {activeTab!=="watch"&&(
                <>
                  <span style={{fontSize:12,color:theme.textDim}}>Sort by</span>
                  <select value={sortBy} onChange={e=>{setSortBy(e.target.value);setPage(0);}} style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:7,padding:"6px 10px",fontSize:12,color:theme.textMid,cursor:"pointer"}}>
                    {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </>
              )}
              <span style={{fontSize:11,color:theme.textDim}}>· Click any row to view</span>
              <span style={{marginLeft:"auto",fontSize:12,color:theme.textDim}}>{Math.min(pageStart+1,filtered.length)}–{Math.min(pageStart+PAGE_SIZE,filtered.length)} of {filtered.length}</span>
              {activeTab==="watch"&&watchCoins.length>0&&(
                <button onClick={clearWatchlist} style={{padding:"6px 12px",borderRadius:7,border:"1px solid #ef444430",background:dark?"#1a0808":"#fff5f5",color:"#ef4444",fontSize:12,cursor:"pointer",fontWeight:600}}>Clear watchlist</button>
              )}
              {activeTab!=="watch"&&allCoins.length>0&&(
                <button onClick={clearScan} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${theme.border}`,background:"transparent",color:theme.textMid,fontSize:12,cursor:"pointer",fontWeight:600}}>Clear scan</button>
              )}
            </div>
          )}

          {!scanning&&allCoins.length===0&&activeTab!=="watch"&&(
            <div style={{textAlign:"center",padding:"80px 20px",animation:"fadeUp 0.3s ease"}}>
              <div style={{width:56,height:56,borderRadius:14,background:theme.accentBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={theme.accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{fontSize:16,fontWeight:600,color:theme.text,marginBottom:8}}>Ready to scan</div>
              <div style={{fontSize:13,color:theme.textDim,maxWidth:320,margin:"0 auto",lineHeight:1.7}}>
                Click <strong style={{color:theme.accent}}>Scan now</strong> to pull live projects from CoinGecko + CMC matching your OTC criteria.
              </div>
            </div>
          )}

          {activeTab==="watch"&&watchCoins.length===0&&(
            <div style={{textAlign:"center",padding:"60px 0",color:theme.textDim,fontSize:13}}>No saved projects — click any row then Save to Watchlist.</div>
          )}

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
                  <tbody>{visible.map((coin,i)=>renderRow(coin,i,visible))}</tbody>
                </table>
              </div>
              <div style={{padding:"12px 16px",borderTop:`1px solid ${theme.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                <span style={{fontSize:12,color:theme.textDim}}>Showing {Math.min(pageStart+1,filtered.length)}–{Math.min(pageStart+PAGE_SIZE,filtered.length)} of {filtered.length}</span>
                <div style={{display:"flex",gap:8}}>
                  {page>0&&<button onClick={()=>setPage(p=>p-1)} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${theme.border}`,background:"transparent",color:theme.textMid,fontSize:12,fontWeight:600,cursor:"pointer"}}>← Prev</button>}
                  {hasMore&&<button onClick={()=>setPage(p=>p+1)} style={{padding:"6px 14px",borderRadius:7,border:"none",background:theme.accent,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 6px #6366f130"}}>Next →</button>}
                </div>
              </div>
            </div>
          )}

          {visible.length>0&&(
            <div className="mob-cards">
              {visible.map(coin=>{
                const chg=coin.change24h||0,sc=otcScore(coin.mc,coin.vol),si=scoreInfo(sc,dark),cat=catInfo(coin.cat),isW=watchMap.has(coin.id);
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
                      <button onClick={e=>{e.stopPropagation();toggleWatch(coin.id,coin);}} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${isW?theme.accent+"50":theme.border}`,background:isW?theme.accentBg:"transparent",color:isW?theme.accentTxt:theme.textDim,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        {isW?"✓ Saved":"Save"}
                      </button>
                    </div>
                  </div>
                );
              })}
              <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
                {page>0&&<button onClick={()=>setPage(p=>p-1)} style={{padding:"8px 18px",borderRadius:8,border:`1px solid ${theme.border}`,background:"transparent",color:theme.textMid,fontSize:13,fontWeight:600,cursor:"pointer"}}>← Prev</button>}
                {hasMore&&<button onClick={()=>setPage(p=>p+1)} style={{padding:"8px 18px",borderRadius:8,border:"none",background:theme.accent,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Next →</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
