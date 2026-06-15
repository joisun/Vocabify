import { sendMessage } from '@/lib/messaging'
import {
  db,
  normalizeWordOrPhrase,
  withFamiliarityDefaults,
  type PosType,
  type VocabRecord,
  type VocabSense,
  type VocabTombstone,
} from '@/lib/vocabifyDb'
import { clampScore } from '@/lib/familiarity'
import {
  githubAccessToken,
  githubLastSyncAt,
  githubSyncAccount,
} from '@/utils/storage'

export const GITHUB_SYNC_CLIENT_ID = 'Ov23liwjMLi50xHATOtV'
export const GITHUB_SYNC_REPO = '__Vocabify_Data_Center__'
export const GITHUB_SYNC_PATH = 'syncdata.json'
export const GITHUB_SYNC_SCOPE = 'repo'

export type GitHubDeviceFlow = {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export type SyncPayload = {
  schemaVersion: 2
  updatedAt: string
  records: Array<Omit<VocabRecord, 'id'>>
  tombstones: VocabTombstone[]
}

const VALID_POS: PosType[] = ['n', 'v', 'adj', 'adv', 'phrase', 'other']

export type SyncResult = {
  account: {
    login: string
    repoName: string
  }
  recordCount: number
  tombstoneCount: number
  remoteCreated: boolean
  syncedAt: string
}

type TokenPollResult = {
  access_token?: string
  error?: string
  error_description?: string
}

export async function startGitHubDeviceFlow() {
  return sendMessage('githubStartDeviceFlow', {
    clientId: GITHUB_SYNC_CLIENT_ID,
    scope: GITHUB_SYNC_SCOPE,
  })
}

export async function pollGitHubDeviceToken(
  deviceFlow: GitHubDeviceFlow,
  onPending?: (status: { elapsedMs: number; intervalMs: number }) => void,
  signal?: AbortSignal,
) {
  const startedAt = Date.now()
  let intervalMs = Math.max(deviceFlow.interval || 5, 1) * 1000

  while (Date.now() - startedAt < deviceFlow.expires_in * 1000) {
    await sleep(intervalMs, signal)
    onPending?.({ elapsedMs: Date.now() - startedAt, intervalMs })

    const result = await sendMessage('githubPollDeviceToken', {
      clientId: GITHUB_SYNC_CLIENT_ID,
      deviceCode: deviceFlow.device_code,
    }) as TokenPollResult

    if (result.access_token) return result.access_token
    if (result.error === 'authorization_pending') continue
    if (result.error === 'slow_down') {
      intervalMs += 5000
      continue
    }
    if (result.error === 'access_denied') {
      throw new Error('GitHub authorization was cancelled.')
    }
    if (result.error === 'expired_token') {
      throw new Error('GitHub authorization expired. Start again.')
    }

    throw new Error(result.error_description || result.error || 'GitHub authorization failed.')
  }

  throw new Error('GitHub authorization expired. Start again.')
}

export async function syncVocabularyWithGitHub(token: string): Promise<SyncResult> {
  const user = await sendMessage('githubGetUser', { token })
  const repo = await sendMessage('githubEnsureRepo', {
    token,
    repoName: GITHUB_SYNC_REPO,
  })
  const remoteFile = await sendMessage('githubGetFile', {
    token,
    owner: user.login,
    repo: GITHUB_SYNC_REPO,
    path: GITHUB_SYNC_PATH,
  })

  const localPayload = await createLocalPayload()
  const remotePayload = remoteFile.exists
    ? decodeRemotePayload(remoteFile.content || '')
    : createEmptyPayload()
  const mergedPayload = mergePayloads(localPayload, remotePayload)

  await applyPayloadToLocal(mergedPayload)

  const syncedAt = new Date().toISOString()
  const payloadToWrite: SyncPayload = {
    ...mergedPayload,
    updatedAt: syncedAt,
  }

  await sendMessage('githubPutFile', {
    token,
    owner: user.login,
    repo: GITHUB_SYNC_REPO,
    path: GITHUB_SYNC_PATH,
    message: `Sync Vocabify data at ${syncedAt}`,
    content: encodeBase64(JSON.stringify(payloadToWrite, null, 2)),
    sha: remoteFile.sha,
  })

  const account = {
    login: user.login,
    repoName: GITHUB_SYNC_REPO,
  }
  await githubAccessToken.setValue(token)
  await githubSyncAccount.setValue(account)
  await githubLastSyncAt.setValue(syncedAt)

  return {
    account,
    recordCount: payloadToWrite.records.length,
    tombstoneCount: payloadToWrite.tombstones.length,
    remoteCreated: repo.created,
    syncedAt,
  }
}

export async function disconnectGitHubSync() {
  await githubAccessToken.removeValue()
  await githubSyncAccount.removeValue()
  await githubLastSyncAt.removeValue()
}

function createEmptyPayload(): SyncPayload {
  return {
    schemaVersion: 2,
    updatedAt: new Date(0).toISOString(),
    records: [],
    tombstones: [],
  }
}

async function createLocalPayload(): Promise<SyncPayload> {
  const records = await db.records.toArray()
  const tombstones = await db.syncTombstones.toArray()

  return {
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    records: normalizeRecords(records),
    tombstones: normalizeTombstones(tombstones),
  }
}

function decodeRemotePayload(content: string): SyncPayload {
  if (!content.trim()) return createEmptyPayload()

  const parsed = JSON.parse(decodeBase64(content))

  // Legacy syncdata.json was a raw array of records.
  if (Array.isArray(parsed)) {
    return {
      schemaVersion: 2,
      updatedAt: new Date(0).toISOString(),
      records: normalizeRecords(parsed),
      tombstones: [],
    }
  }

  return {
    schemaVersion: 2,
    updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    records: normalizeRecords(Array.isArray(parsed?.records) ? parsed.records : []),
    tombstones: normalizeTombstones(Array.isArray(parsed?.tombstones) ? parsed.tombstones : []),
  }
}

function mergePayloads(local: SyncPayload, remote: SyncPayload): SyncPayload {
  const records = new Map<string, Omit<VocabRecord, 'id'>>()
  const tombstones = new Map<string, VocabTombstone>()
  const localRecords = toRecordMap(local.records)
  const remoteRecords = toRecordMap(remote.records)
  const localTombstones = toTombstoneMap(local.tombstones)
  const remoteTombstones = toTombstoneMap(remote.tombstones)
  const keys = new Set([
    ...localRecords.keys(),
    ...remoteRecords.keys(),
    ...localTombstones.keys(),
    ...remoteTombstones.keys(),
  ])

  keys.forEach((key) => {
    const winningRecord = latestRecord(localRecords.get(key), remoteRecords.get(key))
    const winningTombstone = latestTombstone(localTombstones.get(key), remoteTombstones.get(key))

    if (winningTombstone && (!winningRecord || winningTombstone.deletedAt >= winningRecord.updatedAt)) {
      tombstones.set(key, winningTombstone)
      return
    }

    if (winningRecord) records.set(key, winningRecord)
  })

  return {
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    records: Array.from(records.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    tombstones: Array.from(tombstones.values()).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
  }
}

async function applyPayloadToLocal(payload: SyncPayload) {
  const existing = await db.records.toArray()
  const existingByKey = new Map(existing.map((record) => [normalizeWordOrPhrase(record.wordOrPhrase), record]))
  const nextKeys = new Set(payload.records.map((record) => record.wordOrPhrase))

  await db.transaction('rw', db.records, db.syncTombstones, async () => {
    for (const record of payload.records) {
      const existingRecord = existingByKey.get(record.wordOrPhrase)
      if (existingRecord?.id) {
        await db.records.update(existingRecord.id, record)
      } else {
        await db.records.add(record)
      }
    }

    for (const record of existing) {
      if (record.id && !nextKeys.has(normalizeWordOrPhrase(record.wordOrPhrase))) {
        await db.records.delete(record.id)
      }
    }

    await db.syncTombstones.clear()
    if (payload.tombstones.length > 0) {
      await db.syncTombstones.bulkPut(payload.tombstones)
    }
  })
}

function normalizeRecords(records: Array<Partial<VocabRecord>>) {
  return records
    .map((record): Omit<VocabRecord, 'id'> | null => {
      const wordOrPhrase = normalizeWordOrPhrase(String(record.wordOrPhrase || ''))
      const term = String(record.term || record.wordOrPhrase || '').trim()
      if (!wordOrPhrase || !term) return null

      // Reject legacy v1 records (had a `meaning` string but no `senses` array).
      const senses = normalizeSenses(record.senses)
      if (senses.length === 0) return null

      const pos = VALID_POS.includes(record.pos as PosType) ? (record.pos as PosType) : 'other'
      const phonetic = String(record.phonetic || '').trim()
      const mnemonic = String(record.mnemonic || '').trim()
      const tags = Array.isArray(record.tags) ? record.tags.filter((t): t is string => typeof t === 'string') : []
      const sourceUrl = String(record.sourceUrl || '').trim()
      const sourceContext = String(record.sourceContext || '').trim()

      const createdAt = normalizeDate(record.createdAt, record.updatedAt)
      const updatedAt = normalizeDate(record.updatedAt, record.createdAt)

      return withFamiliarityDefaults({
        wordOrPhrase,
        term,
        phonetic,
        pos,
        senses,
        mnemonic,
        tags,
        sourceUrl,
        sourceContext,
        createdAt,
        updatedAt,
        score: typeof record.score === 'number' ? clampScore(record.score) : 0,
        firstMarkedAt: normalizeOptionalDate(record.firstMarkedAt),
        lastMarkedAt: normalizeOptionalDate(record.lastMarkedAt),
        lastDecayAt: normalizeOptionalDate(record.lastDecayAt),
      })
    })
    .filter((r): r is Omit<VocabRecord, 'id'> => r !== null)
}

function normalizeSenses(senses: unknown): VocabSense[] {
  if (!Array.isArray(senses)) return []
  return senses
    .map((sense, i): VocabSense | null => {
      if (!sense || typeof sense !== 'object') return null
      const s = sense as Record<string, unknown>
      const definition = String(s.definition || '').trim()
      if (!definition) return null
      return {
        id: typeof s.id === 'string' ? s.id : `s${i + 1}`,
        definition,
        example: String(s.example || '').trim(),
        exampleTranslation: String(s.exampleTranslation || '').trim(),
      }
    })
    .filter((s): s is VocabSense => s !== null)
    .slice(0, 3)
}

function normalizeTombstones(tombstones: Array<Partial<VocabTombstone>>) {
  return tombstones
    .map((tombstone) => {
      const wordOrPhrase = normalizeWordOrPhrase(String(tombstone.wordOrPhrase || ''))
      if (!wordOrPhrase) return null
      return {
        wordOrPhrase,
        deletedAt: normalizeDate(tombstone.deletedAt),
      }
    })
    .filter(Boolean) as VocabTombstone[]
}

function toRecordMap(records: Array<Omit<VocabRecord, 'id'>>) {
  const map = new Map<string, Omit<VocabRecord, 'id'>>()
  records.forEach((record) => {
    const existing = map.get(record.wordOrPhrase)
    map.set(record.wordOrPhrase, latestRecord(existing, record) || record)
  })
  return map
}

function toTombstoneMap(tombstones: VocabTombstone[]) {
  const map = new Map<string, VocabTombstone>()
  tombstones.forEach((tombstone) => {
    const existing = map.get(tombstone.wordOrPhrase)
    map.set(tombstone.wordOrPhrase, latestTombstone(existing, tombstone) || tombstone)
  })
  return map
}

function latestRecord(
  first?: Omit<VocabRecord, 'id'>,
  second?: Omit<VocabRecord, 'id'>,
) {
  if (!first) return second
  if (!second) return first
  return first.updatedAt >= second.updatedAt ? first : second
}

function latestTombstone(first?: VocabTombstone, second?: VocabTombstone) {
  if (!first) return second
  if (!second) return first
  return first.deletedAt >= second.deletedAt ? first : second
}

function normalizeDate(primary?: string, fallback?: string) {
  const value = primary || fallback
  if (value && !Number.isNaN(new Date(value).getTime())) return new Date(value).toISOString()
  return new Date().toISOString()
}

/**
 * Familiarity timestamps are nullable: a brand-new word has no
 * firstMarkedAt / lastMarkedAt / lastDecayAt until the user marks it.
 * Treat invalid or missing strings as null instead of "now" so syncing
 * never accidentally promotes an unmarked word into the decay timeline.
 */
function normalizeOptionalDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return null
  return new Date(time).toISOString()
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function decodeBase64(value: string) {
  const compact = value.replace(/\s/g, '')
  const binary = atob(compact)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('GitHub authorization was cancelled.', 'AbortError'))
      return
    }

    const timer = window.setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('GitHub authorization was cancelled.', 'AbortError'))
    }, { once: true })
  })
}
