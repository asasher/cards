// ROUTE / — STUDIO: Tasteful minimalist with rich micro-animations
import { createFileRoute } from '@tanstack/react-router'
import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { QRCodeSVG } from 'qrcode.react'

import { api } from '../../convex/_generated/api'
import { persistPlayerName, resolveInitialPlayerName } from '../lib/lipReadName'

export const Route = createFileRoute('/')({ ssr: false, component: ManyCardsHome })

const PLAYER_TOKEN_STORAGE_KEY = 'cards.lipread.playerToken'
const LIP_ROOM_STORAGE_KEY = 'cards.lip.room'
const SELECTED_GAME_STORAGE_KEY = 'cards.selectedGame'
const GAME_QUERY_PARAM = 'game'
const JOIN_QUERY_PARAM = 'join'
const LEGACY_ROOM_QUERY_PARAM = 'room'

let _convexClient: ConvexReactClient | null = null

function gc() {
  const url = import.meta.env.VITE_CONVEX_URL
  if (!url) {
    return null
  }

  return (_convexClient ??= new ConvexReactClient(url))
}

function sg(key: string) {
  return typeof window !== 'undefined' ? localStorage.getItem(key) : null
}

function ss(key: string, value: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value)
  }
}

function sd(key: string) {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(key)
  }
}

function getToken() {
  const existing = sg(PLAYER_TOKEN_STORAGE_KEY)
  if (existing && existing.length >= 8) {
    return existing
  }

  const token =
    crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  ss(PLAYER_TOKEN_STORAGE_KEY, token)
  return token
}

function norm(value: string) {
  return value.trim().toUpperCase()
}

function em(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

type GK = 'lip-reading' | 'want-will-wont'

function isGameKey(value: string | null): value is GK {
  return value === 'lip-reading' || value === 'want-will-wont'
}

export function resolveInitialRoomInput(
  storageGet: (key: string) => string | null = sg,
  locationSearch = typeof window === 'undefined' ? '' : window.location.search,
) {
  const searchParams = new URLSearchParams(locationSearch)
  const roomFromSearch =
    searchParams.get(JOIN_QUERY_PARAM) ?? searchParams.get(LEGACY_ROOM_QUERY_PARAM)

  if (roomFromSearch && roomFromSearch.trim()) {
    return norm(roomFromSearch)
  }

  return storageGet(LIP_ROOM_STORAGE_KEY) ?? ''
}

export function resolveInitialGame(
  storageGet: (key: string) => string | null = sg,
  locationSearch = typeof window === 'undefined' ? '' : window.location.search,
) {
  const searchGame = new URLSearchParams(locationSearch).get(GAME_QUERY_PARAM)
  if (isGameKey(searchGame)) {
    return searchGame
  }

  const storedGame = storageGet(SELECTED_GAME_STORAGE_KEY)
  return isGameKey(storedGame) ? storedGame : null
}

export function buildInviteUrl(
  code: string,
  game: GK = 'lip-reading',
  currentLocation: Pick<Location, 'href'> | null =
    typeof window === 'undefined' ? null : window.location,
) {
  const normalizedCode = norm(code)
  if (!normalizedCode) {
    return ''
  }

  if (!currentLocation) {
    return `/?${JOIN_QUERY_PARAM}=${normalizedCode}&${GAME_QUERY_PARAM}=${game}`
  }

  const inviteUrl = new URL(currentLocation.href)
  inviteUrl.searchParams.set(JOIN_QUERY_PARAM, normalizedCode)
  inviteUrl.searchParams.set(GAME_QUERY_PARAM, game)
  return inviteUrl.toString()
}

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
const WWW_SWIPE_THRESHOLD = 48

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
  const urlGame = params.get(GAME_QUERY_PARAM) ?? ''

  const [game, setGame] = useState<GK | null>(() => resolveInitialGame())

  // Strip URL params after reading so they don't persist on reload
  useEffect(() => {
    if (urlJoin || urlGame) {
      const u = new URL(window.location.href)
      u.searchParams.delete('join'); u.searchParams.delete('game')
      window.history.replaceState({}, '', u.toString())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { game ? ss(SELECTED_GAME_STORAGE_KEY, game) : sd(SELECTED_GAME_STORAGE_KEY) }, [game])
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
  const inviteUrl = buildInviteUrl(code, game)
  return (
    <div className="aScale" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{ padding: 16, background: S.surface, borderRadius: 12, border: `1px solid ${S.line}`, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <QRCodeSVG value={inviteUrl || code} size={180} bgColor={S.surface} fgColor={S.ink} level="M" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: S.muted, marginBottom: 6 }}>
          Show this to your partner
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 28, letterSpacing: '0.08em', color: S.ink }}>{code}</div>
      </div>
      {inviteUrl ? (
        <div style={{ maxWidth: 320, textAlign: 'center' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, lineHeight: 1.7, color: S.muted, marginBottom: 8 }}>
            Scan this QR or open the share link on another phone to join the same room.
          </div>
          <a href={inviteUrl} aria-label="Join room via share link" style={{ display: 'block', fontFamily: "'DM Mono',monospace", fontSize: 11, lineHeight: 1.7, color: S.accent, wordBreak: 'break-word' }}>
            {inviteUrl}
          </a>
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <WaitingDots />
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '0.1em', color: S.muted }}>Waiting for partner</span>
      </div>
    </div>
  )
}

