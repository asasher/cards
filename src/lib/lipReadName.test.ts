import { describe, expect, it, vi } from 'vitest'
import { persistPlayerName, resolveInitialPlayerName } from './lipReadName'

describe('resolveInitialPlayerName', () => {
  it('reuses a stored player name without generating a new one', () => {
    const storageGet = vi.fn(() => 'Taylor Swift')
    const storageSet = vi.fn()
    const wordGenerator = vi.fn(() => 'quiet river')

    const result = resolveInitialPlayerName(storageGet, storageSet, wordGenerator)

    expect(result).toBe('Taylor Swift')
    expect(storageSet).not.toHaveBeenCalled()
    expect(wordGenerator).not.toHaveBeenCalled()
  })

  it('generates and persists a default name when none is stored', () => {
    const storageGet = vi.fn(() => null)
    const storageSet = vi.fn()
    const wordGenerator = vi.fn(() => 'quiet river')

    const result = resolveInitialPlayerName(storageGet, storageSet, wordGenerator)

    expect(result).toBe('Quiet River')
    expect(wordGenerator).toHaveBeenCalledWith({ exactly: 2, join: ' ' })
    expect(storageSet).toHaveBeenCalledWith('cards.lipread.name', 'Quiet River')
  })

  it('replaces blank stored values with a generated default', () => {
    const storageGet = vi.fn(() => '   ')
    const storageSet = vi.fn()
    const wordGenerator = vi.fn(() => ['silver', 'lantern'])

    const result = resolveInitialPlayerName(storageGet, storageSet, wordGenerator)

    expect(result).toBe('Silver Lantern')
    expect(storageSet).toHaveBeenCalledWith('cards.lipread.name', 'Silver Lantern')
  })
})

describe('persistPlayerName', () => {
  it('stores user edits for future visits', () => {
    const storageSet = vi.fn()

    persistPlayerName('  Ada  ', storageSet)

    expect(storageSet).toHaveBeenCalledWith('cards.lipread.name', '  Ada  ')
  })
})