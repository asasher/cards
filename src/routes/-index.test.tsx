// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  WWWDecisionControls,
  buildInviteUrl,
  resolveInitialGame,
  resolveInitialRoomInput,
  resolveWWWSwipeDecision,
  resolveWWWSwipeSubmission,
} from './index'

afterEach(() => {
  cleanup()
})

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
    const inviteUrl = buildInviteUrl('abcd', 'lip-reading', { href: 'https://cards.example/' })
    const parsed = new URL(inviteUrl)

    expect(parsed.searchParams.get('join')).toBe('ABCD')
    expect(parsed.searchParams.get('game')).toBe('lip-reading')
  })

  it('preserves the current origin and pathname while adding share params', () => {
    const inviteUrl = buildInviteUrl('room42', 'want-will-wont', { href: 'https://cards.example/play?foo=bar' })
    const parsed = new URL(inviteUrl)

    expect(parsed.origin).toBe('https://cards.example')
    expect(parsed.pathname).toBe('/play')
    expect(parsed.searchParams.get('foo')).toBe('bar')
    expect(parsed.searchParams.get('join')).toBe('ROOM42')
    expect(parsed.searchParams.get('game')).toBe('want-will-wont')
  })
})

describe('resolveInitialGame', () => {
  it('routes shared want / will / won\'t invite links into the correct game', () => {
    expect(resolveInitialGame(() => null, '?join=room42&game=want-will-wont')).toBe('want-will-wont')
  })

  it('falls back to the stored selection when the URL has no valid game', () => {
    expect(resolveInitialGame(vi.fn(() => 'lip-reading'), '?join=room42&game=unknown')).toBe('lip-reading')
  })
})

describe('resolveWWWSwipeDecision', () => {
  it('maps left, up, and right swipes to the correct decisions', () => {
    expect(resolveWWWSwipeDecision(-80, 4)).toBe('wont')
    expect(resolveWWWSwipeDecision(5, -84)).toBe('want')
    expect(resolveWWWSwipeDecision(88, 2)).toBe('will')
  })

  it('ignores short or downward gestures', () => {
    expect(resolveWWWSwipeDecision(24, 12)).toBeNull()
    expect(resolveWWWSwipeDecision(2, 90)).toBeNull()
  })
})

describe('resolveWWWSwipeSubmission', () => {
  it('blocks gesture submission when the player cannot act', () => {
    expect(resolveWWWSwipeSubmission(false, -96, 0)).toBeNull()
  })

  it('allows valid gesture submission when the player can act', () => {
    expect(resolveWWWSwipeSubmission(true, -96, 0)).toBe('wont')
    expect(resolveWWWSwipeSubmission(true, 0, -96)).toBe('want')
    expect(resolveWWWSwipeSubmission(true, 96, 0)).toBe('will')
  })
})

describe('WWWDecisionControls', () => {
  it('shows one swipe-or-tap hint and preserves tap controls', () => {
    const onDecision = vi.fn()

    render(<WWWDecisionControls canSubmitDecision onDecision={onDecision} showHint working={false} />)

    expect(screen.getByText('Swipe the card, or tap a choice below.')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Decision choices' })).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: /won't/i }))

    expect(onDecision).toHaveBeenCalledWith('wont')
  })
})