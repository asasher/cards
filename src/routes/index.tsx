// ROUTE / — STUDIO: Tasteful minimalist with rich micro-animations
import { createFileRoute } from '@tanstack/react-router'
import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from 'convex/react'
import { useState, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/')({ ssr: false, component: ManyCardsHome })

let _convexClient: ConvexReactClient | null = null
function gc() { const u = import.meta.env.VITE_CONVEX_URL; if (!u) return null; return (_convexClient ??= new ConvexReactClient(u)) }
function sg(k: string) { return typeof window !== 'undefined' ? localStorage.getItem(k) : null }
function ss(k: string, v: string) { if (typeof window !== 'undefined') localStorage.setItem(k, v) }
function sd(k: string) { if (typeof window !== 'undefined') localStorage.removeItem(k) }
function getToken() { const e = sg('cards.lipread.playerToken'); if (e && e.length >= 8) return e; const t = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; ss('cards.lipread.playerToken', t); return t }
function norm(s: string) { return s.trim().toUpperCase() }
function em(e: unknown) { return e instanceof Error ? e.message : 'Something went wrong.' }
type GK = 'lip-reading' | 'want-will-wont'

const S = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  ink: '#141414',
  soft: '#F2F1EF',
  line: '#E8E7E4',
  muted: '#9B9992',
  dim: '#C8C7C2',
  accent: '#C96A3A',
  accentLight: 'rgba(201,106,58,0.08)',
  accentSoft: 'rgba(201,106,58,0.15)',
}

const ease = 'cubic-bezier(0.16, 1, 0.3, 1)'
const easeOut = 'cubic-bezier(0.25, 0, 0, 1)'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@300;400;500&display=swap');
*{box-sizing:border-box;}
html,body{margin:0;background:${S.bg};-webkit-font-smoothing:antialiased;}

@keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes scaleIn{from{opacity:0;transform:scale(0.96);}to{opacity:1;transform:scale(1);}}
@keyframes tickUp{from{transform:translateY(6px);opacity:0;}to{transform:translateY(0);opacity:1;}}
@keyframes dotPulse{0%,100%{transform:scale(1);opacity:0.5;}50%{transform:scale(1.6);opacity:1;}}
@keyframes softPop{0%{transform:scale(1);}40%{transform:scale(1.07);}100%{transform:scale(1);}}
@keyframes breathe{0%,100%{opacity:0.4;}50%{opacity:0.9;}}

.a1{animation:fadeUp 0.55s ${ease} both;}
.a2{animation:fadeUp 0.55s 0.07s ${ease} both;}
.a3{animation:fadeUp 0.55s 0.14s ${ease} both;}
.a4{animation:fadeUp 0.55s 0.21s ${ease} both;}
.a5{animation:fadeUp 0.55s 0.28s ${ease} both;}
.aFade{animation:fadeIn 0.35s ease both;}
.aPop{animation:softPop 0.35s ${ease} both;}
.aScale{animation:scaleIn 0.4s ${ease} both;}

.sbtn{
  cursor:pointer;border:none;font-family:'DM Mono',monospace;letter-spacing:0.04em;
  transition:background 0.2s ease, color 0.2s ease, transform 0.15s ${ease}, opacity 0.2s ease;
  position:relative;overflow:hidden;
}
.sbtn::after{content:'';position:absolute;inset:0;background:${S.ink};opacity:0;transition:opacity 0.2s ease;}
.sbtn:hover:not(:disabled)::after{opacity:0.05;}
.sbtn:active:not(:disabled){transform:scale(0.975);}
.sbtn:disabled{opacity:0.35;cursor:not-allowed;}

.swipebtn{
  cursor:pointer;border:none;font-family:'DM Mono',monospace;font-size:13px;font-weight:400;letter-spacing:0.06em;
  transition:background 0.18s ease,color 0.18s ease,transform 0.18s ${ease},box-shadow 0.2s ease;
  position:relative;overflow:hidden;
}
.swipebtn::before{content:'';position:absolute;bottom:0;left:0;right:0;height:0;background:currentColor;opacity:0.06;transition:height 0.2s ease;}
.swipebtn:hover:not(:disabled)::before{height:100%;}
.swipebtn:hover:not(:disabled){transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,0.08);}
.swipebtn:active:not(:disabled){transform:translateY(0);box-shadow:none;}
.swipebtn:disabled{opacity:0.3;cursor:not-allowed;}

