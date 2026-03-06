import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'

const ROOM_CODE_LENGTH = 5
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PRESENCE_STALE_MS = 15_000

const DEFAULT_WANT_WILL_WONT_CARDS = [
  'Weekend road trip',
  'Make sushi at home',
  'Sunrise beach walk',
  'Try a pottery class',
  'Board game marathon',
  'Bookstore date',
  'Cook a new recipe together',
  'Late-night dessert run',
  'Go to a live concert',
  'Mini golf rematch',
  'Plan a no-phone day',
  'Take a dance lesson',
  'Watch a scary movie',
  'Picnic in the park',
  'Host a dinner party',
  'Gym session together',
  'Museum afternoon',
  'Karaoke night out',
  'Camping weekend',
  'Sunday meal prep together',
  'Build a puzzle together',
  'Early morning workout',
  'Try a new cafe',
  'Theme park day',
  'Paint and sip class',
  'Volunteer together',
  'Visit a farmer market',
  'Start a couples journal',
  'Plan a surprise date',
  'Take a photography walk',
]

type PlayerDoc = Doc<'wwwPlayers'>
type PresenceDoc = Doc<'wwwPresence'>
type CardDoc = Doc<'wwwCards'>
type SwipeDoc = Doc<'wwwSwipes'>
type OutcomeDoc = Doc<'wwwOutcomes'>

type SwipeDecision = 'want' | 'will' | 'wont'
type OutcomeKind =
  | 'both_wont'
  | 'mutual_will'
  | 'mixed_will_wont'
  | 'mutual_want'
  | 'want_plus_will'
  | 'want_blocked'

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

function classifyOutcome(a: SwipeDecision, b: SwipeDecision): { kind: OutcomeKind; isMatch: boolean } {
  if (a === 'wont' && b === 'wont') {
    return { kind: 'both_wont', isMatch: false }
  }

  if ((a === 'will' && b === 'wont') || (a === 'wont' && b === 'will')) {
    return { kind: 'mixed_will_wont', isMatch: true }
  }

  if (a === 'will' && b === 'will') {
    return { kind: 'mutual_will', isMatch: true }
  }

  if (a === 'want' && b === 'want') {
    return { kind: 'mutual_want', isMatch: true }
  }

  if ((a === 'want' && b === 'will') || (a === 'will' && b === 'want')) {
    return { kind: 'want_plus_will', isMatch: true }
  }

  return { kind: 'want_blocked', isMatch: false }
}

function formatOutcomeForPlayer(outcome: OutcomeDoc, playerToken: string) {
  if (outcome.playerAToken === playerToken) {
    return {
      id: outcome._id,
      cardId: outcome.cardId,
      kind: outcome.kind,
      isMatch: outcome.isMatch,
      myDecision: outcome.playerADecision,
      otherDecision: outcome.playerBDecision,
      resolvedAt: outcome.resolvedAt,
    }
  }

  if (outcome.playerBToken === playerToken) {
    return {
      id: outcome._id,
      cardId: outcome.cardId,
      kind: outcome.kind,
      isMatch: outcome.isMatch,
      myDecision: outcome.playerBDecision,
      otherDecision: outcome.playerADecision,
      resolvedAt: outcome.resolvedAt,
    }
  }

  return null
}

async function getSessionByCode(ctx: MutationCtx | QueryCtx, code: string) {
  return await ctx.db
    .query('wwwSessions')
    .withIndex('by_code', (q) => q.eq('code', normalizeCode(code)))
    .unique()
}

async function getPlayers(
  ctx: MutationCtx | QueryCtx,
  sessionId: Id<'wwwSessions'>,
): Promise<PlayerDoc[]> {
  return await ctx.db
    .query('wwwPlayers')
    .withIndex('by_session_joined_at', (q) => q.eq('sessionId', sessionId))
    .collect()
}

async function getPlayerBySessionToken(
  ctx: MutationCtx | QueryCtx,
  sessionId: Id<'wwwSessions'>,
  playerToken: string,
): Promise<PlayerDoc | null> {
  return await ctx.db
    .query('wwwPlayers')
    .withIndex('by_session_token', (q) =>
      q.eq('sessionId', sessionId).eq('token', playerToken),
    )
    .first()
}

async function getPresence(
  ctx: MutationCtx | QueryCtx,
  sessionId: Id<'wwwSessions'>,
): Promise<PresenceDoc[]> {
  return await ctx.db
    .query('wwwPresence')
    .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
    .collect()
}

