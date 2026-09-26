import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, ArrowRight, BrainCircuit, Database, FlaskConical, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { auditToken, type AuditResult, type HistoricalHolding } from './analysis'
import { discoverTokens, getApiStatus, getTokenHistory, type NansenMeta } from './nansen'
import { savedResult, savedToken, SAVED_TOKEN_ADDRESS } from './snapshot'

function isoDaysAgo(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

function percent(value: number | null, digits = 2) {
  return value == null ? '—' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(digits)}%`
}

function compactUsd(value?: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en', { notation: 'compact', style: 'currency', currency: 'USD', maximumFractionDigits: 1 }).format(value)
}

function chartPoints(curve: AuditResult['curve']) {
  if (curve.length < 2) return ''
  const values = curve.map((point) => point.value)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const range = maximum - minimum || 1
  return curve.map((point, index) => `${(index / (curve.length - 1)) * 700},${190 - ((point.value - minimum) / range) * 160}`).join(' ')
}

function App() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [chain, setChain] = useState('solana')
  const [tokens, setTokens] = useState<HistoricalHolding[]>([savedToken])
  const [selectedAddress, setSelectedAddress] = useState(SAVED_TOKEN_ADDRESS)
  const [history, setHistory] = useState<HistoricalHolding[]>([])
  const [result, setResult] = useState<AuditResult | null>(savedResult)
  const [meta, setMeta] = useState<NansenMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const endDate = useMemo(() => isoDaysAgo(3), [])
  const startDate = useMemo(() => isoDaysAgo(94), [])
  const selected = tokens.find((token) => token.token_address === selectedAddress) ?? history.at(-1) ?? null

  useEffect(() => { getApiStatus().then((status) => setConfigured(status.configured)).catch(() => setConfigured(false)) }, [])

  function changeChain(next: string) {
    setChain(next)
    setTokens(next === 'solana' ? [savedToken] : [])
    setSelectedAddress(next === 'solana' ? SAVED_TOKEN_ADDRESS : '')
    setHistory([])
    setResult(next === 'solana' ? savedResult : null)
    setError('')
  }

  async function runAudit() {
    setLoading(true)
    setError('')
    try {
      let candidates = tokens.filter((token) => token.token_address !== SAVED_TOKEN_ADDRESS)
      let address = selectedAddress
      if (!candidates.length) {
        const discovery = await discoverTokens(chain, startDate)
        candidates = discovery.data.filter((token) => token.token_address && token.market_cap_usd).slice(0, 100)
        if (!candidates.length) throw new Error('No settled token candidates were returned for this date.')
        address = candidates[0].token_address
        setTokens(candidates)
        setSelectedAddress(address)
        setMeta(discovery.meta)
      }
      const tokenHistory = await getTokenHistory(chain, address || candidates[0].token_address, startDate, endDate)
      setHistory(tokenHistory.data)
      setResult(auditToken(tokenHistory.data))
      setMeta(tokenHistory.meta)
    } catch (caught) {
      setHistory([])
      setResult(null)
      setError(caught instanceof Error ? caught.message : 'The live audit failed.')
    } finally {
      setLoading(false)
    }
  }

  const live = Boolean(result && history.length)
  const saved = Boolean(result && !live)
  const displayed = Boolean(result)
  const flowLabel = result?.latestFlow == null ? '—' : result.latestFlow > 0 ? 'ACCUMULATION' : result.latestFlow < 0 ? 'DISTRIBUTION' : 'FLAT'
  const lifecycle = ['DISCOVERED', 'LIVE', 'DECAYING', 'DEAD']
  const points = result ? chartPoints(result.curve) : ''
  const crowdingScore = result?.crowdingPressure == null ? '—' : `${Math.round(result.crowdingPressure * 100)} / 100`

  return <main>
    <header className="topbar">
      <div className="brand"><div className="logo">α</div><div><div className="eyebrow">NANSEN RESEARCH LAYER</div><h1>Alpha Evolution Lab</h1></div></div>
      <div className="header-actions"><span className="powered">Powered by <strong>Nansen</strong></span><span className="not-official">INDEPENDENT · NOT AN OFFICIAL NANSEN PRODUCT</span></div>
    </header>

    <section className="intro">
      <div><div className="eyebrow accent">POINT-IN-TIME EDGE AUDIT</div><h2>Finding alpha is easy.<br/><em>Knowing whether it is still alpha is the edge.</em></h2><p>Nansen shows who is moving. This lab asks whether that historical signal is still alive.</p></div>
      <div className={`mode ${live ? 'live' : saved ? 'saved' : configured ? 'ready' : ''}`}><span className="status-dot"/>{live ? 'LIVE · NANSEN DATA' : saved ? 'SAVED · VERIFIED RESEARCH' : configured ? 'READY · LIVE NOT LOADED' : configured === false ? 'DEMO / NO-LIVE-DATA' : 'CHECKING API'}<small>{live ? `${history.length} settled daily snapshots · ${selected?.token_symbol}` : saved ? 'PERCOLATOR · 90-day measured study · no live credits used' : configured ? 'Run a point-in-time audit to load measured values' : 'No numerical result is displayed without a key'}</small></div>
    </section>

    <section className="controls">
      <label>CHAIN<select value={chain} onChange={(event) => changeChain(event.target.value)}><option value="solana">Solana</option><option value="ethereum">Ethereum</option><option value="base">Base</option></select></label>
      <label>TOKEN · FIXED AT WINDOW START<select value={selectedAddress} disabled={!tokens.length} onChange={(event) => { setSelectedAddress(event.target.value); setResult(null); setHistory([]) }}><option value="">{tokens.length ? 'Select a token' : 'Loaded after discovery'}</option>{tokens.map((token) => <option key={token.token_address} value={token.token_address}>{token.token_symbol} · {compactUsd(token.value_usd)} SM held at discovery</option>)}</select></label>
      <label>SETTLED WINDOW<input value={`${startDate} → ${endDate}`} readOnly/></label>
      <button onClick={runAudit} disabled={loading || configured !== true}>{loading ? <RefreshCw className="spin"/> : <Sparkles/>}{loading ? 'QUERYING NANSEN…' : 'RERUN LIVE AUDIT'}</button>
    </section>

    {error && <div className="error-state"><AlertTriangle/><div><b>LIVE AUDIT FAILED</b><span>{error}</span></div></div>}

    <section className={`hero-moment ${displayed ? '' : 'empty'}`}>
      <div className="hero-head"><div><div className="eyebrow accent">THE HERO MOMENT</div><h3>{displayed ? `${selected?.token_symbol} looked like a signal. Is it still an edge?` : 'Load a live signal. Audit its lifecycle.'}</h3></div>{displayed && <span className={`meta-pill ${result?.metaState.toLowerCase()}`}>META STATE · {result?.metaState}</span>}</div>
      <div className="hero-grid">
        <HeroDatum label="SMART MONEY" value={displayed ? flowLabel : '—'} detail={displayed ? `Latest balance change ${percent(result!.latestFlow)}` : 'No placeholder value'}/>
        <HeroDatum label="MODEL AGREEMENT" value={displayed ? percent(result!.agentAgreement, 0) : '—'} detail={displayed ? `${result!.agents.length || 4} deterministic agents · agreement share` : 'No placeholder value'}/>
        <HeroDatum label="CROWDING SCORE" value={displayed ? crowdingScore : '—'} detail={displayed ? '0–100 score · agreement + concentration' : 'No placeholder value'}/>
        <HeroDatum label="ALPHA STATUS" value={displayed ? result!.status : '—'} detail={displayed ? result!.reason : 'No placeholder value'} emphasis/>
        <HeroDatum label="AFTERLIFE" value={displayed ? result!.afterlife : '—'} detail={displayed ? 'Only classified after statistically confirmed death' : 'No placeholder value'}/>
      </div>
    </section>

    <section className="panel lifecycle-panel">
      <div className="panel-title"><Activity/><div><h3>ALPHA LIFECYCLE</h3><small>DISCOVERED → LIVE → DECAYING → DEAD → AFTERLIFE</small></div></div>
      <div className="lifecycle">
        {lifecycle.map((stage, index) => <div className="lifecycle-segment" key={stage}><div className={`stage ${result && (stage === result.status || (stage === 'DISCOVERED' && result.trainExpectancy != null && result.trainExpectancy > 0)) ? 'active' : ''}`}><span>{String(index + 1).padStart(2, '0')}</span><b>{stage}</b></div>{index < lifecycle.length - 1 && <ArrowRight/>}</div>)}
        <ArrowRight/>
        <div className="afterlife-stack">{['NEUTRAL', 'INVERTED', 'REBORN'].map((stage) => <span className={result?.afterlife === stage ? 'active' : ''} key={stage}>{stage}</span>)}</div>
      </div>
    </section>

    <section className="metric-grid">
      <Metric icon={<FlaskConical/>} label="ALPHA HALF-LIFE" value={displayed && result!.alphaHalfLifeDays != null ? `${result!.alphaHalfLifeDays}d` : '—'} detail="First OOS rolling edge ≤ 50% of train"/>
      <Metric icon={<BrainCircuit/>} label="DISAGREEMENT SCORE" value={displayed ? percent(result!.agentDisagreement, 0) : '—'} detail="1 − largest vote share"/>
      <Metric icon={<Activity/>} label="OOS EXPECTANCY" value={displayed ? percent(result!.oosExpectancy) : '—'} detail={displayed && result!.oosCi ? `95% CI ${percent(result!.oosCi[0])} to ${percent(result!.oosCi[1])}` : 'Untouched final 40%'}/>
      <Metric icon={<Database/>} label="SAMPLE SIZE" value={displayed ? `${result!.sampleSize}` : '—'} detail={displayed ? `${result!.trainSize} train · ${result!.oosSize} OOS pairs` : 'Consecutive daily pairs only'}/>
      <Metric icon={<ShieldCheck/>} label="SIGNAL AGE" value={displayed && result!.signalAgeDays != null ? `${result!.signalAgeDays}d` : '—'} detail="Nansen token_age_days at final snapshot"/>
      <Metric icon={<FlaskConical/>} label="COST-ADJUSTED" value={displayed ? percent(result!.costAdjustedExpectancy) : '—'} detail="10 bps deducted per observed signal"/>
    </section>

    <section className="two-column">
      <div className="panel chart-panel"><div className="panel-title"><Database/><div><h3>MEASURED EDGE CURVE</h3><small>Cumulative cost-adjusted signal return · not token price</small></div></div>{points ? <div className="chart"><svg viewBox="0 0 700 220" preserveAspectRatio="none"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="3"/></svg><div className="split" style={{ left: `${(result!.trainSize / result!.sampleSize) * 100}%` }}><span>OOS</span></div></div> : <div className="empty-chart">{saved ? 'Saved snapshot stores verified summary metrics; live audit renders the curve.' : 'Run a live audit. No synthetic curve is rendered.'}</div>}</div>
      <div className="panel agents-panel"><div className="panel-title"><BrainCircuit/><div><h3>INDEPENDENT SIMPLE AGENTS</h3><small>Agreement is treated as a crowding proxy</small></div></div><div className="agent-list">{live ? result!.agents.map((agent) => <div className="agent" key={agent.name}><div><b>{agent.name}</b><small>{agent.evidence}</small></div><span className={agent.direction.toLowerCase()}>{agent.direction}</span></div>) : saved ? <div className="empty-agents">Saved snapshot records 50% model agreement. Rerun live to inspect current evidence.</div> : <div className="empty-agents">No votes before live data is loaded.</div>}</div></div>
    </section>

    <section className="panel trace-panel"><div className="panel-title"><ShieldCheck/><div><h3>WHY THIS RESULT</h3><small>Endpoint → field → formula → measured value</small></div></div>{displayed ? <div className="trace-table">{result!.trace.map((item) => <div className="trace-row" key={item.formula}><code>{item.source}</code><span>{item.fields}</span><b>{item.formula}</b><strong>{item.value}</strong></div>)}</div> : <div className="empty-trace">Methodology trace appears only after a successful live audit.</div>}</section>

    <footer><span>{live ? `LIVE · ${meta?.endpoint} · credits used ${meta?.creditsUsed ?? 'unreported'} · remaining ${meta?.creditsRemaining ?? 'unreported'}` : saved ? 'SAVED / VERIFIED RESEARCH SNAPSHOT · no live credits used' : 'No raw Nansen data is persisted or redistributed.'}</span><span>Historical research classification · not investment advice</span></footer>
  </main>
}

function HeroDatum({ label, value, detail, emphasis = false }: { label: string; value: string; detail: string; emphasis?: boolean }) { return <div className={`hero-datum ${emphasis ? 'emphasis' : ''}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div> }
function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className="metric"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div> }

export default App
