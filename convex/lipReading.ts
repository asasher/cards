import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

const ROOM_CODE_LENGTH = 5
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const DEFAULT_ROUND_SECONDS = 60
const PRESENCE_STALE_MS = 15_000

const DEFAULT_LIP_READING_CARDS = [
  'Peanut butter',
  'Movie night',
  'Birthday cake',
  'Water bottle',
  'Traffic light',
  'Banana split',
  'Coffee maker',
  'Tennis shoes',
  'Pizza party',
  'Ice cream',
  'Roller coaster',
  'Sunflower seeds',
  'Chicken nuggets',
  'Video game',
  'School bus',
  'Swimming pool',
  'Sunglasses',
  'Popcorn machine',
  'Skateboard trick',
  'Holiday sweater',
  'Camping trip',
  'Chocolate milk',
  'Pillow fight',
  'Fire truck',
  'Bubble gum',
  'Snow day',
  'Beach towel',
  'Electric guitar',
  'Magic trick',
  'Superhero cape',
]

type PlayerDoc = Doc<'players'>
type SessionDoc = Doc<'sessions'>
type PresenceDoc = Doc<'presence'>
type CardDoc = Doc<'cards'>

function normalizeCode(code: string) {
  return code.trim().toUpperCase()
}

function normalizeCardText(text: string) {
  return text.trim().replace(/\s+/g, ' ')
}

function validatePlayerName(name: string) {
  const trimmed = name.trim()
  if (trimmed.length < 2 || trimmed.length > 24) {
    throw new ConvexError('Name must be between 2 and 24 characters.')
  }
  return trimmed
}

function validatePlayerToken(playerToken: string) {
  const trimmed = playerToken.trim()
  if (trimmed.length < 8 || trimmed.length > 128) {
    throw new ConvexError('Invalid player token.')
  }
  return trimmed
}

function shuffle<T>(items: T[]): T[] {
  const output = [...items]
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[output[i], output[j]] = [output[j], output[i]]
  }
  return output
}

async function getSessionByCode(ctx: MutationCtx | QueryCtx, code: string) {
  return await ctx.db
    .query('sessions')
    .withIndex('by_code', (q) => q.eq('code', normalizeCode(code)))
    .unique()
}

async function getPlayers(
  ctx: MutationCtx | QueryCtx,
  sessionId: Id<'sessions'>,
): Promise<PlayerDoc[]> {
  const players = await ctx.db
    .query('players')
    .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
    .collect()

  return players.sort((a, b) => a.joinedAt - b.joinedAt)
}

async function getPresence(
  ctx: MutationCtx | QueryCtx,
  sessionId: Id<'sessions'>,
): Promise<PresenceDoc[]> {
  return await ctx.db
    .query('presence')
    .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
    .collect()
}

async function getAllCards(ctx: MutationCtx | QueryCtx): Promise<CardDoc[]> {
  const cards = await ctx.db.query('cards').collect()
  return cards.sort((a, b) => a.createdAt - b.createdAt)
}

async function ensureDefaultCards(ctx: MutationCtx) {
  const existingCards = await getAllCards(ctx)
  if (existingCards.length > 0) {
    return
  }

  const now = Date.now()

  for (const [index, cardText] of DEFAULT_LIP_READING_CARDS.entries()) {
    await ctx.db.insert('cards', {
      text: cardText,
      source: 'default',
      createdAt: now + index,
    })
  }
}

async function touchPresence(
  ctx: MutationCtx,
  sessionId: Id<'sessions'>,
  playerToken: string,
) {
  const now = Date.now()
  const existing = await ctx.db
    .query('presence')
    .withIndex('by_session_token', (q) =>
      q.eq('sessionId', sessionId).eq('playerToken', playerToken),
    )
    .collect()

  if (existing.length === 0) {
    await ctx.db.insert('presence', {
      sessionId,
      playerToken,
      joinedAt: now,
      lastSeenAt: now,
    })
    return
  }

  const [current, ...duplicates] = existing
  await ctx.db.patch(current._id, { lastSeenAt: now })
  for (const duplicate of duplicates) {
    await ctx.db.delete(duplicate._id)
  }
}

async function deletePresence(ctx: MutationCtx, sessionId: Id<'sessions'>, playerToken: string) {
  const rows = await ctx.db
    .query('presence')
    .withIndex('by_session_token', (q) =>
      q.eq('sessionId', sessionId).eq('playerToken', playerToken),
    )
    .collect()

  for (const row of rows) {
    await ctx.db.delete(row._id)
  }
}