.gamecard{transition:transform 0.25s ${ease},box-shadow 0.25s ${ease};}
.gamecard:hover{transform:translateY(-4px);box-shadow:0 16px 48px rgba(0,0,0,0.07)!important;}

input{font-family:'DM Mono',monospace!important;font-size:15px!important;transition:border-color 0.2s ease,box-shadow 0.2s ease;}
input:focus{outline:none;}
input::placeholder{color:${S.dim};}
`

function ManyCardsHome() {
  const client = gc()
  if (!client) return <div style={{ padding: 40, fontFamily: "'DM Mono',monospace", fontSize: 13, color: S.ink }}>Missing VITE_CONVEX_URL</div>
  return (
    <ConvexProvider client={client}>
      <style>{CSS}</style>
      <AppRoot />
    </ConvexProvider>
  )
}

function AppRoot() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const urlJoin = norm(params.get('join') ?? '')
  const urlGame = params.get('game') ?? ''

  const [game, setGame] = useState<GK | null>(() => {
    if (urlGame === 'lip-reading' || urlGame === 'want-will-wont') return urlGame
    const g = sg('cards.selectedGame')
    return (g === 'lip-reading' || g === 'want-will-wont') ? g : null
  })

  // Strip URL params after reading so they don't persist on reload
  useEffect(() => {
    if (urlJoin || urlGame) {
      const u = new URL(window.location.href)
      u.searchParams.delete('join'); u.searchParams.delete('game')
      window.history.replaceState({}, '', u.toString())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { game ? ss('cards.selectedGame', game) : sd('cards.selectedGame') }, [game])
  if (!game) return <Home onSelect={setGame} />
  if (game === 'want-will-wont') return <WWWGame onBack={() => setGame(null)} joinCode={urlJoin} />
  return <LipGame onBack={() => setGame(null)} joinCode={urlJoin} />
}

// ── MICRO COMPONENTS ─────────────────────────────────────────────────────────

function NavLink({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: CSSProperties }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 400, color: S.muted, letterSpacing: '0.08em', textTransform: 'uppercase', position: 'relative', transition: 'color 0.2s ease', ...style }}>
      {children}
      <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: S.muted, transformOrigin: 'left', transform: `scaleX(${hov ? 1 : 0})`, transition: `transform 0.25s ${easeOut}`, display: 'block' }} />
    </button>
  )
}

function Tag({ children, color = S.accent }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color, background: color === S.accent ? S.accentLight : `${color}12`, padding: '3px 8px', borderRadius: 100 }}>
      {children}
    </span>
  )
}

function WaitingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: S.dim, animation: `dotPulse 1.2s ${i * 0.2}s ease-in-out infinite` }} />
      ))}
    </div>
  )
}

function ProgressLine({ value, max, color = S.accent }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ height: 2, background: S.line, borderRadius: 1, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 1, transition: `width 0.6s ${easeOut}` }} />
    </div>
  )
}

function AnimNum({ value, style }: { value: number; style?: CSSProperties }) {
  const [key, setKey] = useState(0)
  const prev = useRef(value)
  useEffect(() => { if (value !== prev.current) { setKey(k => k + 1); prev.current = value } }, [value])
  return <span key={key} style={{ display: 'inline-block', animation: `tickUp 0.3s ${ease} both`, ...style }}>{value}</span>
}

function Card({ children, style, className, onClick }: { children: React.ReactNode; style?: CSSProperties; className?: string; onClick?: () => void }) {
  return (
    <div className={className} onClick={onClick} style={{ background: S.surface, border: `1px solid ${S.line}`, borderRadius: 16, ...style }}>
      {children}
    </div>
  )
}

function Btn({ children, onClick, disabled, variant = 'primary', size = 'md', style }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md' | 'lg'; style?: CSSProperties
}) {
  const h = { sm: 36, md: 44, lg: 52 }
  const fs = { sm: 12, md: 13, lg: 14 }
  const px = { sm: 14, md: 20, lg: 28 }
  const vs = {
    primary: { background: S.ink, color: S.bg },
    secondary: { background: S.soft, color: S.ink },
    ghost: { background: 'transparent', color: S.muted, border: `1px solid ${S.line}` },
  }
  return (
    <button className="sbtn" onClick={onClick} disabled={disabled}
      style={{ height: h[size], padding: `0 ${px[size]}px`, fontSize: fs[size], borderRadius: 10, ...vs[variant], ...style }}>
      {children}
    </button>
  )
}

function Field({ value, onChange, placeholder, maxLength, style, onKeyDown }: { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; style?: CSSProperties; onKeyDown?: (e: React.KeyboardEvent) => void }) {
  const [focus, setFocus] = useState(false)
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onKeyDown={onKeyDown}
      style={{ width: '100%', height: 44, background: focus ? S.surface : S.soft, border: `1px solid ${focus ? S.accent : S.line}`, borderRadius: 10, color: S.ink, padding: '0 14px', boxShadow: focus ? `0 0 0 3px ${S.accentSoft}` : 'none', ...style }} />
  )
}

function Divider({ style, className }: { style?: CSSProperties; className?: string }) {
  return <div className={className} style={{ height: 1, background: S.line, ...style }} />
}

function ErrorNote({ msg }: { msg: string }) {
  return (
    <div className="aFade" style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: S.accent, padding: '10px 12px', background: S.accentLight, borderRadius: 8, marginTop: 12 }}>
      {msg}
    </div>
  )
}

// ── HOME ──────────────────────────────────────────────────────────────────────
function Home({ onSelect }: { onSelect: (g: GK) => void }) {
  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Cormorant Garamond',serif", color: S.ink, padding: '0 24px 100px', maxWidth: 680, margin: '0 auto' }}>
      <div className="a1" style={{ paddingTop: 64, paddingBottom: 48, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: S.muted, marginBottom: 10 }}>Card Games</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 'clamp(48px,10vw,88px)', lineHeight: 0.9, margin: 0, letterSpacing: '-0.02em' }}>
            Many<br /><em>Cards</em>
          </h1>
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.12em', color: S.dim, lineHeight: 1.8 }}>
          Two players<br />One room<br />Endless fun
        </div>
      </div>

      <Divider className="a2" />

      <div className="a3" style={{ display: 'grid', gap: 12, marginTop: 24, marginBottom: 48 }}>
        <Card className="gamecard" style={{ padding: '28px 28px', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }} onClick={() => onSelect('lip-reading')}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <Tag>Game 01</Tag>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 400, fontSize: 34, lineHeight: 1, marginTop: 10, letterSpacing: '-0.01em' }}>Lip Read</div>
            </div>
            <ArrowCircle />
          </div>
          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 300, lineHeight: 1.8, color: S.muted, margin: 0 }}>
            One player mouths words in silence. The other reads their lips and scores points against the clock.
          </p>
          <Divider style={{ marginTop: 20, marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 24 }}>
            {[['2', 'Players'], ['60s', 'Per round'], ['Speed', 'Type']].map(([val, label]) => (
              <div key={label}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: S.ink }}>{val}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: S.muted, letterSpacing: '0.08em', marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="gamecard" style={{ padding: '28px 28px', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }} onClick={() => onSelect('want-will-wont')}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <Tag>Game 02</Tag>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 400, fontSize: 34, lineHeight: 1, marginTop: 10, letterSpacing: '-0.01em' }}>Want / Will / Won't</div>
            </div>
            <ArrowCircle />
          </div>
          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 300, lineHeight: 1.8, color: S.muted, margin: 0 }}>
            Swipe activity cards left, up, or right. Outcomes are revealed when both players have responded.
          </p>
          <Divider style={{ marginTop: 20, marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 24 }}>
            {[['2', 'Players'], ['30', 'Cards'], ['Reveal', 'Type']].map(([val, label]) => (
              <div key={label}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: S.ink }}>{val}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: S.muted, letterSpacing: '0.08em', marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

    </div>
  )
}

function ArrowCircle() {
  const [hov, setHov] = useState(false)
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${hov ? S.accent : S.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: `border-color 0.2s ease, background 0.2s ease`, background: hov ? S.accentLight : 'transparent', flexShrink: 0 }}>
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, color: hov ? S.accent : S.dim, transition: 'color 0.2s ease, transform 0.2s ease', display: 'block', transform: hov ? 'translate(1px,0)' : 'none' }}>→</span>
    </div>
  )
}

// ── SHELL ─────────────────────────────────────────────────────────────────────
function Shell({ title, subtitle, onBack, onExit, children }: { title: string; subtitle?: string; onBack: () => void; onExit: () => void; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Cormorant Garamond',serif", color: S.ink, padding: '0 24px 100px', maxWidth: 680, margin: '0 auto' }}>
      <div className="a1" style={{ paddingTop: 28, paddingBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'sticky', top: 0, background: S.bg, zIndex: 10 }}>
        <NavLink onClick={onBack}>← Back</NavLink>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 400, fontSize: 20, letterSpacing: '-0.01em' }}>{title}</div>
          {subtitle && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.15em', color: S.muted, marginTop: 2 }}>{subtitle}</div>}
        </div>
        <NavLink onClick={onExit}>Leave</NavLink>
      </div>
      <Divider className="a1" />
      <div style={{ paddingTop: 28 }}>{children}</div>
    </div>
  )
}

// ── QR INVITE ────────────────────────────────────────────────────────────────
function QRInvite({ code, game }: { code: string; game: GK }) {
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/?join=${code}&game=${game}`
    : ''
  return (
    <div className="aScale" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{ padding: 16, background: S.surface, borderRadius: 12, border: `1px solid ${S.line}`, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <QRCodeSVG value={url} size={180} bgColor={S.surface} fgColor={S.ink} level="M" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: S.muted, marginBottom: 6 }}>
          Show this to your partner
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 28, letterSpacing: '0.08em', color: S.ink }}>{code}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <WaitingDots />
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '0.1em', color: S.muted }}>Waiting for partner</span>
      </div>
    </div>
  )
}

