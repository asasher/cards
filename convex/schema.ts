import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  sessions: defineTable({
    code: v.string(),
    gameKey: v.literal('lip-reading'),
    phase: v.union(v.literal('lobby'), v.literal('round'), v.literal('round_over')),
    hostToken: v.string(),
    turnToken: v.optional(v.string()),
    roundNumber: v.number(),
    roundDurationSeconds: v.number(),
    roundEndsAt: v.optional(v.number()),
    deckCardIds: v.optional(v.array(v.id('cards'))),
    deckCursor: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_code', ['code']),

  players: defineTable({
    sessionId: v.id('sessions'),
    token: v.string(),
    name: v.string(),
    score: v.number(),
    joinedAt: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_session_joined_at', ['sessionId', 'joinedAt'])
    .index('by_session_token', ['sessionId', 'token']),

  presence: defineTable({
    sessionId: v.id('sessions'),
    playerToken: v.string(),
    lastSeenAt: v.number(),
    joinedAt: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_session_token', ['sessionId', 'playerToken']),

  cards: defineTable({
    sessionId: v.optional(v.id('sessions')),
    text: v.string(),
    source: v.union(v.literal('default'), v.literal('custom')),
    createdByToken: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_created_at', ['createdAt']),

  wwwSessions: defineTable({
    code: v.string(),
    gameKey: v.literal('want-will-wont'),
    hostToken: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_code', ['code']),

  wwwPlayers: defineTable({
    sessionId: v.id('wwwSessions'),
    token: v.string(),
    name: v.string(),
    joinedAt: v.number(),
    deckCardIds: v.array(v.id('wwwCards')),
    deckCursor: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_session', ['sessionId'])
    .index('by_session_joined_at', ['sessionId', 'joinedAt'])
    .index('by_session_token', ['sessionId', 'token']),

  wwwPresence: defineTable({
    sessionId: v.id('wwwSessions'),
    playerToken: v.string(),
    lastSeenAt: v.number(),
    joinedAt: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_session_token', ['sessionId', 'playerToken']),

  wwwCards: defineTable({
    text: v.string(),
    source: v.union(v.literal('default'), v.literal('custom')),
    createdByToken: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_created_at', ['createdAt']),

  wwwSwipes: defineTable({
    sessionId: v.id('wwwSessions'),
    playerToken: v.string(),
    cardId: v.id('wwwCards'),
    decision: v.union(v.literal('want'), v.literal('will'), v.literal('wont')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_session_player', ['sessionId', 'playerToken'])
    .index('by_session_card', ['sessionId', 'cardId'])
    .index('by_session_player_card', ['sessionId', 'playerToken', 'cardId']),

  wwwOutcomes: defineTable({
    sessionId: v.id('wwwSessions'),
    cardId: v.id('wwwCards'),
    playerAToken: v.string(),
    playerADecision: v.union(v.literal('want'), v.literal('will'), v.literal('wont')),
    playerBToken: v.string(),
    playerBDecision: v.union(v.literal('want'), v.literal('will'), v.literal('wont')),
    kind: v.union(
      v.literal('both_wont'),
      v.literal('mutual_will'),
      v.literal('mixed_will_wont'),
      v.literal('mutual_want'),
      v.literal('want_plus_will'),
      v.literal('want_blocked'),
    ),
    isMatch: v.boolean(),
    resolvedAt: v.number(),
  })
    .index('by_session_resolved_at', ['sessionId', 'resolvedAt'])
    .index('by_session_card', ['sessionId', 'cardId']),
})