function getGuesserToken(players: PlayerDoc[], turnToken: string | undefined) {
  if (!turnToken) {
    return undefined
  }
  return players.find((player) => player.token !== turnToken)?.token
}

async function finishRound(ctx: MutationCtx, session: SessionDoc, players: PlayerDoc[]) {
  const now = Date.now()
  const currentTurn = session.turnToken ?? players[0]?.token
  const nextTurn = players.find((player) => player.token !== currentTurn)?.token ?? currentTurn

  await ctx.db.patch(session._id, {
    phase: 'round_over',
    turnToken: nextTurn,
    roundEndsAt: undefined,
    deckCardIds: undefined,
    deckCursor: undefined,
    updatedAt: now,
  })
}

async function ensureParticipant(ctx: MutationCtx, code: string, playerToken: string) {
  const session = await getSessionByCode(ctx, code)
  if (!session) {
    throw new ConvexError('Room not found.')
  }

  const players = await getPlayers(ctx, session._id)
  const me = players.find((player) => player.token === playerToken)

  if (!me) {
    throw new ConvexError('You are not in this room.')
  }

  return { session, players, me }
}

async function generateUniqueRoomCode(ctx: MutationCtx) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    let code = ''
    for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
      const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)
      code += ROOM_CODE_ALPHABET[index]
    }

    const existing = await ctx.db
      .query('sessions')
      .withIndex('by_code', (q) => q.eq('code', code))
      .unique()

    if (!existing) {
      return code
    }
  }

  throw new ConvexError('Could not generate room code. Please try again.')
}

export const createSession = mutation({
  args: {
    name: v.string(),
    playerToken: v.string(),
  },
  handler: async (ctx, args) => {
    const name = validatePlayerName(args.name)
    const playerToken = validatePlayerToken(args.playerToken)
    const now = Date.now()
    const code = await generateUniqueRoomCode(ctx)

    const sessionId = await ctx.db.insert('sessions', {
      code,
      gameKey: 'lip-reading',
      phase: 'lobby',
      hostToken: playerToken,
      turnToken: playerToken,
      roundNumber: 0,
      roundDurationSeconds: DEFAULT_ROUND_SECONDS,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('players', {
      sessionId,
      token: playerToken,
      name,
      score: 0,
      joinedAt: now,
    })

    await touchPresence(ctx, sessionId, playerToken)

    return { code }
  },
})

export const joinSession = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    playerToken: v.string(),
  },
  handler: async (ctx, args) => {
    const name = validatePlayerName(args.name)
    const playerToken = validatePlayerToken(args.playerToken)
    const session = await getSessionByCode(ctx, args.code)

    if (!session) {
      throw new ConvexError('Room not found.')
    }

    const players = await getPlayers(ctx, session._id)
    const existing = players.find((player) => player.token === playerToken)

    if (existing) {
      await ctx.db.patch(existing._id, { name })
      await touchPresence(ctx, session._id, playerToken)
      return { code: session.code }
    }

    if (players.length >= 2) {
      throw new ConvexError('This room already has 2 players.')
    }

    await ctx.db.insert('players', {
      sessionId: session._id,
      token: playerToken,
      name,
      score: 0,
      joinedAt: Date.now(),
    })

    await touchPresence(ctx, session._id, playerToken)

    return { code: session.code }
  },
})

export const leaveSession = mutation({
  args: {
    code: v.string(),
    playerToken: v.string(),
  },
  handler: async (ctx, args) => {
    const playerToken = validatePlayerToken(args.playerToken)
    const session = await getSessionByCode(ctx, args.code)

    if (!session) {
      return { left: false, roomClosed: true }
    }

    const players = await getPlayers(ctx, session._id)
    const me = players.find((player) => player.token === playerToken)
    if (!me) {
      return { left: false, roomClosed: false }
    }

    await deletePresence(ctx, session._id, playerToken)
    await ctx.db.delete(me._id)

    const remainingPlayers = players.filter((player) => player.token !== playerToken)
    if (remainingPlayers.length === 0) {
      const remainingPresence = await getPresence(ctx, session._id)
      for (const row of remainingPresence) {
        await ctx.db.delete(row._id)
      }

      await ctx.db.delete(session._id)
      return { left: true, roomClosed: true }
    }

    const nextHostToken =
      session.hostToken === playerToken ? remainingPlayers[0].token : session.hostToken
    const hasCurrentTurn = remainingPlayers.some((player) => player.token === session.turnToken)
    const nextTurnToken = hasCurrentTurn ? session.turnToken : remainingPlayers[0].token

    await ctx.db.patch(session._id, {
      hostToken: nextHostToken,
      turnToken: nextTurnToken,
      phase: 'lobby',
      roundEndsAt: undefined,
      deckCardIds: undefined,
      deckCursor: undefined,
      updatedAt: Date.now(),
    })

    return { left: true, roomClosed: false }
  },
})

