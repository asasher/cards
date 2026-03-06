import { generate } from 'random-words'

const NAME_STORAGE_KEY = 'cards.lipread.name'

type StorageGet = (key: string) => string | null
type StorageSet = (key: string, value: string) => void
type WordGenerator = (options: { exactly: number; join: string }) => string | string[]

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

function capitalize(word: string) {
  return `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`
}

function formatGeneratedName(words: string | string[]) {
  const parts = Array.isArray(words) ? words : words.split(' ')
  return parts.filter(Boolean).slice(0, 2).map(capitalize).join(' ')
}

export function createDefaultPlayerName(wordGenerator: WordGenerator = generate) {
  return formatGeneratedName(wordGenerator({ exactly: 2, join: ' ' }))
}

export function resolveInitialPlayerName(
  storageGet: StorageGet = safeStorageGet,
  storageSet: StorageSet = safeStorageSet,
  wordGenerator: WordGenerator = generate,
) {
  const storedName = storageGet(NAME_STORAGE_KEY)
  if (storedName && storedName.trim()) {
    return storedName
  }

  const generatedName = createDefaultPlayerName(wordGenerator)
  storageSet(NAME_STORAGE_KEY, generatedName)
  return generatedName
}

export function persistPlayerName(name: string, storageSet: StorageSet = safeStorageSet) {
  storageSet(NAME_STORAGE_KEY, name)
}