// ── NAME + READY (host) ───────────────────────────────────────────────────────
function HostEntry({ name, setName, working, feedback, onReady }: {
  name: string; setName: (v: string) => void; working: boolean; feedback: string; onReady: () => void
}) {
  return (
    <Card style={{ padding: '32px 28px' }} className="a2">
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: S.muted, marginBottom: 12 }}>
        Your name
      </div>
      <Field value={name} onChange={setName} placeholder="Enter your name" maxLength={24}
        style={{ marginBottom: 20 }}
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') onReady() }}
      />
      <Btn variant="primary" size="lg" disabled={working || !name.trim()} onClick={onReady} style={{ width: '100%' }}>
        {working ? '...' : 'Ready →'}
      </Btn>
      {feedback && <ErrorNote msg={feedback} />}
    </Card>
  )
}

// ── NAME + JOIN (joiner via QR) ───────────────────────────────────────────────
function JoinEntry({ name, setName, joinCode, working, feedback, onJoin }: {
  name: string; setName: (v: string) => void; joinCode: string; working: boolean; feedback: string; onJoin: () => void
}) {
  return (
    <Card style={{ padding: '32px 28px' }} className="a2">
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: S.muted, marginBottom: 4 }}>
        Joining room
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 32, letterSpacing: '0.06em', color: S.ink, marginBottom: 20 }}>
        {joinCode}
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: S.muted, marginBottom: 12 }}>
        Your name
      </div>
      <Field value={name} onChange={setName} placeholder="Enter your name" maxLength={24}
        style={{ marginBottom: 20 }}
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') onJoin() }}
      />
      <Btn variant="primary" size="lg" disabled={working || !name.trim()} onClick={onJoin} style={{ width: '100%' }}>
        {working ? '...' : 'Join game →'}
      </Btn>
      {feedback && <ErrorNote msg={feedback} />}
    </Card>
  )
}