export const heartbeatPresence = mutation({
  args: {
    code: v.string(),
    playerToken: v.string(),
  },
  handler: async (ctx, args) => {
    const playerToken = validatePlayerToken(args.playerToken)
    const { session } = await ensureParticipant(ctx, args.code, playerToken)
    await touchPresence(ctx, session._id, playerToken)
  },
})

export const ensureCardsInitialized = mutation({
  args: {},
  handler: async (ctx) => {
    await ensureDefaultCards(ctx)
  },
})

export const addCard = mutation({
  args: {
    playerToken: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const playerToken = validatePlayerToken(args.playerToken)
    const lines = args.text
      .split(/\r?\n/)
      .map((line) => normalizeCardText(line))
      .filter((line) => line.length > 0)

    if (lines.length === 0) {
      throw new ConvexError('Enter at least one card phrase.')
    }

    for (const [index, line] of lines.entries()) {
      if (line.length < 2 || line.length > 48) {
        throw new ConvexError(`Line ${index + 1}: Card text must be between 2 and 48 characters.`)
      }
    }

    const now = Date.now()
    for (const [index, text] of lines.entries()) {
      await ctx.db.insert('cards', {
        text,
        source: 'custom',
        createdByToken: playerToken,
        createdAt: now + index,
      })
    }

    return { createdCount: lines.length }
  },
})

export const deleteCard = mutation({
  args: {
    playerToken: v.string(),
    cardId: v.id('cards'),
  },
  handler: async (ctx, args) => {
    validatePlayerToken(args.playerToken)
    const card = await ctx.db.get(args.cardId)
    if (!card) {
      return { deleted: false }
    }

    await ctx.db.delete(card._id)
    return { deleted: true }
  },
})

export const startRound = mutation({
  args: {
    code: v.string(),
    playerToken: v.string(),
    durationSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const playerToken = validatePlayerToken(args.playerToken)
    const { session, players } = await ensureParticipant(ctx, args.code, playerToken)

    if (session.hostToken !== playerToken) {
      throw new ConvexError('Only the host can start rounds.')
    }

    if (players.length !== 2) {
      throw new ConvexError('You need exactly 2 players to start a round.')
    }

    const cards = await getAllCards(ctx)

    if (cards.length === 0) {
      throw new ConvexError('Add at least one card before starting.')
    }

    const durationSeconds = Math.max(
      20,
      Math.min(180, Math.floor(args.durationSeconds ?? session.roundDurationSeconds)),
    )

    const turnToken =
      session.turnToken && players.some((player) => player.token === session.turnToken)
        ? session.turnToken
        : players[0].token

    const now = Date.now()
    const roundEndsAt = now + durationSeconds * 1000

    await ctx.db.patch(session._id, {
      phase: 'round',
      turnToken,
      roundNumber: session.roundNumber + 1,
      roundDurationSeconds: durationSeconds,
      roundEndsAt,
      deckCardIds: shuffle(cards.map((card) => card._id)),
      deckCursor: 0,
      updatedAt: now,
    })

    return { roundEndsAt }
  },
})

export const markCardResult = mutation({
  args: {
    code: v.string(),
    playerToken: v.string(),
    result: v.union(v.literal('correct'), v.literal('skip')),
  },
  handler: async (ctx, args) => {
    const playerToken = validatePlayerToken(args.playerToken)
    const { session, players } = await ensureParticipant(ctx, args.code, playerToken)

    if (session.phase !== 'round') {
      throw new ConvexError('No active round.')
    }

    if (session.turnToken !== playerToken) {
      throw new ConvexError('Only the active card reader can control cards.')
    }

    const now = Date.now()
    if (session.roundEndsAt && now >= session.roundEndsAt) {
      await finishRound(ctx, session, players)
      return { ended: true }
    }

    const deckCardIds = session.deckCardIds ?? []
    const deckCursor = session.deckCursor ?? 0

    if (deckCursor >= deckCardIds.length) {
      await finishRound(ctx, session, players)
      return { ended: true }
    }

    if (args.result === 'correct') {
      const guesserToken = getGuesserToken(players, session.turnToken)
      const guesser = players.find((player) => player.token === guesserToken)
      if (guesser) {
        await ctx.db.patch(guesser._id, { score: guesser.score + 1 })
      }
    }

    const nextCursor = deckCursor + 1
    if (nextCursor >= deckCardIds.length) {
      await finishRound(ctx, session, players)
      return { ended: true }
    }

    await ctx.db.patch(session._id, {
      deckCursor: nextCursor,
      updatedAt: now,
    })

    return { ended: false }
  },
})

