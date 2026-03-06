// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CombinedEntryPanel, buildInviteUrl, resolveInitialRoomInput } from './index'

describe('CombinedEntryPanel', () => {
  it('keeps the name field visible while showing invite details after room creation', () => {
    const inviteUrl = buildInviteUrl('ABCD', { href: 'https://cards.example/' })

    render(
      <CombinedEntryPanel
        name="Quiet River"
        roomInput="ABCD"
        roomCode="ABCD"
        inviteUrl={inviteUrl}
        inviteQrValue={inviteUrl}
        feedback=""
        joinedName="Quiet River"
        inviteStatus="Waiting for player 2 to join"
        playersCount={1}
        workingAction=""
        nameChangesApplyNextTime={false}
        onNameChange={vi.fn()}
        onRoomInputChange={vi.fn()}
        onCreateSubmit={vi.fn()}
        onJoinSubmit={vi.fn()}
        onLeaveRoom={vi.fn()}
      />,
    )

    expect((screen.getByPlaceholderText(/player name/i) as HTMLInputElement).value).toBe(
      'Quiet River',
    )
    expect(screen.getByText('Invite a friend')).toBeTruthy()
    expect(screen.getAllByText('ABCD')).toHaveLength(2)
    expect(screen.getByTitle('Join room ABCD')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Join room via share link' }).getAttribute('href')).toBe(
      inviteUrl,
    )
  })

  it('preserves join validation messaging on the combined entry screen', () => {
    const onJoinSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault())

    render(
      <CombinedEntryPanel
        name="Quiet River"
        roomInput=""
        roomCode=""
        inviteUrl=""
        inviteQrValue=""
        feedback="Enter a room code."
        joinedName=""
        inviteStatus=""
        playersCount={1}
        workingAction=""
        nameChangesApplyNextTime={false}
        onNameChange={vi.fn()}
        onRoomInputChange={vi.fn()}
        onCreateSubmit={vi.fn()}
        onJoinSubmit={onJoinSubmit}
        onLeaveRoom={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Join!' }))

    expect(onJoinSubmit).toHaveBeenCalled()
    expect(screen.getByText('Enter a room code.')).toBeTruthy()
  })
})

describe('resolveInitialRoomInput', () => {
  it('prefills the room code from the room query parameter', () => {
    const storageGet = vi.fn(() => 'STORED')

    expect(resolveInitialRoomInput(storageGet, '?room=xy9z')).toBe('XY9Z')
  })
})