// ── WANT/WILL/WON'T ───────────────────────────────────────────────────────────
function WWWGame({ onBack, joinCode = '' }: { onBack: () => void; joinCode?: string }) {
  const [token] = useState(getToken)
  const [name, setName] = useState(() => sg('cards.name') ?? '')
  const [activeCode, setActiveCode] = useState(() => sg('cards.www.room') ?? '')
  const [working, setWorking] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [outcome, setOutcome] = useState<{ text: string; match: boolean; my: string; their: string } | null>(null)

  const createSession = useMutation(api.wantWillWont.createSession)
  const joinSession = useMutation(api.wantWillWont.joinSession)
  const leaveSession = useMutation(api.wantWillWont.leaveSession)
  const heartbeatPresence = useMutation(api.wantWillWont.heartbeatPresence)
  const submitSwipe = useMutation(api.wantWillWont.submitSwipe)
  const resetRound = useMutation(api.wantWillWont.resetRound)
  const ensureCards = useMutation(api.wantWillWont.ensureCardsInitialized)

  const code = norm(activeCode)
  const state = useQuery(api.wantWillWont.getState, code && token ? { code, playerToken: token } : 'skip')

  useEffect(() => { if (name) ss('cards.name', name) }, [name])
  useEffect(() => { code ? ss('cards.www.room', code) : sd('cards.www.room') }, [code])
  useEffect(() => { void ensureCards({}).catch(() => {}) }, [ensureCards])
  useEffect(() => {
    if (!state?.session.id || !code) return
    const id = state.session.id
    const ping = () => void heartbeatPresence({ sessionId: id, playerToken: token }).catch(() => {})
    ping(); const t = setInterval(ping, 8000); return () => clearInterval(t)
  }, [state?.session.id, code, token, heartbeatPresence])
  useEffect(() => { if (code && state === null) { setFeedback('Session not found.'); setActiveCode(''); sd('cards.www.room') } }, [code, state])

  const onLeave = () => { const c = code; setActiveCode(''); sd('cards.www.room'); if (c) void leaveSession({ code: c, playerToken: token }).catch(() => {}) }

  const onSwipe = async (decision: 'want' | 'will' | 'wont') => {
    if (!code || !state?.activeCardId) return
    const cardText = state.activeCardText ?? ''
    setWorking(true)
    try {
      const r = await submitSwipe({ code, playerToken: token, decision })
      if (r.outcome) {
        setOutcome({ text: cardText, match: r.outcome.isMatch, my: r.outcome.myDecision, their: r.outcome.otherDecision })
        setTimeout(() => setOutcome(null), 4000)
      }
    } catch (e) { setFeedback(em(e)) } finally { setWorking(false) }
  }

  const me = state?.me
  const other = state?.players.find(p => !p.isMe) ?? null
  const canSwipe = !!state && !!me && !me.done && !!state.activeCardId
  const playerCount = state?.players?.length ?? 0

  // ── No room yet: host entry or joiner entry ──
  if (!code) {
    if (joinCode) {
      return (
        <Shell title="Want / Will / Won't" onBack={onBack} onExit={onBack}>
          <JoinEntry name={name} setName={setName} joinCode={joinCode} working={working} feedback={feedback}
            onJoin={async () => {
              if (!name.trim()) { setFeedback('Please enter your name.'); return }
              setWorking(true); setFeedback('')
              try { const r = await joinSession({ code: joinCode, name: name.trim(), playerToken: token }); setActiveCode(r.code) }
              catch (e) { setFeedback(em(e)) } finally { setWorking(false) }
            }} />
        </Shell>
      )
    }
    return (
      <Shell title="Want / Will / Won't" onBack={onBack} onExit={onBack}>
        <HostEntry name={name} setName={setName} working={working} feedback={feedback}
          onReady={async () => {
            if (!name.trim()) { setFeedback('Please enter your name.'); return }
            setWorking(true); setFeedback('')
            try { const r = await createSession({ name: name.trim(), playerToken: token }); setActiveCode(r.code) }
            catch (e) { setFeedback(em(e)) } finally { setWorking(false) }
          }} />
      </Shell>
    )
  }

  // ── Has room but waiting for partner: show QR ──
  if (playerCount < 2 && state) {
    return (
      <Shell title="Want / Will / Won't" subtitle={`Room · ${code}`} onBack={onBack} onExit={onLeave}>
        <div style={{ paddingTop: 24 }} className="a2">
          <QRInvite code={code} game="want-will-wont" />
        </div>
      </Shell>
    )
  }

  return (
    <Shell title="Want / Will / Won't" subtitle={`Room · ${code}`} onBack={onBack} onExit={onLeave}>
      {/* Progress */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }} className="a2">
        {[
          { label: 'You', pName: me?.name ?? '—', cur: me?.deckCursor ?? 0, total: me?.totalCards ?? 0 },
          { label: 'Partner', pName: other?.name ?? '—', cur: other?.deckCursor ?? 0, total: other?.totalCards ?? 0 },
        ].map(p => (
          <Card key={p.label} style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.muted }}>{p.label}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: S.muted }}>
                <AnimNum value={p.cur} /> <span style={{ color: S.dim }}>/ {p.total}</span>
              </div>
            </div>
            <ProgressLine value={p.cur} max={p.total} />
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 400, fontSize: 16, color: S.ink, marginTop: 8 }}>{p.pName}</div>
          </Card>
        ))}
      </div>

      {/* Active card */}
      <Card style={{ padding: '48px 32px', marginBottom: 16, minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }} className="a3">
        {!state ? <WaitingDots />
          : me?.done ? (
            <div className="aScale">
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: S.muted, marginBottom: 12 }}>
                {state.allDone ? 'Session complete' : 'Waiting for partner'}
              </div>
              {state.allDone
                ? <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 32 }}>All cards reviewed.</div>
                : <WaitingDots />}
            </div>
          ) : (
            <div className="aScale" key={state.activeCardId as string}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: S.dim, marginBottom: 20 }}>Activity card</div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 'clamp(24px,5vw,48px)', lineHeight: 1.2, color: S.ink, maxWidth: 420 }}>
                {state.activeCardText ?? 'Stand by...'}
              </div>
            </div>
          )}
      </Card>

      {/* Gesture legend — shown only during active swiping */}
      {!me?.done && canSwipe && (
        <div className="aFade" style={{ display: 'flex', gap: 0, overflow: 'hidden', borderRadius: 12, border: `1px solid ${S.line}`, marginBottom: 12 }}>
          {[['←', "Won't", 0], ['↑', 'Want', 1], ['→', 'Will', 2]].map(([dir, label, i]) => (
            <div key={String(label)} style={{ flex: 1, padding: '12px', borderRight: Number(i) < 2 ? `1px solid ${S.line}` : 'none', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 20, color: S.ink }}>{dir}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.muted, marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Outcome toast */}
      {outcome && (
        <div className="aPop" style={{ marginBottom: 16, padding: '16px 20px', borderRadius: 12, background: outcome.match ? '#F0F9F4' : S.soft, border: `1px solid ${outcome.match ? '#C6E8D2' : S.line}`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: outcome.match ? '#3D9A60' : S.dim, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 400, fontSize: 18, color: outcome.match ? '#2A7048' : S.ink }}>
              {outcome.match ? 'Match!' : 'No match'}
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.08em', color: S.muted, marginTop: 2 }}>
              You: {outcome.my} · Them: {outcome.their} · {outcome.text}
            </div>
          </div>
        </div>
      )}

      {/* Swipe buttons */}
      {!me?.done && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }} className="a4">
          {[
            { d: 'wont' as const, label: "Won't", dir: '←', bg: S.soft, color: S.ink },
            { d: 'want' as const, label: 'Want', dir: '↑', bg: S.accentLight, color: S.accent },
            { d: 'will' as const, label: 'Will', dir: '→', bg: S.soft, color: S.ink },
          ].map(({ d, label, dir, bg, color }) => (
            <button key={d} className="swipebtn" disabled={!canSwipe || working} onClick={() => void onSwipe(d)} style={{
              height: 72, background: bg, color, border: `1px solid ${color === S.accent ? S.accentSoft : S.line}`, borderRadius: 12,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 300, lineHeight: 1 }}>{dir}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {working ? '...' : label}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Results log */}
      {(state?.outcomes?.length ?? 0) > 0 && (
        <Card style={{ overflow: 'hidden' }} className="a5">
          <div style={{ padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: S.muted }}>Results</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: S.dim }}>{state?.outcomes?.filter(o => o.isMatch).length ?? 0} matches</div>
          </div>
          <Divider />
          {state!.outcomes.slice(0, 6).map((o, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 20px', borderBottom: i < Math.min(state!.outcomes.length, 6) - 1 ? `1px solid ${S.line}` : 'none' }}>
              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 400, fontSize: 16 }}>{o.cardText}</span>
              <Tag color={o.isMatch ? '#3D9A60' : S.dim}>{o.isMatch ? 'match' : 'miss'}</Tag>
            </div>
          ))}
          {state?.allDone && state.me.isHost && (
            <div style={{ padding: '16px 20px' }}>
              <Btn variant="secondary" size="md" onClick={async () => { try { await resetRound({ code, playerToken: token }) } catch (e) { setFeedback(em(e)) } }} style={{ width: '100%' }}>Play again</Btn>
            </div>
          )}
        </Card>
      )}

      {feedback && <ErrorNote msg={feedback} />}
    </Shell>
  )
}