export const endRound = mutation({
  args: {
    code: v.string(),
    playerToken: v.string(),
  },
  handler: async (ctx, args) => {
    const playerToken = validatePlayerToken(args.playerToken)
    const { session, players } = await ensureParticipant(ctx, args.code, playerToken)

    if (session.phase !== 'round') {
      return { ended: false }
    }

    await finishRound(ctx, session, players)
    return { ended: true }
  },
})

export const resetScores = mutation({
  args: {
    code: v.string(),
    playerToken: v.string(),
  },
  handler: async (ctx, args) => {
    const playerToken = validatePlayerToken(args.playerToken)
    const { session, players } = await ensureParticipant(ctx, args.code, playerToken)

    if (session.hostToken !== playerToken) {
      throw new ConvexError('Only the host can reset scores.')
    }

    for (const player of players) {
      await ctx.db.patch(player._id, { score: 0 })
    }
  },
})

export const listCards = query({
  args: {},
  handler: async (ctx) => {
    const cards = await getAllCards(ctx)
    return cards.map((card) => ({
      id: card._id,
      text: card.text,
      source: card.source,
    }))
  },
})

export const getState = query({
  args: {
    code: v.string(),
    playerToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await getSessionByCode(ctx, args.code)
    if (!session) {
      return null
    }

    const players = await getPlayers(ctx, session._id)
    const me = players.find((player) => player.token === args.playerToken) ?? null
    const guesserToken = getGuesserToken(players, session.turnToken)
    const activeCardId =
      session.phase === 'round' ? session.deckCardIds?.[session.deckCursor ?? 0] : undefined
    const activeCard = activeCardId ? await ctx.db.get(activeCardId) : null
    const cards = await getAllCards(ctx)
    const presenceRows = await getPresence(ctx, session._id)
    const now = Date.now()

    const lastSeenByToken = new Map<string, number>()
    for (const row of presenceRows) {
      const current = lastSeenByToken.get(row.playerToken) ?? 0
      if (row.lastSeenAt > current) {
        lastSeenByToken.set(row.playerToken, row.lastSeenAt)
      }
    }

    return {
      session: {
        code: session.code,
        gameKey: session.gameKey,
        phase: session.phase,
        hostToken: session.hostToken,
        turnToken: session.turnToken ?? null,
        roundNumber: session.roundNumber,
        roundDurationSeconds: session.roundDurationSeconds,
        roundEndsAt: session.roundEndsAt ?? null,
      },
      players: players.map((player) => {
        const lastSeenAt = lastSeenByToken.get(player.token) ?? null
        return {
          id: player._id,
          token: player.token,
          name: player.name,
          score: player.score,
          joinedAt: player.joinedAt,
          isTurn: player.token === session.turnToken,
          isGuesser: player.token === guesserToken,
          isOnline:
            typeof lastSeenAt === 'number' ? now - lastSeenAt <= PRESENCE_STALE_MS : false,
          lastSeenAt,
        }
      }),
      me: me
        ? {
            token: me.token,
            name: me.name,
            score: me.score,
            isHost: me.token === session.hostToken,
            isTurn: me.token === session.turnToken,
            isGuesser: me.token === guesserToken,
            isOnline: (() => {
              const lastSeenAt = lastSeenByToken.get(me.token) ?? null
              return typeof lastSeenAt === 'number'
                ? now - lastSeenAt <= PRESENCE_STALE_MS
                : false
            })(),
          }
        : null,
      cards: cards.map((card) => ({
        id: card._id,
        text: card.text,
        source: card.source,
      })),
      activeCard: activeCard
        ? {
            id: activeCard._id,
            text: activeCard.text,
          }
        : null,
      roundExpired:
        session.phase === 'round' &&
        !!session.roundEndsAt &&
        session.roundEndsAt <= Date.now(),
      presenceStaleMs: PRESENCE_STALE_MS,
    }
  },
})
