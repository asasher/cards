import { createFileRoute } from '@tanstack/react-router'
import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/')({
  ssr: false,
  component: LipRead,
})

const NAME_STORAGE_KEY = 'cards.lipread.name'
const PLAYER_TOKEN_STORAGE_KEY = 'cards.lipread.playerToken'
const ROOM_STORAGE_KEY = 'cards.lipread.roomCode'
const HEARTBEAT_INTERVAL_MS = 8_000

const CARD_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  '#A855F7',
  '#FF8E53',
  '#06D6A0',
  '#FF6B9D',
  '#4361EE',
  '#F77F00',
  '#2EC4B6',
  '#E040FB',
  '#00B4D8',
]

let convexClient: ConvexReactClient | null = null

function getConvexClient() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL
  if (!convexUrl) {
    return null
  }

  if (convexClient) {
    return convexClient
  }

  convexClient = new ConvexReactClient(convexUrl)
  return convexClient
}

function safeStorageGet(key: string) {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage.getItem(key)
}

function safeStorageSet(key: string, value: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(key, value)
}

function safeStorageRemove(key: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(key)
}

function getPlayerToken() {
  const existing = safeStorageGet(PLAYER_TOKEN_STORAGE_KEY)
  if (existing && existing.length >= 8) {
    return existing
  }

  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  safeStorageSet(PLAYER_TOKEN_STORAGE_KEY, generated)
  return generated
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase()
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return 'Something went wrong.'
}