type CombinedEntryPanelProps = {
  name: string
  roomInput: string
  roomCode: string
  inviteUrl: string
  feedback: string
  joinedName: string
  inviteStatus: string
  playersCount: number
  workingAction: string
  nameChangesApplyNextTime: boolean
  onNameChange: (value: string) => void
  onRoomInputChange: (value: string) => void
  onCreate: () => void
  onJoin: () => void
  onLeaveRoom: () => void
}

export function CombinedEntryPanel({
  name,
  roomInput,
  roomCode,
  inviteUrl,
  feedback,
  joinedName,
  inviteStatus,
  playersCount,
  workingAction,
  nameChangesApplyNextTime,
  onNameChange,
  onRoomInputChange,
  onCreate,
  onJoin,
  onLeaveRoom,
}: CombinedEntryPanelProps) {
  const hasInvite = roomCode.length > 0

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: hasInvite ? 'minmax(0, 1fr) minmax(260px, 320px)' : '1fr', alignItems: 'start' }}>
      <Card style={{ padding: '28px 24px' }} className="a2">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: S.muted, marginBottom: 6 }}>
              Lip Read
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 400, fontSize: 34, lineHeight: 1 }}>
              {hasInvite ? 'Invite or wait' : 'Create or join'}
            </div>
          </div>
          {hasInvite ? <Tag>{playersCount}/2 players</Tag> : null}
        </div>

        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: S.muted, marginBottom: 12 }}>
          Your name
        </div>
        <Field value={name} onChange={onNameChange} placeholder="Player name" maxLength={24} style={{ marginBottom: 18 }} />

        {hasInvite ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <Tag>{inviteStatus}</Tag>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: S.muted }}>
                Room {roomCode}
              </span>
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, lineHeight: 1.1, marginBottom: 8 }}>
              {joinedName ? `${joinedName} is ready.` : 'Waiting in room.'}
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, lineHeight: 1.7, color: S.muted, marginBottom: 18 }}>
              Keep this screen open while your partner joins from the QR or share link.
            </div>
            {nameChangesApplyNextTime ? (
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, lineHeight: 1.7, color: S.muted, marginBottom: 18 }}>
                Name changes here will apply the next time you create or join a room.
              </div>
            ) : null}
            <Btn variant="secondary" size="lg" disabled={workingAction === 'leave'} onClick={onLeaveRoom} style={{ width: '100%' }}>
              {workingAction === 'leave' ? 'Leaving…' : 'Exit room'}
            </Btn>
          </>
        ) : (
          <>
            <Btn variant="primary" size="lg" disabled={workingAction === 'create'} onClick={onCreate} style={{ width: '100%', marginBottom: 18 }}>
              {workingAction === 'create' ? 'Creating…' : 'Create room'}
            </Btn>

            <Divider style={{ marginBottom: 18 }} />

            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: S.muted, marginBottom: 12 }}>
              Join with a code
            </div>
            <Field value={roomInput} onChange={(value) => onRoomInputChange(norm(value))} placeholder="Enter room code" maxLength={8} style={{ marginBottom: 14 }} />
            <Btn variant="secondary" size="lg" disabled={workingAction === 'join'} onClick={onJoin} style={{ width: '100%' }}>
              {workingAction === 'join' ? 'Joining…' : 'Join with code'}
            </Btn>
          </>
        )}

        {feedback ? <ErrorNote msg={feedback} /> : null}
      </Card>

      {hasInvite ? (
        <Card style={{ padding: '24px 22px' }} className="a3">
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: S.muted, marginBottom: 8 }}>
            Invite a friend
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 34, lineHeight: 1, color: S.ink, marginBottom: 10 }}>
            {roomCode}
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, lineHeight: 1.7, color: S.muted, marginBottom: 16 }}>
            Scan this QR or open the share link on another phone to join the same Lip Read room.
          </div>
          <div aria-label="Join room QR" style={{ display: 'flex', justifyContent: 'center', padding: 16, borderRadius: 12, border: `1px solid ${S.line}`, background: S.soft, marginBottom: 14 }}>
            <QRCodeSVG value={inviteUrl || roomCode} size={180} bgColor={S.soft} fgColor={S.ink} level="M" />
          </div>
          <a href={inviteUrl} aria-label="Join room via share link" style={{ display: 'block', fontFamily: "'DM Mono',monospace", fontSize: 11, lineHeight: 1.7, color: S.accent, wordBreak: 'break-word' }}>
            {inviteUrl}
          </a>
        </Card>
      ) : null}
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
export type WWWSwipeDecision = 'want' | 'will' | 'wont'