async function getAllCards(ctx: MutationCtx | QueryCtx): Promise<CardDoc[]> {
  return await ctx.db
    .query('wwwCards')
    .withIndex('by_created_at')
    .collect()
}

async function ensureDefaultCards(ctx: MutationCtx) {
  const existingCard = await ctx.db.query('wwwCards').withIndex('by_created_at').first()
  if (existingCard) {
    return
  }

  const now = Date.now()
  for (const [index, cardText] of DEFAULT_WANT_WILL_WONT_CARDS.entries()) {
    await ctx.db.insert('wwwCards', {
      text: cardText,
      source: 'default',
      createdAt: now + index,
    })
  }
}

async function touchPresence(
  ctx: MutationCtx,
  sessionId: Id<'wwwSessions'>,
  playerToken: string,
) {
  const now = Date.now()
  const existing = await ctx.db
    .query('wwwPresence')
    .withIndex('by_session_token', (q) =>
      q.eq('sessionId', sessionId).eq('playerToken', playerToken),
    )
    .collect()

  if (existing.length === 0) {
    await ctx.db.insert('wwwPresence', {
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

async function deletePresence(
  ctx: MutationCtx,
  sessionId: Id<'wwwSessions'>,
  playerToken: string,
) {
  const rows = await ctx.db
    .query('wwwPresence')
    .withIndex('by_session_token', (q) =>
      q.eq('sessionId', sessionId).eq('playerToken', playerToken),
    )
    .collect()

  for (const row of rows) {
    await ctx.db.delete(row._id)
  }
}

async function clearSessionGameData(ctx: MutationCtx, sessionId: Id<'wwwSessions'>) {
  const [swipes, outcomes] = await Promise.all([
    ctx.db
      .query('wwwSwipes')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .collect(),
    ctx.db
      .query('wwwOutcomes')
      .withIndex('by_session_resolved_at', (q) => q.eq('sessionId', sessionId))
      .collect(),
  ])

  for (const swipe of swipes) {
    await ctx.db.delete(swipe._id)
  }

  for (const outcome of outcomes) {
    await ctx.db.delete(outcome._id)
  }
}

async function resetPlayerDecks(ctx: MutationCtx, players: PlayerDoc[]) {
  const cards = await getAllCards(ctx)
  const deckCardIds = cards.map((card) => card._id)

  for (const player of players) {
    await ctx.db.patch(player._id, {
      deckCardIds: shuffle(deckCardIds),
      deckCursor: 0,
      completedAt: undefined,
    })
  }
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
      .query('wwwSessions')
      .withIndex('by_code', (q) => q.eq('code', code))
      .unique()

    if (!existing) {
      return code
    }
  }

  throw new ConvexError('Could not generate room code. Please try again.')
}

async function getExistingSwipe(
  ctx: MutationCtx,
  sessionId: Id<'wwwSessions'>,
  playerToken: string,
  cardId: Id<'wwwCards'>,
): Promise<SwipeDoc | null> {
  const rows = await ctx.db
    .query('wwwSwipes')
    .withIndex('by_session_player_card', (q) =>
      q.eq('sessionId', sessionId).eq('playerToken', playerToken).eq('cardId', cardId),
    )
    .collect()

  if (rows.length === 0) {
    return null
  }

  const [first, ...duplicates] = rows
  for (const duplicate of duplicates) {
    await ctx.db.delete(duplicate._id)
  }

  return first
}

export const createSession = mutation({
  args: {
    name: v.string(),
    playerToken: v.string(),
  },
  handler: async (ctx, args) => {
    const name = validatePlayerName(args.name)
    const playerToken = validatePlayerToken(args.playerToken)
    await ensureDefaultCards(ctx)
    const cards = await getAllCards(ctx)

    if (cards.length === 0) {
      throw new ConvexError('No cards available for this game yet.')
    }

    const now = Date.now()
    const code = await generateUniqueRoomCode(ctx)

    const sessionId = await ctx.db.insert('wwwSessions', {
      code,
      gameKey: 'want-will-wont',
      hostToken: playerToken,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('wwwPlayers', {
      sessionId,
      token: playerToken,
      name,
      joinedAt: now,
      deckCardIds: shuffle(cards.map((card) => card._id)),
      deckCursor: 0,
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

    const existing = await getPlayerBySessionToken(ctx, session._id, playerToken)
    if (existing) {
      await ctx.db.patch(existing._id, { name })
      await touchPresence(ctx, session._id, playerToken)
      return { code: session.code }
    }

    const players = await getPlayers(ctx, session._id)
    if (players.length >= 2) {
      throw new ConvexError('This room already has 2 players.')
    }

    await ensureDefaultCards(ctx)
    const cards = await getAllCards(ctx)

    if (cards.length === 0) {
      throw new ConvexError('No cards available for this game yet.')
    }

    await ctx.db.insert('wwwPlayers', {
      sessionId: session._id,
      token: playerToken,
      name,
      joinedAt: Date.now(),
      deckCardIds: shuffle(cards.map((card) => card._id)),
      deckCursor: 0,
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

      await clearSessionGameData(ctx, session._id)
      await ctx.db.delete(session._id)
      return { left: true, roomClosed: true }
    }

    await clearSessionGameData(ctx, session._id)
    await resetPlayerDecks(ctx, remainingPlayers)

    const nextHostToken =
      session.hostToken === playerToken ? remainingPlayers[0].token : session.hostToken

    await ctx.db.patch(session._id, {
      hostToken: nextHostToken,
      updatedAt: Date.now(),
    })

    return { left: true, roomClosed: false }
  },
})

export const heartbeatPresence = mutation({
  args: {
    sessionId: v.id('wwwSessions'),
    playerToken: v.string(),
  },
  handler: async (ctx, args) => {
    const playerToken = validatePlayerToken(args.playerToken)
    await touchPresence(ctx, args.sessionId, playerToken)
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
      throw new ConvexError('Enter at least one card activity.')
    }

    for (const [index, line] of lines.entries()) {
      if (line.length < 2 || line.length > 64) {
        throw new ConvexError(`Line ${index + 1}: Activity must be between 2 and 64 characters.`)
      }
    }

    const now = Date.now()
    for (const [index, text] of lines.entries()) {
      await ctx.db.insert('wwwCards', {
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
    cardId: v.id('wwwCards'),
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

export const submitSwipe = mutation({
  args: {
    code: v.string(),
    playerToken: v.string(),
    decision: v.union(v.literal('want'), v.literal('will'), v.literal('wont')),
  },
  handler: async (ctx, args) => {
    const playerToken = validatePlayerToken(args.playerToken)
    const { session, players, me } = await ensureParticipant(ctx, args.code, playerToken)

    const deckCardIds = me.deckCardIds
    const deckCursor = me.deckCursor

    if (deckCardIds.length === 0) {
      throw new ConvexError('No cards available in this room.')
    }

    if (deckCursor >= deckCardIds.length) {
      return {
        done: true,
        totalCards: deckCardIds.length,
        deckCursor,
        outcome: null,
      }
    }

    const cardId = deckCardIds[deckCursor]
    const now = Date.now()

    const existingSwipe = await getExistingSwipe(ctx, session._id, playerToken, cardId)
    if (existingSwipe) {
      await ctx.db.patch(existingSwipe._id, {
        decision: args.decision,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('wwwSwipes', {
        sessionId: session._id,
        playerToken,
        cardId,
        decision: args.decision,
        createdAt: now,
        updatedAt: now,
      })
    }

    const nextCursor = deckCursor + 1
    await ctx.db.patch(me._id, {
      deckCursor: nextCursor,
      completedAt: nextCursor >= deckCardIds.length ? now : undefined,
    })

    const otherPlayer = players.find((player) => player.token !== playerToken) ?? null
    let outcomeForMe = null

    if (otherPlayer) {
      const otherSwipe = await getExistingSwipe(ctx, session._id, otherPlayer.token, cardId)
      if (otherSwipe) {
        const existingOutcome = await ctx.db
          .query('wwwOutcomes')
          .withIndex('by_session_card', (q) =>
            q.eq('sessionId', session._id).eq('cardId', cardId),
          )
          .first()

        const outcomeDoc =
          existingOutcome ??
          (await (async () => {
            const classification = classifyOutcome(args.decision, otherSwipe.decision)
            const outcomeId = await ctx.db.insert('wwwOutcomes', {
              sessionId: session._id,
              cardId,
              playerAToken: playerToken,
              playerADecision: args.decision,
              playerBToken: otherPlayer.token,
              playerBDecision: otherSwipe.decision,
              kind: classification.kind,
              isMatch: classification.isMatch,
              resolvedAt: now,
            })
            return await ctx.db.get(outcomeId)
          })())

        if (outcomeDoc) {
          outcomeForMe = formatOutcomeForPlayer(outcomeDoc, playerToken)
        }
      }
    }

    await ctx.db.patch(session._id, { updatedAt: now })

    return {
      done: nextCursor >= deckCardIds.length,
      totalCards: deckCardIds.length,
      deckCursor: nextCursor,
      outcome: outcomeForMe,
    }
  },
})

export const resetRound = mutation({
  args: {
    code: v.string(),
    playerToken: v.string(),
  },
  handler: async (ctx, args) => {
    const playerToken = validatePlayerToken(args.playerToken)
    const { session, players } = await ensureParticipant(ctx, args.code, playerToken)

    if (session.hostToken !== playerToken) {
      throw new ConvexError('Only the host can reset this room.')
    }

    await clearSessionGameData(ctx, session._id)
    await resetPlayerDecks(ctx, players)
    await ctx.db.patch(session._id, { updatedAt: Date.now() })

    return { reset: true }
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

    const [players, presenceRows, outcomes] = await Promise.all([
      getPlayers(ctx, session._id),
      getPresence(ctx, session._id),
      ctx.db
        .query('wwwOutcomes')
        .withIndex('by_session_resolved_at', (q) => q.eq('sessionId', session._id))
        .order('desc')
        .take(12),
    ])

    const me = players.find((player) => player.token === args.playerToken) ?? null
    if (!me) {
      return null
    }

    const otherPlayer = players.find((player) => player.token !== args.playerToken) ?? null
    const deckCardIds = me.deckCardIds
    const deckCursor = me.deckCursor
    const activeCardId = deckCardIds[deckCursor] ?? null

    const outcomeCardIds = Array.from(new Set(outcomes.map((outcome) => outcome.cardId)))
    const [activeCard, outcomeCards] = await Promise.all([
      activeCardId ? ctx.db.get(activeCardId) : Promise.resolve(null),
      Promise.all(outcomeCardIds.map(async (cardId) => ({ cardId, card: await ctx.db.get(cardId) }))),
    ])

    const outcomeCardTextById = new Map(
      outcomeCards
        .filter((entry): entry is { cardId: Id<'wwwCards'>; card: CardDoc } => entry.card !== null)
        .map((entry) => [entry.cardId, entry.card.text]),
    )

    const lastSeenByToken = new Map<string, number>()
    for (const row of presenceRows) {
      const current = lastSeenByToken.get(row.playerToken) ?? 0
      if (row.lastSeenAt > current) {
        lastSeenByToken.set(row.playerToken, row.lastSeenAt)
      }
    }

    const now = Date.now()
    const formattedOutcomes = outcomes
      .map((outcome) => {
        const relative = formatOutcomeForPlayer(outcome, me.token)
        if (!relative) {
          return null
        }

        return {
          ...relative,
          cardText: outcomeCardTextById.get(outcome.cardId) ?? 'Unknown activity',
        }
      })
      .filter((outcome): outcome is NonNullable<typeof outcome> => outcome !== null)

    const playersWithStatus = players.map((player) => {
      const lastSeenAt = lastSeenByToken.get(player.token) ?? null
      return {
        id: player._id,
        token: player.token,
        name: player.name,
        joinedAt: player.joinedAt,
        deckCursor: player.deckCursor,
        totalCards: player.deckCardIds.length,
        done: player.deckCursor >= player.deckCardIds.length,
        isHost: player.token === session.hostToken,
        isMe: player.token === me.token,
        isOnline:
          typeof lastSeenAt === 'number' ? now - lastSeenAt <= PRESENCE_STALE_MS : false,
        lastSeenAt,
      }
    })

    const allDone =
      playersWithStatus.length === 2 && playersWithStatus.every((player) => player.done)

    return {
      session: {
        id: session._id,
        code: session.code,
        gameKey: session.gameKey,
        hostToken: session.hostToken,
        updatedAt: session.updatedAt,
      },
      me: {
        token: me.token,
        name: me.name,
        isHost: me.token === session.hostToken,
        deckCursor,
        totalCards: deckCardIds.length,
        done: deckCursor >= deckCardIds.length,
      },
      players: playersWithStatus,
      otherPlayer: otherPlayer
        ? {
            token: otherPlayer.token,
            name: otherPlayer.name,
          }
        : null,
      activeCardId,
      activeCardText: activeCard?.text ?? null,
      outcomes: formattedOutcomes,
      allDone,
      presenceStaleMs: PRESENCE_STALE_MS,
    }
  },
})