function formatSeconds(seconds: number) {
  const clamped = Math.max(0, seconds)
  const mins = Math.floor(clamped / 60)
  const secs = clamped % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function LipRead() {
  const client = getConvexClient()
  if (!client) {
    return <MissingConvexConfig />
  }

  return (
    <ConvexProvider client={client}>
      <LipReadGame />
    </ConvexProvider>
  )
}

function MissingConvexConfig() {
  const pageStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: '#FAFAFA',
    fontFamily: "'Nunito', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }

  return (
    <div style={pageStyle}>
      <div
        style={{
          margin: 'auto',
          width: 'min(420px, 92vw)',
          borderRadius: 20,
          border: '3px solid #222',
          boxShadow: '6px 6px 0 #222',
          background: '#fff',
          padding: 24,
        }}
      >
        <h2 style={{ margin: 0, fontFamily: "'Fredoka One', sans-serif", fontSize: 28 }}>
          Missing `VITE_CONVEX_URL`
        </h2>
        <p style={{ marginBottom: 0, color: '#333' }}>Set the env var and reload.</p>
      </div>
    </div>
  )
}

function LipReadGame() {
  const [playerToken] = useState(getPlayerToken)
  const [name, setName] = useState(() => safeStorageGet(NAME_STORAGE_KEY) ?? '')
  const [roomInput, setRoomInput] = useState(() => safeStorageGet(ROOM_STORAGE_KEY) ?? '')
  const [activeCode, setActiveCode] = useState(() => safeStorageGet(ROOM_STORAGE_KEY) ?? '')
  const [durationSeconds, setDurationSeconds] = useState(60)
  const [cardDraft, setCardDraft] = useState('')
  const [feedback, setFeedback] = useState('')
  const [workingAction, setWorkingAction] = useState('')
  const [now, setNow] = useState(Date.now())
  const [sparkles, setSparkles] = useState<
    Array<{ id: number; x: number; y: number; color: string; tx: string; ty: string }>
  >([])
  const [showCardsPanel, setShowCardsPanel] = useState(false)
  const endingRoundRef = useRef(false)

  const createSession = useMutation(api.lipReading.createSession)
  const joinSession = useMutation(api.lipReading.joinSession)
  const leaveSession = useMutation(api.lipReading.leaveSession)
  const ensureCardsInitialized = useMutation(api.lipReading.ensureCardsInitialized)
  const heartbeatPresence = useMutation(api.lipReading.heartbeatPresence)
  const addCard = useMutation(api.lipReading.addCard)
  const deleteCard = useMutation(api.lipReading.deleteCard)
  const startRound = useMutation(api.lipReading.startRound).withOptimisticUpdate(
    (localStore, args) => {
      const state = localStore.getQuery(api.lipReading.getState, {
        code: args.code,
        playerToken: args.playerToken,
      })
      if (!state) {
        return
      }

      const optimisticDurationSeconds = Math.max(
        20,
        Math.min(180, Math.floor(args.durationSeconds ?? state.session.roundDurationSeconds)),
      )
      const nowMs = Date.now()

      localStore.setQuery(
        api.lipReading.getState,
        { code: args.code, playerToken: args.playerToken },
        {
          ...state,
          session: {
            ...state.session,
            phase: 'round',
            roundNumber: state.session.roundNumber + 1,
            roundDurationSeconds: optimisticDurationSeconds,
            roundEndsAt: nowMs + optimisticDurationSeconds * 1000,
            deckCursor: 0,
          },
          activeCardId: state.session.deckCardIds[0] ?? null,
          activeCardText: null,
          roundExpired: false,
        },
      )
    },
  )
  const markCardResult = useMutation(api.lipReading.markCardResult).withOptimisticUpdate(
    (localStore, args) => {
      const state = localStore.getQuery(api.lipReading.getState, {
        code: args.code,
        playerToken: args.playerToken,
      })
      if (
        !state ||
        state.session.phase !== 'round' ||
        state.session.turnToken !== args.playerToken ||
        state.session.deckCardIds.length === 0
      ) {
        return
      }

      const nextCursor = state.session.deckCursor + 1
      const isDeckComplete = nextCursor >= state.session.deckCardIds.length
      const guesserToken =
        args.result === 'correct'
          ? state.players.find((player) => player.token !== state.session.turnToken)?.token ?? null
          : null
      const optimisticPlayers =
        guesserToken === null
          ? state.players
          : state.players.map((player) =>
              player.token === guesserToken
                ? { ...player, score: player.score + 1 }
                : player,
            )
      const optimisticMe =
        !state.me || guesserToken === null || state.me.token !== guesserToken
          ? state.me
          : { ...state.me, score: state.me.score + 1 }

      if (isDeckComplete) {
        const nextTurnToken =
          state.players.find((player) => player.token !== state.session.turnToken)?.token ??
          state.session.turnToken

        localStore.setQuery(
          api.lipReading.getState,
          { code: args.code, playerToken: args.playerToken },
          {
            ...state,
            session: {
              ...state.session,
              phase: 'round_over',
              turnToken: nextTurnToken,
              roundEndsAt: null,
              deckCardIds: [],
              deckCursor: 0,
            },
            players: optimisticPlayers.map((player) => ({
              ...player,
              isTurn: player.token === nextTurnToken,
              isGuesser: false,
            })),
            me: optimisticMe
              ? {
                  ...optimisticMe,
                  isTurn: optimisticMe.token === nextTurnToken,
                  isGuesser: false,
                }
              : null,
            activeCardId: null,
            activeCardText: null,
            roundExpired: false,
          },
        )
        return
      }

      localStore.setQuery(
        api.lipReading.getState,
        { code: args.code, playerToken: args.playerToken },
        {
          ...state,
          session: {
            ...state.session,
            deckCursor: nextCursor,
          },
          players: optimisticPlayers,
          me: optimisticMe,
          activeCardId: state.session.deckCardIds[nextCursor] ?? null,
          activeCardText: null,
          roundExpired: false,
        },
      )
    },
  )
  const endRound = useMutation(api.lipReading.endRound)
  const resetScores = useMutation(api.lipReading.resetScores).withOptimisticUpdate(
    (localStore, args) => {
      const state = localStore.getQuery(api.lipReading.getState, {
        code: args.code,
        playerToken: args.playerToken,
      })
      if (!state) {
        return
      }

      localStore.setQuery(
        api.lipReading.getState,
        { code: args.code, playerToken: args.playerToken },
        {
          ...state,
          players: state.players.map((player) => ({ ...player, score: 0 })),
          me: state.me ? { ...state.me, score: 0 } : null,
        },
      )
    },
  )
  const roomCode = useMemo(() => normalizeCode(activeCode), [activeCode])
  const shouldLoadCards = showCardsPanel || roomCode.length > 0
  const sharedCards = useQuery(api.lipReading.listCards, shouldLoadCards ? {} : 'skip')
  const canQueryRoom = roomCode.length > 0 && playerToken.length > 0
  const state = useQuery(
    api.lipReading.getState,
    canQueryRoom ? { code: roomCode, playerToken } : 'skip',
  )

  const me = state?.me ?? null
  const players = state?.players ?? []
  const cards = sharedCards ?? []
  const cardsById = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards],
  )
  const [myPlayer, otherPlayer] = useMemo(() => {
    const mine = players.find((player) => player.token === playerToken) ?? null
    const other = players.find((player) => player.token !== playerToken) ?? null
    return [mine, other]
  }, [players, playerToken])
  const myScore = myPlayer?.score ?? 0
  const theirScore = otherPlayer?.score ?? 0
  const phase = state?.session.phase ?? 'lobby'
  const sessionId = state?.session.id ?? null
  const shouldTickRoundClock = phase === 'round'
  const canHeartbeat = Boolean(roomCode && me && sessionId)

  const roundEndsAt = state?.session.roundEndsAt ?? null
  const roundNumber = state?.session.roundNumber ?? 0
  const localRoundExpired =
    phase === 'round' && typeof roundEndsAt === 'number' && roundEndsAt <= now
  const secondsLeft =
    roundEndsAt && state?.session.phase === 'round'
      ? Math.max(0, Math.ceil((roundEndsAt - now) / 1000))
      : state?.session.roundDurationSeconds ?? durationSeconds
  const timerProgress =
    state?.session.phase === 'round' && state.session.roundDurationSeconds > 0
      ? Math.min(100, Math.max(0, (secondsLeft / state.session.roundDurationSeconds) * 100))
      : 100
  const activeCardText =
    phase === 'round' && me?.isTurn
      ? (() => {
          const activeCardId = state?.activeCardId
          if (!activeCardId) {
            return 'Loading card...'
          }
          return cardsById.get(activeCardId)?.text ?? state.activeCardText ?? 'Loading card...'
        })()
      : ''

  const triggerSparkles = () => {
    const newSparkles = Array.from({ length: 8 }, (_, index) => ({
      id: Date.now() + index,
      x: 30 + Math.random() * 40,
      y: 22 + Math.random() * 58,
      color: CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)],
      tx: `${(Math.random() - 0.5) * 80}px`,
      ty: `${-35 - Math.random() * 55}px`,
    }))
    setSparkles(newSparkles)
    window.setTimeout(() => setSparkles([]), 700)
  }

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap'
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [])

  useEffect(() => {
    if (!shouldLoadCards) {
      return
    }

    void ensureCardsInitialized({}).catch(() => undefined)
  }, [shouldLoadCards, ensureCardsInitialized])

  useEffect(() => {
    safeStorageSet(NAME_STORAGE_KEY, name)
  }, [name])

  useEffect(() => {
    const normalized = normalizeCode(activeCode)
    if (normalized) {
      safeStorageSet(ROOM_STORAGE_KEY, normalized)
      return
    }
    safeStorageRemove(ROOM_STORAGE_KEY)
  }, [activeCode])

  useEffect(() => {
    if (!shouldTickRoundClock) {
      setNow(Date.now())
      return
    }

    const timerId = window.setInterval(() => {
      setNow(Date.now())
    }, 500)
    return () => window.clearInterval(timerId)
  }, [shouldTickRoundClock])

  useEffect(() => {
    const syncNow = () => setNow(Date.now())
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncNow()
      }
    }
    window.addEventListener('focus', syncNow)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', syncNow)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (!canHeartbeat || !sessionId) {
      return
    }

    const ping = () => {
      void heartbeatPresence({ sessionId, playerToken }).catch(() => undefined)
    }

    ping()
    const intervalId = window.setInterval(ping, HEARTBEAT_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [canHeartbeat, sessionId, playerToken, heartbeatPresence])

  useEffect(() => {
    if (
      !state ||
      !me ||
      state.session.phase !== 'round' ||
      !localRoundExpired ||
      !me.isTurn ||
      !roomCode
    ) {
      endingRoundRef.current = false
      return
    }

    if (endingRoundRef.current) {
      return
    }
    endingRoundRef.current = true

    void endRound({ code: roomCode, playerToken }).catch(() => {
      endingRoundRef.current = false
    })
  }, [state, me, localRoundExpired, roomCode, playerToken, endRound])

  useEffect(() => {
    if (!canQueryRoom || state !== null) {
      return
    }

    setFeedback('Room not found, or you are no longer in this room.')
    setActiveCode('')
    safeStorageRemove(ROOM_STORAGE_KEY)
  }, [canQueryRoom, state])

  const clearRoom = () => {
    setActiveCode('')
    safeStorageRemove(ROOM_STORAGE_KEY)
    setShowCardsPanel(false)
  }

  const onCreate = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setFeedback('Enter your name first.')
      return
    }

    setWorkingAction('create')
    setFeedback('')
    try {
      const result = await createSession({ name: trimmedName, playerToken })
      setActiveCode(result.code)
      setRoomInput(result.code)
    } catch (error) {
      setFeedback(getErrorMessage(error))
    } finally {
      setWorkingAction('')
    }
  }

  const onJoin = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim()
    const normalizedInput = normalizeCode(roomInput)
    if (!trimmedName) {
      setFeedback('Enter your name first.')
      return
    }
    if (!normalizedInput) {
      setFeedback('Enter a room code.')
      return
    }

    setWorkingAction('join')
    setFeedback('')
    try {
      const result = await joinSession({
        code: normalizedInput,
        name: trimmedName,
        playerToken,
      })
      setActiveCode(result.code)
      setRoomInput(result.code)
    } catch (error) {
      setFeedback(getErrorMessage(error))
    } finally {
      setWorkingAction('')
    }
  }

  const onLeaveRoom = async () => {
    if (!roomCode) {
      clearRoom()
      return
    }

    const roomCodeToLeave = roomCode
    setWorkingAction('leave')
    setFeedback('')
    clearRoom()
    setWorkingAction('')
    void leaveSession({ code: roomCodeToLeave, playerToken }).catch((error) => {
      setFeedback(getErrorMessage(error))
    })
  }

  const onAddCard = async (event: FormEvent) => {
    event.preventDefault()
    const hasAnyLine = cardDraft
      .split(/\r?\n/)
      .some((line) => line.trim().length > 0)
    if (!hasAnyLine) {
      setFeedback('Type a card phrase first.')
      return
    }

    setWorkingAction('card')
    setFeedback('')
    try {
      await addCard({ playerToken, text: cardDraft })
      setCardDraft('')
    } catch (error) {
      setFeedback(getErrorMessage(error))
    } finally {
      setWorkingAction('')
    }
  }

  const onDeleteCard = async (cardId: Id<'cards'>) => {
    setWorkingAction(`delete:${cardId}`)
    setFeedback('')
    try {
      await deleteCard({ playerToken, cardId })
    } catch (error) {
      setFeedback(getErrorMessage(error))
    } finally {
      setWorkingAction('')
    }
  }

  const onStartRound = async () => {
    if (!roomCode) {
      return
    }
    setWorkingAction('start')
    setFeedback('')
    try {
      await startRound({
        code: roomCode,
        playerToken,
        durationSeconds,
      })
    } catch (error) {
      setFeedback(getErrorMessage(error))
    } finally {
      setWorkingAction('')
    }
  }

  const onCardResult = (result: 'correct' | 'skip') => {
    if (!roomCode || !state?.activeCardId || localRoundExpired) {
      if (roomCode && me?.isTurn && localRoundExpired) {
        void endRound({ code: roomCode, playerToken }).catch(() => undefined)
      }
      return
    }

    setFeedback('')
    if (result === 'correct') {
      triggerSparkles()
    }
    void markCardResult({ code: roomCode, playerToken, result }).catch((error) => {
      setFeedback(getErrorMessage(error))
    })
  }

  const onResetScores = async () => {
    if (!roomCode) {
      return
    }
    setWorkingAction('reset')
    setFeedback('')
    try {
      await resetScores({ code: roomCode, playerToken })
    } catch (error) {
      setFeedback(getErrorMessage(error))
    } finally {
      setWorkingAction('')
    }
  }

  const css = `
    @keyframes bounceIn {
      0% { transform: scale(0.7) rotate(-3deg); opacity: 0; }
      50% { transform: scale(1.08) rotate(1deg); }
      70% { transform: scale(0.96) rotate(-0.5deg); }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    @keyframes sparkle {
      0% { transform: scale(0) translate(0,0); opacity: 1; }
      100% { transform: scale(1.5) translate(var(--tx), var(--ty)); opacity: 0; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(26px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes drawerUp {
      from { opacity: 0; transform: translateX(-50%) translateY(26px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes float {
      0%,100% { transform: translateY(0px) rotate(-2deg); }
      50% { transform: translateY(-10px) rotate(2deg); }
    }
    button { cursor: pointer; transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1), filter 0.15s ease; }
    button:hover { transform: scale(1.04); }
    button:active { transform: scale(0.97); }
    input:focus, textarea:focus { outline: none; border-color: #333 !important; }
    input, textarea { font-size: 16px !important; }
  `

  const pageStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: '#FAFAFA',
    fontFamily: "'Nunito', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }

  if (!roomCode) {
    return (
      <div style={{ ...pageStyle, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <style>{css}</style>
        <button
          onClick={() => setShowCardsPanel((value) => !value)}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            height: 44,
            padding: '0 14px',
            background: CARD_COLORS[8],
            color: '#fff',
            border: '3px solid #222',
            borderRadius: 12,
            fontFamily: "'Fredoka One', sans-serif",
            fontSize: 15,
            boxShadow: '3px 3px 0 #222',
            zIndex: 3,
          }}
        >
          Cards
        </button>
        {CARD_COLORS.slice(0, 8).map((color, index) => (
          <div
            key={color}
            style={{
              position: 'absolute',
              width: `${44 + index * 18}px`,
              height: `${44 + index * 18}px`,
              borderRadius: index % 2 === 0 ? '50%' : '14px',
              background: color,
              opacity: 0.12,
              top: `${6 + index * 11}%`,
              right: index % 2 === 0 ? `${2 + index * 4}%` : undefined,
              left: index % 2 !== 0 ? `${2 + index * 3}%` : undefined,
              animation: `float ${3 + index * 0.45}s ease-in-out infinite`,
              animationDelay: `${index * 0.2}s`,
            }}
          />
        ))}

        <div style={{ width: '100%', maxWidth: 420, zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 28, animation: 'bounceIn 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div
              style={{
                display: 'inline-block',
                background: CARD_COLORS[0],
                borderRadius: 24,
                padding: '16px 30px',
                boxShadow: '6px 6px 0 #222',
                border: '3px solid #222',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontFamily: "'Fredoka One', sans-serif",
                  fontSize: 'clamp(34px,9vw,52px)',
                  color: '#fff',
                  lineHeight: 1,
                }}
              >
                Lip Read!
              </div>
            </div>
            <div style={{ fontWeight: 700, color: '#666', fontSize: 14 }}>
              realtime room play with Convex
            </div>
          </div>

          <form
            onSubmit={onCreate}
            style={{
              background: '#fff',
              borderRadius: 20,
              border: '3px solid #222',
              boxShadow: '5px 5px 0 #222',
              padding: 22,
              marginBottom: 14,
              animation: 'slideUp 0.45s 0.05s ease both',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#888', marginBottom: 8 }}>
              Your Name
            </div>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={24}
              placeholder="Player name"
              style={{
                width: '100%',
                height: 50,
                border: '3px solid #222',
                borderRadius: 14,
                padding: '0 14px',
                fontFamily: "'Nunito', sans-serif",
                fontSize: 15,
                fontWeight: 700,
                color: '#222',
                marginBottom: 12,
                boxShadow: '3px 3px 0 #222',
              }}
            />
            <button
              type="submit"
              disabled={workingAction === 'create'}
              style={{
                width: '100%',
                height: 52,
                background: CARD_COLORS[0],
                color: '#fff',
                border: '3px solid #222',
                borderRadius: 14,
                fontFamily: "'Fredoka One', sans-serif",
                fontSize: 20,
                boxShadow: '4px 4px 0 #222',
              }}
            >
              {workingAction === 'create' ? 'Creating…' : 'Create Room'}
            </button>
          </form>

          <form
            onSubmit={onJoin}
            style={{ display: 'flex', gap: 10, animation: 'slideUp 0.45s 0.12s ease both' }}
          >
            <input
              value={roomInput}
              onChange={(event) => setRoomInput(normalizeCode(event.target.value))}
              maxLength={8}
              placeholder="enter room code…"
              style={{
                flex: 1,
                height: 52,
                border: '3px solid #222',
                borderRadius: 14,
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 800,
                fontSize: 15,
                padding: '0 14px',
                color: '#222',
                background: '#fff',
                boxShadow: '4px 4px 0 #222',
              }}
            />
            <button
              type="submit"
              disabled={workingAction === 'join'}
              style={{
                height: 52,
                padding: '0 22px',
                background: CARD_COLORS[3],
                color: '#fff',
                border: '3px solid #222',
                borderRadius: 14,
                fontFamily: "'Fredoka One', sans-serif",
                fontSize: 18,
                boxShadow: '4px 4px 0 #222',
              }}
            >
              {workingAction === 'join' ? '…' : 'Join!'}
            </button>
          </form>

          {feedback ? (
            <p style={{ marginTop: 12, marginBottom: 0, color: '#B42318', fontWeight: 700 }}>
              {feedback}
            </p>
          ) : null}
        </div>

        {showCardsPanel ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: 10,
              width: 'min(768px, calc(100% - 20px))',
              maxHeight: '62vh',
              background: '#fff',
              border: '4px solid #222',
              borderRadius: 20,
              boxShadow: '6px 6px 0 #222',
              padding: 14,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'drawerUp 0.24s ease',
              zIndex: 30,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontFamily: "'Fredoka One', sans-serif", fontSize: 24, color: '#333' }}>
                Cards ({cards.length})
              </div>
              <button
                onClick={() => setShowCardsPanel(false)}
                style={{
                  height: 34,
                  padding: '0 10px',
                  border: '3px solid #222',
                  borderRadius: 10,
                  background: '#fff',
                  color: '#222',
                  fontFamily: "'Fredoka One', sans-serif",
                  fontSize: 14,
                }}
              >
                Close
              </button>
            </div>

            <form onSubmit={onAddCard} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              <textarea
                value={cardDraft}
                onChange={(event) => setCardDraft(event.target.value)}
                placeholder={'Add card phrases (one per line)\nExample:\nMovie night\nIce cream'}
                maxLength={1200}
                rows={4}
                style={{
                  width: '100%',
                  minHeight: 84,
                  border: '3px solid #222',
                  borderRadius: 12,
                  padding: '8px 12px',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#222',
                  resize: 'vertical',
                  fontFamily: "'Nunito', sans-serif",
                }}
              />
              <button
                type="submit"
                disabled={workingAction === 'card'}
                style={{
                  height: 42,
                  padding: '0 14px',
                  border: '3px solid #222',
                  borderRadius: 12,
                  background: CARD_COLORS[2],
                  color: '#222',
                  fontFamily: "'Fredoka One', sans-serif",
                  fontSize: 16,
                  alignSelf: 'flex-end',
                }}
              >
                {workingAction === 'card' ? 'Adding…' : 'Add Cards'}
              </button>
            </form>

            <div style={{ overflow: 'auto', borderRadius: 12, border: '2px solid #222', padding: 8, background: '#FAFAFA' }}>
              {cards.map((card) => (
                <div
                  key={card.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    marginBottom: 6,
                    borderRadius: 10,
                    border: '2px solid #222',
                    background: '#fff',
                    color: '#222',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: '#222' }}>{card.text}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#888' }}>
                      {card.source}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onDeleteCard(card.id)}
                    disabled={workingAction === `delete:${card.id}`}
                    style={{
                      height: 34,
                      padding: '0 10px',
                      border: '3px solid #222',
                      borderRadius: 10,
                      background: '#fff',
                      color: '#B42318',
                      fontFamily: "'Fredoka One', sans-serif",
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {workingAction === `delete:${card.id}` ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  const loadingRoom = state === undefined

  return (
    <div style={pageStyle}>
      <style>{css}</style>

      {sparkles.map((sparkle) => (
        <div
          key={sparkle.id}
          style={
            {
              position: 'fixed',
              left: `${sparkle.x}%`,
              top: `${sparkle.y}%`,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: sparkle.color,
              zIndex: 100,
              animation: 'sparkle 0.7s ease forwards',
              '--tx': sparkle.tx,
              '--ty': sparkle.ty,
            } as CSSProperties
          }
        />
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: "'Fredoka One', sans-serif", fontSize: 24, color: '#333' }}>Lip Read!</div>
          <div
            style={{
              border: '2px solid #222',
              borderRadius: 12,
              padding: '5px 10px',
              fontFamily: "'Fredoka One', sans-serif",
              fontSize: 12,
              background: '#fff',
              color: '#222',
            }}
          >
            {roomCode}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowCardsPanel((value) => !value)}
            style={{
              height: 42,
              padding: '0 14px',
              background: CARD_COLORS[8],
              color: '#fff',
              border: '3px solid #222',
              borderRadius: 12,
              fontFamily: "'Fredoka One', sans-serif",
              fontSize: 15,
              boxShadow: '3px 3px 0 #222',
            }}
          >
            Cards
          </button>
          <button
            onClick={onLeaveRoom}
            disabled={workingAction === 'leave'}
            style={{
              height: 42,
              padding: '0 14px',
              background: '#fff',
              color: '#222',
              border: '3px solid #222',
              borderRadius: 12,
              fontFamily: "'Fredoka One', sans-serif",
              fontSize: 15,
              boxShadow: '3px 3px 0 #222',
            }}
          >
            {workingAction === 'leave' ? 'Leaving…' : 'Exit'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 10px', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div
            style={{
              background: CARD_COLORS[0],
              border: '3px solid #222',
              borderRadius: 12,
              padding: '4px 14px',
              textAlign: 'center',
              boxShadow: '3px 3px 0 #222',
            }}
          >
            <div style={{ fontFamily: "'Fredoka One', sans-serif", fontSize: 22, color: '#fff', lineHeight: 1 }}>
              {myScore}
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              You
            </div>
          </div>
          <div
            style={{
              background: CARD_COLORS[1],
              border: '3px solid #222',
              borderRadius: 12,
              padding: '4px 14px',
              textAlign: 'center',
              boxShadow: '3px 3px 0 #222',
            }}
          >
            <div style={{ fontFamily: "'Fredoka One', sans-serif", fontSize: 22, color: '#fff', lineHeight: 1 }}>
              {theirScore}
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Them
            </div>
          </div>
        </div>
        <div
          style={{
            border: '3px solid #222',
            borderRadius: 12,
            background: otherPlayer ? (otherPlayer.isOnline ? '#CCFCEB' : '#F8E6E6') : '#fff',
            padding: '7px 11px',
            fontSize: 12,
            fontWeight: 800,
            color: '#333',
            boxShadow: '3px 3px 0 #222',
          }}
        >
          {otherPlayer ? `${otherPlayer.name}: ${otherPlayer.isOnline ? 'online' : 'away'}` : 'waiting for player 2'}
        </div>
      </div>

      <div
        style={{
          height: 10,
          background: '#eee',
          margin: '0 16px',
          borderRadius: 6,
          border: '2px solid #222',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: '100%',
            background: CARD_COLORS[4],
            width: `${timerProgress}%`,
            transition: 'width 0.45s linear',
            borderRadius: 4,
          }}
        />
      </div>

      <div style={{ textAlign: 'center', paddingTop: 8, fontSize: 13, fontWeight: 800, color: '#666' }}>
        {loadingRoom
          ? 'Loading room…'
          : phase === 'round'
            ? `Round ${roundNumber} · ${formatSeconds(secondsLeft)}`
            : phase === 'round_over'
              ? `Round ${roundNumber} complete`
              : 'Lobby'}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '20px 16px' }}>
        <div
          style={{
            position: 'absolute',
            width: 'min(360px, 88vw)',
            aspectRatio: '3/2',
            background: CARD_COLORS[7],
            borderRadius: 28,
            border: '4px solid #222',
            transform: 'rotate(3deg) translateY(7px)',
            opacity: 0.35,
          }}
        />
        <div
          style={{
            position: 'relative',
            width: 'min(360px, 88vw)',
            aspectRatio: '3/2',
            background: CARD_COLORS[0],
            borderRadius: 28,
            border: '4px solid #222',
            boxShadow: '8px 8px 0 #222',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '24px 26px',
            animation: 'bounceIn 0.45s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <div style={{ position: 'absolute', top: 12, left: 16, fontFamily: "'Fredoka One', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
            {phase === 'round' && me?.isTurn ? 'Reader view' : 'Game'}
          </div>
          <div style={{ position: 'absolute', top: 12, right: 16, fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.55)' }}>
            {roomCode}
          </div>
          <div
            style={{
              fontFamily: "'Fredoka One', sans-serif",
              fontSize: 'clamp(27px,8vw,50px)',
              color: '#fff',
              lineHeight: 1.1,
              letterSpacing: '0.02em',
              WebkitTextStroke: '1px rgba(0,0,0,0.15)',
            }}
          >
            {loadingRoom
              ? 'Loading…'
                : phase !== 'round'
                  ? players.length === 2
                    ? me?.isHost
                      ? 'Start the next round'
                      : 'Waiting for host to start'
                  : 'Need 2 players'
                : me?.isTurn
                  ? activeCardText
                  : 'Guess out loud while your teammate mouths the card!'}
          </div>
        </div>
      </div>

      {feedback ? (
        <div style={{ margin: '0 16px 10px', padding: '10px 12px', borderRadius: 12, border: '3px solid #222', boxShadow: '3px 3px 0 #222', background: '#fff', color: '#B42318', fontSize: 13, fontWeight: 800 }}>
          {feedback}
        </div>
      ) : null}

      {phase === 'round' && me?.isTurn ? (
        <div style={{ display: 'flex', gap: 12, padding: '0 16px 22px', flexShrink: 0 }}>
          <button
            onClick={() => onCardResult('skip')}
            disabled={localRoundExpired}
            style={{
              flex: 1,
              height: 62,
              background: '#fff',
              color: '#555',
              border: '4px solid #222',
              borderRadius: 20,
              fontFamily: "'Fredoka One', sans-serif",
              fontSize: 20,
              boxShadow: '4px 4px 0 #222',
            }}
          >
            😬 Pass
          </button>
          <button
            onClick={() => onCardResult('correct')}
            disabled={localRoundExpired}
            style={{
              flex: 2,
              height: 62,
              background: '#333',
              color: '#fff',
              border: '4px solid #222',
              borderRadius: 20,
              fontFamily: "'Fredoka One', sans-serif",
              fontSize: 22,
              boxShadow: '4px 4px 0 #222',
            }}
          >
            ✓ Got it!
          </button>
        </div>
      ) : null}

      {phase !== 'round' && me?.isHost ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 16px 16px', flexWrap: 'wrap' }}>
          {[45, 60, 90].map((duration) => (
            <button
              key={duration}
              onClick={() => setDurationSeconds(duration)}
              style={{
                height: 40,
                padding: '0 14px',
                border: '3px solid #222',
                borderRadius: 12,
                background: durationSeconds === duration ? CARD_COLORS[5] : '#fff',
                color: durationSeconds === duration ? '#fff' : '#333',
                fontFamily: "'Fredoka One', sans-serif",
                fontSize: 16,
                boxShadow: '3px 3px 0 #222',
              }}
            >
              {duration}s
            </button>
          ))}
          <button
            onClick={onStartRound}
            disabled={workingAction === 'start' || players.length !== 2}
            style={{
              height: 40,
              padding: '0 16px',
              border: '3px solid #222',
              borderRadius: 12,
              background: CARD_COLORS[0],
              color: '#fff',
              fontFamily: "'Fredoka One', sans-serif",
              fontSize: 16,
              boxShadow: '3px 3px 0 #222',
              opacity: players.length === 2 ? 1 : 0.6,
            }}
          >
            {workingAction === 'start' ? 'Starting…' : 'Start round'}
          </button>
          <button
            onClick={onResetScores}
            disabled={workingAction === 'reset'}
            style={{
              height: 40,
              padding: '0 16px',
              border: '3px solid #222',
              borderRadius: 12,
              background: '#fff',
              color: '#333',
              fontFamily: "'Fredoka One', sans-serif",
              fontSize: 16,
              boxShadow: '3px 3px 0 #222',
            }}
          >
            {workingAction === 'reset' ? 'Resetting…' : 'Reset scores'}
          </button>
        </div>
      ) : null}

      {showCardsPanel ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 10,
            width: 'min(768px, calc(100% - 20px))',
            maxHeight: '62vh',
            background: '#fff',
            border: '4px solid #222',
            borderRadius: 20,
            boxShadow: '6px 6px 0 #222',
            padding: 14,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'drawerUp 0.24s ease',
            zIndex: 30,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: "'Fredoka One', sans-serif", fontSize: 24, color: '#333' }}>
              Cards ({cards.length})
            </div>
            <button
              onClick={() => setShowCardsPanel(false)}
              style={{
                height: 34,
                padding: '0 10px',
                border: '3px solid #222',
                borderRadius: 10,
                background: '#fff',
                color: '#222',
                fontFamily: "'Fredoka One', sans-serif",
                fontSize: 14,
              }}
            >
              Close
            </button>
          </div>

          <form onSubmit={onAddCard} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            <textarea
              value={cardDraft}
              onChange={(event) => setCardDraft(event.target.value)}
              placeholder={'Add card phrases (one per line)\nExample:\nMovie night\nIce cream'}
              maxLength={1200}
              rows={4}
              style={{
                width: '100%',
                minHeight: 84,
                border: '3px solid #222',
                borderRadius: 12,
                padding: '8px 12px',
                fontSize: 14,
                fontWeight: 700,
                color: '#222',
                resize: 'vertical',
                fontFamily: "'Nunito', sans-serif",
              }}
            />
            <button
              type="submit"
              disabled={workingAction === 'card'}
              style={{
                height: 42,
                padding: '0 14px',
                border: '3px solid #222',
                borderRadius: 12,
                background: CARD_COLORS[2],
                color: '#222',
                fontFamily: "'Fredoka One', sans-serif",
                fontSize: 16,
                alignSelf: 'flex-end',
              }}
            >
              {workingAction === 'card' ? 'Adding…' : 'Add Cards'}
            </button>
          </form>

          <div style={{ overflow: 'auto', borderRadius: 12, border: '2px solid #222', padding: 8, background: '#FAFAFA' }}>
            {cards.map((card) => (
              <div
                key={card.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  marginBottom: 6,
                  borderRadius: 10,
                  border: '2px solid #222',
                  background: '#fff',
                  color: '#222',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: '#222' }}>{card.text}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#888' }}>
                    {card.source}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onDeleteCard(card.id)}
                  disabled={workingAction === `delete:${card.id}`}
                  style={{
                    height: 34,
                    padding: '0 10px',
                    border: '3px solid #222',
                    borderRadius: 10,
                    background: '#fff',
                    color: '#B42318',
                    fontFamily: "'Fredoka One', sans-serif",
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {workingAction === `delete:${card.id}` ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
