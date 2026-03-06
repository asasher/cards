// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { buildInviteUrl, resolveInitialRoomInput } from './index'

describe('resolveInitialRoomInput', () => {
  it('prefills the room code from the room query parameter', () => {
    const storageGet = vi.fn(() => 'STORED')

    expect(resolveInitialRoomInput(storageGet, '?room=xy9z')).toBe('XY9Z')
  })

  it('prefills the room code from the unified join query parameter', () => {
    expect(resolveInitialRoomInput(() => 'STORED', '?join=abcd')).toBe('ABCD')
  })
})

describe('buildInviteUrl', () => {
  it('builds a lip-read invite URL using the shared join/game query structure', () => {
    const inviteUrl = buildInviteUrl('abcd', { href: 'https://cards.example/' })
    const parsed = new URL(inviteUrl)

    expect(parsed.searchParams.get('join')).toBe('ABCD')
    expect(parsed.searchParams.get('game')).toBe('lip-reading')
  })

  it('preserves the current origin and pathname while adding share params', () => {
    const inviteUrl = buildInviteUrl('room42', { href: 'https://cards.example/play?foo=bar' })
    const parsed = new URL(inviteUrl)

    expect(parsed.origin).toBe('https://cards.example')
    expect(parsed.pathname).toBe('/play')
    expect(parsed.searchParams.get('foo')).toBe('bar')
    expect(parsed.searchParams.get('join')).toBe('ROOM42')
    expect(parsed.searchParams.get('game')).toBe('lip-reading')
  })
})