// ── LIP READ ─────────────────────────────────────────────────────────────────
function LipGame({ onBack, joinCode = '' }: { onBack: () => void; joinCode?: string }) {
  const [token] = useState(getToken)
  const [name, setName] = useState(() => sg('cards.name') ?? '')
  const [activeCode, setActiveCode] = useState(() => sg('cards.lip.room') ?? '')
  const [working, setWorking] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [now, setNow] = useState(Date.now())

  const createSession = useMutation(api.lipReading.createSession)
  const joinSession = useMutation(api.lipReading.joinSession)
  const leaveSession = useMutation(api.lipReading.leaveSession)
  const heartbeatPresence = useMutation(api.lipReading.heartbeatPresence)
  const startRound = useMutation(api.lipReading.startRound)
  const markCardResult = useMutation(api.lipReading.markCardResult)
  const ensureCards = useMutation(api.lipReading.ensureCardsInitialized)

  const code = norm(activeCode)
  const state = useQuery(api.lipReading.getState, code && token ? { code, playerToken: token } : 'skip')

  useEffect(() => { void ensureCards({}).catch(() => {}) }, [ensureCards])
  useEffect(() => { if (name) ss('cards.name', name) }, [name])
  useEffect(() => { code ? ss('cards.lip.room', code) : sd('cards.lip.room') }, [code])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [])
  useEffect(() => {
    if (!state?.session?.id || !code) return
    const id = state.session.id
    const ping = () => void heartbeatPresence({ sessionId: id, playerToken: token }).catch(() => {})
    ping(); const t = setInterval(ping, 8000); return () => clearInterval(t)
  }, [state?.session?.id, code, token, heartbeatPresence])
  useEffect(() => { if (code && state === null) { setFeedback('Session not found.'); setActiveCode(''); sd('cards.lip.room') } }, [code, state])

  const onLeave = () => { const c = code; setActiveCode(''); sd('cards.lip.room'); if (c) void leaveSession({ code: c, playerToken: token }).catch(() => {}) }

  const players = state?.players ?? []
  const sess = state?.session
  const isMyTurn = sess?.turnToken === token
  const timeLeft = sess?.roundEndsAt ? Math.max(0, Math.ceil((sess.roundEndsAt - now) / 1000)) : null
  const urgent = timeLeft !== null && timeLeft <= 10

  if (!code) {
    if (joinCode) {
      return (
        <Shell title="Lip Read" onBack={onBack} onExit={onBack}>
          <JoinEntry name={name} setName={setName} joinCode={joinCode} working={working} feedback={feedback}
            onJoin={async () => {
              if (!name.trim()) { setFeedback('Please enter your name.'); return }
              setWorking(true); setFeedback('')
              try { const r = await joinSession({ code: joinCode, name: name.trim(), playerToken: token }); setActiveCode(r.code) }
              catch (e) { setFeedback(em(e)) } finally { setWorking(false) }
            }} />
        </Shell>
      )
    }
    return (
      <Shell title="Lip Read" onBack={onBack} onExit={onBack}>
        <HostEntry name={name} setName={setName} working={working} feedback={feedback}
          onReady={async () => {
            if (!name.trim()) { setFeedback('Please enter your name.'); return }
            setWorking(true); setFeedback('')
            try { const r = await createSession({ name: name.trim(), playerToken: token }); setActiveCode(r.code) }
            catch (e) { setFeedback(em(e)) } finally { setWorking(false) }
          }} />
      </Shell>
    )
  }

  // Waiting for partner: show QR
  if (players.length < 2 && state) {
    return (
      <Shell title="Lip Read" subtitle={`Room · ${code}`} onBack={onBack} onExit={onLeave}>
        <div style={{ paddingTop: 24 }} className="a2">
          <QRInvite code={code} game="lip-reading" />
        </div>
      </Shell>
    )
  }

  return (
    <Shell title="Lip Read" subtitle={`Room · ${code}`} onBack={onBack} onExit={onLeave}>
      {/* Scores */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }} className="a2">
        {players.map(p => (
          <Card key={p.token} style={{ flex: 1, minWidth: 130, padding: '18px 20px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.muted, marginBottom: 6 }}>
              {p.token === token ? 'You' : 'Opponent'}
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 52, lineHeight: 1, color: p.token === token ? S.accent : S.ink }}>
              <AnimNum value={p.score} />
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: S.muted, marginTop: 4 }}>{p.name}</div>
          </Card>
        ))}
      </div>

      {/* Timer bar */}
      {timeLeft !== null && sess?.phase === 'round' && (
        <div className="a3" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.muted }}>Time</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: urgent ? S.accent : S.ink, transition: 'color 0.5s ease' }}>{timeLeft}s</span>
          </div>
          <ProgressLine value={timeLeft} max={60} color={urgent ? S.accent : S.ink} />
        </div>
      )}

      {/* Game card */}
      <Card style={{
        padding: '48px 32px', marginBottom: 16, minHeight: 240,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        transition: `background 0.4s ease, border-color 0.4s ease`,
        background: urgent ? '#FFF8F5' : S.surface, borderColor: urgent ? '#F0CEC2' : S.line,
      }} className="a3">
        {!sess ? <WaitingDots />
          : sess.phase === 'lobby' ? (
            <div className="aScale">
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: S.muted, marginBottom: 16 }}>
                {players.length < 2 ? 'Waiting for player 2' : 'Both players ready'}
              </div>
              {players.length < 2 ? <WaitingDots />
                : state?.me?.isHost
                ? <Btn variant="primary" size="lg" onClick={async () => { try { await startRound({ code, playerToken: token }) } catch (e) { setFeedback(em(e)) } }}>Start round</Btn>
                : <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontStyle: 'italic', fontSize: 20, color: S.muted }}>Waiting for host...</div>}
            </div>
          ) : sess.phase === 'round' ? (
            <div className="aScale" key={sess.phase}>
              {isMyTurn ? (
                <>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: urgent ? S.accent : S.muted, marginBottom: 20, transition: 'color 0.4s ease' }}>
                    Mouth this — no sound
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 'clamp(36px,7vw,72px)', lineHeight: 1.1, color: urgent ? S.accent : S.ink, transition: 'color 0.4s ease', marginBottom: 32 }}>
                    {state?.activeCardText ?? ''}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Btn variant="primary" size="lg" onClick={async () => { try { await markCardResult({ code, playerToken: token, result: 'correct' }) } catch (e) { setFeedback(em(e)) } }}>Correct</Btn>
                    <Btn variant="ghost" size="lg" onClick={async () => { try { await markCardResult({ code, playerToken: token, result: 'skip' }) } catch (e) { setFeedback(em(e)) } }}>Skip</Btn>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: S.muted, marginBottom: 20 }}>
                    Watch & lip read
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontStyle: 'italic', fontSize: 28, color: S.muted }}>
                    Your partner is mouthing a word...
                  </div>
                  <div style={{ marginTop: 24 }}><WaitingDots /></div>
                </>
              )}
            </div>
          ) : (
            <div className="aScale" key="done">
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: S.muted, marginBottom: 12 }}>Round complete</div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 36, marginBottom: 8 }}>
                {[...players].sort((a, b) => b.score - a.score)[0]?.name ?? '?'} is leading
              </div>
              {state?.me?.isHost && (
                <Btn variant="secondary" size="lg" onClick={async () => { try { await startRound({ code, playerToken: token }) } catch (e) { setFeedback(em(e)) } }} style={{ marginTop: 8 }}>Next round</Btn>
              )}
            </div>
          )}
      </Card>

      {feedback && <ErrorNote msg={feedback} />}
    </Shell>
  )
}