export function resolveWWWSwipeDecision(
  deltaX: number,
  deltaY: number,
  threshold = WWW_SWIPE_THRESHOLD,
): WWWSwipeDecision | null {
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  if (absX < threshold && absY < threshold) {
    return null
  }

  if (absY > absX) {
    return deltaY <= -threshold ? 'want' : null
  }

  if (deltaX <= -threshold) {
    return 'wont'
  }

  if (deltaX >= threshold) {
    return 'will'
  }

  return null
}

export function resolveWWWSwipeSubmission(
  canSwipe: boolean,
  deltaX: number,
  deltaY: number,
  threshold = WWW_SWIPE_THRESHOLD,
): WWWSwipeDecision | null {
  if (!canSwipe) {
    return null
  }

  return resolveWWWSwipeDecision(deltaX, deltaY, threshold)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function softClamp(value: number, limit: number, overshootFactor = 0.35) {
  if (Math.abs(value) <= limit) {
    return value
  }

  return Math.sign(value) * (limit + (Math.abs(value) - limit) * overshootFactor)
}

export function resolveWWWSwipePreviewDecision(
  deltaX: number,
  deltaY: number,
  previewThreshold = 8,
): WWWSwipeDecision | null {
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  if (absX < previewThreshold && absY < previewThreshold) {
    return null
  }

  if (absY > absX) {
    return deltaY <= -previewThreshold ? 'want' : null
  }

  if (deltaX <= -previewThreshold) {
    return 'wont'
  }

  if (deltaX >= previewThreshold) {
    return 'will'
  }

  return null
}

export function getWWWSwipeFeedback(
  deltaX: number,
  deltaY: number,
  threshold = WWW_SWIPE_THRESHOLD,
) {
  const previewDecision = resolveWWWSwipePreviewDecision(deltaX, deltaY)
  const committedDecision = resolveWWWSwipeDecision(deltaX, deltaY, threshold)
  const dominantDistance = previewDecision === 'want' ? Math.abs(Math.min(deltaY, 0)) : Math.abs(deltaX)
  const progress = clamp(dominantDistance / threshold, 0, 1)

  return {
    previewDecision,
    committedDecision,
    cue:
      previewDecision === 'wont'
        ? "← Won't"
        : previewDecision === 'want'
          ? '↑ Want'
          : previewDecision === 'will'
            ? '→ Will'
            : null,
    progress,
    translateX: softClamp(deltaX, 220),
    translateY: deltaY < 0 ? softClamp(deltaY, 220) : softClamp(deltaY, 96, 0.25),
    rotate: clamp(deltaX / 9, -14, 14),
    scale: 1 - progress * 0.04,
    opacity: 1 - progress * 0.06,
  }
}

const WWW_DECISION_OPTIONS = [
  { decision: 'wont' as const, label: "Won't", direction: '←', background: S.soft, color: S.ink },
  { decision: 'want' as const, label: 'Want', direction: '↑', background: S.accentLight, color: S.accent },
  { decision: 'will' as const, label: 'Will', direction: '→', background: S.soft, color: S.ink },
]

export function WWWDecisionControls({
  canSubmitDecision,
  showHint,
  working,
  onDecision,
}: {
  canSubmitDecision: boolean
  showHint: boolean
  working: boolean
  onDecision: (decision: WWWSwipeDecision) => void
}) {
  return (
    <div style={{ marginBottom: 20 }} className="a4">
      {showHint && (
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.08em', color: S.muted, marginBottom: 12, textAlign: 'center' }}>
          Swipe the card, or tap a choice below.
        </div>
      )}

      <div role="group" aria-label="Decision choices" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {WWW_DECISION_OPTIONS.map(({ decision, label, direction, background, color }) => (
          <button key={decision} className="swipebtn" disabled={!canSubmitDecision} onClick={() => onDecision(decision)} style={{
            height: 72, background, color, border: `1px solid ${color === S.accent ? S.accentSoft : S.line}`, borderRadius: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 300, lineHeight: 1 }}>{direction}</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {working ? '...' : label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function WWWSwipeCardFace({
  activeCardId,
  activeCardText,
  canSwipe,
  dragFeedback,
  isDragging,
}: {
  activeCardId: string
  activeCardText: string
  canSwipe: boolean
  dragFeedback: ReturnType<typeof getWWWSwipeFeedback>
  isDragging: boolean
}) {
  const previewOption = WWW_DECISION_OPTIONS.find(option => option.decision === dragFeedback.previewDecision) ?? null

  return (
    <div className="aScale" key={activeCardId} style={{
      width: '100%',
      maxWidth: 520,
      padding: '32px 28px',
      borderRadius: 18,
      border: `1px solid ${previewOption ? (previewOption.color === S.accent ? S.accentSoft : S.line) : S.line}`,
      background: previewOption ? previewOption.background : S.surface,
      boxShadow: isDragging ? `0 ${18 + dragFeedback.progress * 8}px ${36 + dragFeedback.progress * 12}px rgba(0,0,0,${0.1 + dragFeedback.progress * 0.08})` : '0 8px 24px rgba(0,0,0,0.05)',
      transform: `translate3d(${dragFeedback.translateX}px, ${dragFeedback.translateY}px, 0) rotate(${dragFeedback.rotate}deg) scale(${dragFeedback.scale})`,
      opacity: dragFeedback.opacity,
      willChange: canSwipe ? 'transform, box-shadow, background, border-color, opacity' : undefined,
      transition: isDragging ? 'none' : `transform 0.22s ${ease}, box-shadow 0.22s ease, background 0.22s ease, border-color 0.22s ease, opacity 0.22s ease`,
      position: 'relative',
    }}>
      {dragFeedback.cue && (
        <div className="aFade" style={{
          position: 'absolute',
          top: 14,
          right: 14,
          padding: '6px 10px',
          borderRadius: 999,
          background: S.surface,
          border: `1px solid ${previewOption?.color === S.accent ? S.accentSoft : S.line}`,
          fontFamily: "'DM Mono',monospace",
          fontSize: 10,
          letterSpacing: '0.08em',
          color: previewOption?.color ?? S.muted,
        }}>
          {dragFeedback.cue}
        </div>
      )}
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: S.dim, marginBottom: 20 }}>Activity card</div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 'clamp(24px,5vw,48px)', lineHeight: 1.2, color: S.ink, maxWidth: 420 }}>
        {activeCardText}
      </div>
    </div>
  )
}

export function WWWSwipeActionCard({
  activeCardId,
  activeCardText,
  canSwipe,
  onDecision,
}: {
  activeCardId: string
  activeCardText: string
  canSwipe: boolean
  onDecision: (decision: WWWSwipeDecision) => void
}) {
  const pointerStart = useRef<{ pointerId: number; clientX: number; clientY: number } | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const dragFeedback = getWWWSwipeFeedback(dragOffset.x, dragOffset.y)
  const isDragging = dragOffset.x !== 0 || dragOffset.y !== 0

  const clearPointer = () => {
    pointerStart.current = null
    setDragOffset({ x: 0, y: 0 })
  }

  const releasePointer = (element: HTMLDivElement, pointerId: number) => {
    if (element.hasPointerCapture?.(pointerId)) {
      element.releasePointerCapture?.(pointerId)
    }
  }

  const commitSwipe = (pointerId: number, clientX: number, clientY: number) => {
    const start = pointerStart.current
    if (!start || start.pointerId !== pointerId) {
      return
    }

    clearPointer()

    const decision = resolveWWWSwipeSubmission(canSwipe, clientX - start.clientX, clientY - start.clientY)
    if (decision) {
      onDecision(decision)
    }
  }

  return (
    <div
      aria-disabled={!canSwipe}
      aria-label="Swipe activity card"
      onLostPointerCapture={clearPointer}
      onPointerCancel={(event) => {
        clearPointer()
        releasePointer(event.currentTarget, event.pointerId)
      }}
      onPointerDown={(event) => {
        if (!canSwipe) {
          return
        }

        pointerStart.current = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
        }
        setDragOffset({ x: 0, y: 0 })
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }}
      onPointerMove={(event) => {
        const start = pointerStart.current
        if (!start || start.pointerId !== event.pointerId) {
          return
        }

        setDragOffset({
          x: event.clientX - start.clientX,
          y: event.clientY - start.clientY,
        })
      }}
      onPointerUp={(event) => {
        commitSwipe(event.pointerId, event.clientX, event.clientY)
        releasePointer(event.currentTarget, event.pointerId)
      }}
      style={{ width: '100%', cursor: canSwipe ? (isDragging ? 'grabbing' : 'grab') : 'default', touchAction: canSwipe ? 'none' : 'auto', display: 'flex', justifyContent: 'center' }}
    >
      <WWWSwipeCardFace
        activeCardId={activeCardId}
        activeCardText={activeCardText}
        canSwipe={canSwipe}
        dragFeedback={dragFeedback}
        isDragging={isDragging}
      />
    </div>
  )
}

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

  const me = state?.me
  const other = state?.players.find(p => !p.isMe) ?? null
  const canAct = !!state && !!me && !me.done && !!state.activeCardId
  const canSubmitDecision = canAct && !working
  const playerCount = state?.players?.length ?? 0

  const onSwipe = async (decision: WWWSwipeDecision) => {
    if (!code || !state?.activeCardId || !canSubmitDecision) return
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
            <WWWSwipeActionCard
              activeCardId={String(state.activeCardId)}
              activeCardText={state.activeCardText ?? 'Stand by...'}
              canSwipe={canSubmitDecision}
              onDecision={(decision) => { void onSwipe(decision) }}
            />
          )}
      </Card>

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

      {/* Decision controls */}
      {!me?.done && (
        <WWWDecisionControls
          canSubmitDecision={canSubmitDecision}
          showHint={canAct}
          working={working}
          onDecision={(decision) => { void onSwipe(decision) }}
        />
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
  const [name, setName] = useState(resolveInitialPlayerName)
  const [roomInput, setRoomInput] = useState(() => joinCode || resolveInitialRoomInput())
  const [activeCode, setActiveCode] = useState(() => sg(LIP_ROOM_STORAGE_KEY) ?? '')
  const [workingAction, setWorkingAction] = useState('')
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
  useEffect(() => { persistPlayerName(name) }, [name])
  useEffect(() => { code ? ss(LIP_ROOM_STORAGE_KEY, code) : sd(LIP_ROOM_STORAGE_KEY) }, [code])
  useEffect(() => {
    if (!joinCode) {
      return
    }

    setRoomInput((current) => current || norm(joinCode))
  }, [joinCode])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [])
  useEffect(() => {
    if (!state?.session?.id || !code) return
    const id = state.session.id
    const ping = () => void heartbeatPresence({ sessionId: id, playerToken: token }).catch(() => {})
    ping(); const t = setInterval(ping, 8000); return () => clearInterval(t)
  }, [state?.session?.id, code, token, heartbeatPresence])
  useEffect(() => {
    if (code && state === null) {
      setFeedback('Session not found.')
      setActiveCode('')
      sd(LIP_ROOM_STORAGE_KEY)
    }
  }, [code, state])

  const clearRoom = () => {
    setActiveCode('')
    sd(LIP_ROOM_STORAGE_KEY)
  }

  const onLeaveRoom = async () => {
    const currentCode = code
    clearRoom()
    if (!currentCode) {
      return
    }

    setWorkingAction('leave')
    try {
      await leaveSession({ code: currentCode, playerToken: token })
    } catch (error) {
      setFeedback(em(error))
    } finally {
      setWorkingAction('')
    }
  }

  const players = state?.players ?? []
  const sess = state?.session
  const isMyTurn = sess?.turnToken === token
  const timeLeft = sess?.roundEndsAt ? Math.max(0, Math.ceil((sess.roundEndsAt - now) / 1000)) : null
  const urgent = timeLeft !== null && timeLeft <= 10
  const inviteUrl = useMemo(() => buildInviteUrl(code, 'lip-reading'), [code])
  const showCombinedEntryScreen = !code || players.length < 2
  const joinedName = state?.me?.name ?? name.trim()
  const inviteStatus = players.length === 0 ? 'Setting up room' : 'Waiting for player 2'
  const nameChangesApplyNextTime = Boolean(state?.me?.name && name.trim() && state.me.name !== name.trim())

  const onCreate = async () => {
    if (!name.trim()) {
      setFeedback('Please enter your name.')
      return
    }

    setWorkingAction('create')
    setFeedback('')
    try {
      const result = await createSession({ name: name.trim(), playerToken: token })
      setActiveCode(result.code)
      setRoomInput(result.code)
    } catch (error) {
      setFeedback(em(error))
    } finally {
      setWorkingAction('')
    }
  }

  const onJoin = async () => {
    const normalizedInput = norm(roomInput || joinCode)
    if (!name.trim()) {
      setFeedback('Please enter your name.')
      return
    }
    if (!normalizedInput) {
      setFeedback('Enter a room code.')
      return
    }

    setWorkingAction('join')
    setFeedback('')
    try {
      const result = await joinSession({ code: normalizedInput, name: name.trim(), playerToken: token })
      setActiveCode(result.code)
      setRoomInput(result.code)
    } catch (error) {
      setFeedback(em(error))
    } finally {
      setWorkingAction('')
    }
  }

  if (showCombinedEntryScreen) {
    return (
      <Shell title="Lip Read" subtitle={code ? `Room · ${code}` : undefined} onBack={onBack} onExit={code ? () => { void onLeaveRoom() } : onBack}>
        <CombinedEntryPanel
          name={name}
          roomInput={roomInput}
          roomCode={code}
          inviteUrl={inviteUrl}
          feedback={feedback}
          joinedName={joinedName}
          inviteStatus={inviteStatus}
          playersCount={Math.max(players.length, code ? 1 : 0)}
          workingAction={workingAction}
          nameChangesApplyNextTime={nameChangesApplyNextTime}
          onNameChange={setName}
          onRoomInputChange={setRoomInput}
          onCreate={() => void onCreate()}
          onJoin={() => void onJoin()}
          onLeaveRoom={() => { void onLeaveRoom() }}
        />
      </Shell>
    )
  }

  return (
    <Shell title="Lip Read" subtitle={`Room · ${code}`} onBack={onBack} onExit={() => { void onLeaveRoom() }}>
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
