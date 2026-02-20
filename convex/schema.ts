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
})
