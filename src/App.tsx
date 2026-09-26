import { useState } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, BrainCircuit, CircleHelp, Database, FlaskConical, LockKeyhole, RefreshCw, ShieldAlert, SlidersHorizontal } from 'lucide-react'
import { afterlife, classifySnapshots, crowding, type Snapshot } from './analysis'
import { getHistoricalHoldings, hasLiveKey } from './nansen'

const demoSnapshots: Snapshot[] = Array.from({ length: 16 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value_usd: 100000 + i * 1200, balance_24h_percent_change: i < 9 ? 0.08 - i * 0.004 : i < 12 ? 0.02 : -0.004 }))

function App() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>(demoSnapshots)
  const [loading, setLoading] = useState(false)
  const [chain, setChain] = useState('solana')
  const [token, setToken] = useState('Smart Money Holdings')
  const result = classifySnapshots(snapshots)
  const crowd = crowding(snapshots)
  const life = afterlife(snapshots)
  const live = hasLiveKey && snapshots !== demoSnapshots

  async function refresh() {
    setLoading(true)
    try { const next = await getHistoricalHoldings(chain, '2026-08-01', '2026-09-20'); setSnapshots(next); setToken(next[0]?.date ? `${chain} historical cohort` : token) }
    catch { setSnapshots([]) }
    finally { setLoading(false) }
  }

  return <main>
    <header className="topbar"><div className="brand"><div className="logo">α</div><div><div className="eyebrow">NANSEN RESEARCH TOOL</div><h1>Alpha Evolution Lab</h1></div></div><div className="header-actions"><span className="powered">Powered by <strong>Nansen</strong></span><span className="deadline">BUILDATHON · SEP 27</span></div></header>
    <section className="hero"><div><div className="eyebrow green">EDGE AUDIT / POINT-IN-TIME</div><h2>Finding alpha is easy.<br/><em>Knowing whether it is still alpha is the edge.</em></h2><p>When alpha dies, does it disappear, invert, or return?</p></div><div className={`mode ${live ? 'live' : ''}`}><span className="dot"/>{live ? 'LIVE DATA' : 'DEMO / NO-LIVE-DATA'}<small>{live ? 'Nansen historical snapshots loaded' : 'Add VITE_NANSEN_API_KEY to activate'}</small></div></section>
    <section className="controls"><label>CHAIN<select value={chain} onChange={e => setChain(e.target.value)}><option value="solana">Solana</option><option value="ethereum">Ethereum</option><option value="base">Base</option></select></label><label>EDGE COHORT<input value={token} onChange={e => setToken(e.target.value)} /></label><label>WINDOW<select defaultValue="60d"><option value="60d">60 days · daily</option><option value="30d">30 days · daily</option></select></label><button onClick={refresh} disabled={loading}>{loading ? <RefreshCw className="spin" size={16}/> : <RefreshCw size={16}/>} RUN POINT-IN-TIME AUDIT</button></section>
    <section className="grid metrics"><Metric icon={<Activity/>} label="ALPHA STATUS" value={result.status} tone={result.status.toLowerCase()} sub={result.reason}/><Metric icon={<FlaskConical/>} label="ALPHA HALF-LIFE" value={result.halfLifeDays ? `${result.halfLifeDays}d` : '—'} sub="OOS decay estimate · daily snapshots"/><Metric icon={<BrainCircuit/>} label="CROWDING PROXY" value={crowd.score == null ? '—' : `${crowd.score}%`} tone="amber" sub="Signal agreement across simple agents"/><Metric icon={<SlidersHorizontal/>} label="DISAGREEMENT" value={crowd.disagreement == null ? '—' : `${crowd.disagreement}%`} sub="Independent model divergence"/></section>
    <section className="grid main-grid"><div className="panel chart-panel"><PanelTitle icon={<Database/>} title="ALPHA LIFECYCLE" note="Walk-forward / out-of-sample"/><div className="chart"><div className="zero"/><svg viewBox="0 0 700 210" preserveAspectRatio="none"><polyline points="0,170 48,160 96,150 144,138 192,125 240,112 288,105 336,110 384,121 432,128 480,145 528,158 576,166 624,173 670,181 700,184" fill="none" stroke="#71e6a4" strokeWidth="3"/><polyline points="0,170 48,160 96,150 144,138 192,125 240,112 288,105 336,110 384,121 432,128 480,145 528,158 576,166 624,173 670,181 700,184" fill="none" stroke="#71e6a4" strokeOpacity=".18" strokeWidth="12"/></svg><div className="chart-labels"><span>TRAIN</span><span>OOS VALIDATION</span><span>AFTERLIFE</span></div></div><div className="legend"><span><i className="green-dot"/>Observed signal</span><span><i className="gray-dot"/>Look-ahead locked</span><span><i className="red-dot"/>Fees + slippage included</span></div></div><div className="panel decision-panel"><PanelTitle icon={<ShieldAlert/>} title="AFTERLIFE CLASSIFIER" note="Post-DEAD state"/><div className={`decision ${life.label === 'ABSTAIN' ? 'unknown' : ''}`}><div className="decision-kicker">HISTORICAL STATE · NOT A TRADE SIGNAL</div><strong>{life.label}</strong><p>{life.reason}</p></div><div className="agent-list"><Agent name="Flow Momentum" value={result.status === 'LIVE' ? 'FOLLOW' : 'WAIT'} icon={<ArrowUpRight/>}/><Agent name="Mean Reversion" value={life.label === 'INVERTED' ? 'FADE' : 'ABSTAIN'} icon={<ArrowDownRight/>}/><Agent name="Crowding Guard" value={(crowd.score ?? 0) > 70 ? 'ABSTAIN' : 'WAIT'} icon={<LockKeyhole/>}/></div></div></section>
    <section className="panel methodology"><PanelTitle icon={<CircleHelp/>} title="AUDIT TRACE" note="Reproducible by design"/><div className="trace"><Trace n="01" title="Point-in-time" body="Daily historical holdings snapshots. No current labels or future prices."/><Trace n="02" title="Walk-forward" body="Train window is separated from an untouched OOS validation window."/><Trace n="03" title="Reality check" body="Fees, slippage, sample sufficiency and crowding are explicit gates."/><Trace n="04" title="Afterlife" body="DEAD → NEUTRAL / INVERTED / REBORN only when evidence is sufficient."/></div></section>
    <footer><span><span className="dot green-dot"/> {snapshots.length ? `${snapshots.length} snapshots in audit` : 'No live snapshots loaded'}</span><span>API calls are not stored or redistributed · Research only</span></footer>
  </main>
}

function Metric({ icon, label, value, tone = '', sub }: { icon: React.ReactNode; label: string; value: string; tone?: string; sub: string }) { return <div className="metric"><div className="metric-icon">{icon}</div><div className="eyebrow">{label}</div><div className={`metric-value ${tone}`}>{value}</div><div className="metric-sub">{sub}</div></div> }
function PanelTitle({ icon, title, note }: { icon: React.ReactNode; title: string; note: string }) { return <div className="panel-title"><span>{icon}</span><div><h3>{title}</h3><small>{note}</small></div></div> }
function Agent({ name, value, icon }: { name: string; value: string; icon: React.ReactNode }) { return <div className="agent"><span>{icon}<b>{name}</b></span><strong>{value}</strong></div> }
function Trace({ n, title, body }: { n: string; title: string; body: string }) { return <div className="trace-item"><span>{n}</span><div><b>{title}</b><p>{body}</p></div></div> }

export default App
