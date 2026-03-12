// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  WWWDecisionControls,
  WWWSwipeCardFace,
  buildInviteUrl,
  getWWWSwipeFeedback,
  resolveInitialGame,
  resolveInitialRoomInput,
  resolveWWWSwipeDecision,
  resolveWWWSwipePreviewDecision,
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

describe('resolveWWWSwipePreviewDecision', () => {
  it('surfaces the drag direction before the full swipe threshold is reached', () => {
    expect(resolveWWWSwipePreviewDecision(-18, 2)).toBe('wont')
    expect(resolveWWWSwipePreviewDecision(4, -18)).toBe('want')
    expect(resolveWWWSwipePreviewDecision(18, 1)).toBe('will')
  })

  it('stays neutral for tiny or downward drags', () => {
    expect(resolveWWWSwipePreviewDecision(4, 3)).toBeNull()
    expect(resolveWWWSwipePreviewDecision(0, 18)).toBeNull()
  })
})

describe('getWWWSwipeFeedback', () => {
  it('tracks the drag offset while keeping the swipe cue and submission mapping', () => {
    expect(getWWWSwipeFeedback(-120, 10)).toEqual({
      previewDecision: 'wont',
      committedDecision: 'wont',
      cue: "← Won't",
      progress: 1,
      translateX: -120,
      translateY: 10,
      rotate: -13.333333333333334,
      scale: 0.96,
      opacity: 0.94,
    })
  })

  it('shows upward pre-submit feedback before the full swipe threshold', () => {
    const feedback = getWWWSwipeFeedback(0, -20)

    expect(feedback.previewDecision).toBe('want')
    expect(feedback.committedDecision).toBeNull()
    expect(feedback.cue).toBe('↑ Want')
    expect(feedback.translateX).toBe(0)
    expect(feedback.translateY).toBe(-20)
    expect(feedback.rotate).toBe(0)
    expect(feedback.progress).toBeCloseTo(20 / 48)
    expect(feedback.scale).toBeCloseTo(1 - (20 / 48) * 0.04)
    expect(feedback.opacity).toBeCloseTo(1 - (20 / 48) * 0.06)
  })

  it('only clamps extremely large drags so the card can visibly follow the pointer', () => {
    const feedback = getWWWSwipeFeedback(220, -220)

    expect(feedback.translateX).toBe(220)
    expect(feedback.translateY).toBe(-220)
    expect(feedback.rotate).toBe(14)
  })

  it('applies soft resistance only after very large drags', () => {
    const feedback = getWWWSwipeFeedback(320, -320)

    expect(feedback.translateX).toBeCloseTo(255)
    expect(feedback.translateY).toBeCloseTo(-255)
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

class PointerDragHarness extends React.Component<
  Record<string, never>,
  { dragOffset: { x: number; y: number } }
> {
  pointerStart: { pointerId: number; clientX: number; clientY: number } | null = null

  state = {
    dragOffset: { x: 0, y: 0 },
  }

  render() {
    const dragFeedback = getWWWSwipeFeedback(this.state.dragOffset.x, this.state.dragOffset.y)
    const isDragging = this.state.dragOffset.x !== 0 || this.state.dragOffset.y !== 0

    return (
      <div
        aria-label="Swipe activity card"
        onPointerDown={(event: React.PointerEvent<HTMLDivElement>) => {
          this.pointerStart = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY }
          this.setState({ dragOffset: { x: 0, y: 0 } })
        }}
        onPointerMove={(event: React.PointerEvent<HTMLDivElement>) => {
          const start = this.pointerStart
          if (!start || start.pointerId !== event.pointerId) {
            return
          }

          this.setState({ dragOffset: { x: event.clientX - start.clientX, y: event.clientY - start.clientY } })
        }}
        onPointerUp={() => {
          this.pointerStart = null
          this.setState({ dragOffset: { x: 0, y: 0 } })
        }}
      >
        <WWWSwipeCardFace activeCardId="demo-card" activeCardText="Go dancing" canSwipe dragFeedback={dragFeedback} isDragging={isDragging} />
      </div>
    )
  }
}

describe('WWWSwipeCardFace', () => {
  it('keeps the scale animation on a wrapper while the inner card visibly translates during drag', () => {
    render(<PointerDragHarness />)

    const target = screen.getByLabelText('Swipe activity card')
    const animatedWrapper = target.firstElementChild as HTMLDivElement
    const face = animatedWrapper.firstElementChild as HTMLDivElement

    expect(animatedWrapper).toBeTruthy()
    expect(animatedWrapper.className).toContain('aScale')
    expect(animatedWrapper.style.transform).toBe('')

    expect(face.style.transform).toContain('translate3d(0px, 0px, 0)')

    fireEvent.pointerDown(target, { pointerId: 1, clientX: 100, clientY: 120 })
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 160, clientY: 84 })

    expect(face.style.transform).toContain('translate3d(60px, -36px, 0)')

    fireEvent.pointerUp(target, { pointerId: 1, clientX: 160, clientY: 84 })

    expect(face.style.transform).toContain('translate3d(0px, 0px, 0)')
  })
})