import { defineExtensionMessaging, GetDataType } from '@webext-core/messaging';
import type { MarkAction } from '@/lib/familiarity'
import type { NewVocabPayload, VocabRecord, VocabTombstone } from '@/lib/vocabTypes'

// Define all message types and their payloads/return types
export interface ProtocolMap {
  // Get highlight style settings
  getHighlightStyleSettings(data: undefined): any

  // Open extension options from content UI through the background context
  openOptionsPage(data: undefined): { status: 'ok' }

  githubStartDeviceFlow(data: { clientId: string; scope: string }): {
    device_code: string
    user_code: string
    verification_uri: string
    expires_in: number
    interval: number
  }

  githubPollDeviceToken(data: { clientId: string; deviceCode: string }): {
    access_token?: string
    token_type?: string
    scope?: string
    error?: string
    error_description?: string
  }

  githubGetUser(data: { token: string }): { login: string }

  githubEnsureRepo(data: { token: string; repoName: string }): { created: boolean }

  githubGetFile(data: { token: string; owner: string; repo: string; path: string }): {
    exists: boolean
    sha?: string
    content?: string
  }

  githubPutFile(data: {
    token: string
    owner: string
    repo: string
    path: string
    message: string
    content: string
    sha?: string
  }): { sha?: string }

  vocabGetAll(data: undefined): VocabRecord[]

  vocabCount(data: undefined): { count: number }

  vocabSearch(data: { keyword: string }): VocabRecord[]

  vocabGetById(data: { id: number }): VocabRecord | null

  vocabGetByWord(data: { wordOrPhrase: string }): VocabRecord | null

  vocabSave(data: NewVocabPayload): { record: VocabRecord; created: boolean }

  vocabUpdate(data: {
    id: number
    patch: Partial<Omit<VocabRecord, 'id' | 'wordOrPhrase' | 'createdAt'>>
  }): VocabRecord | null

  vocabDeleteById(data: { id: number }): { status: 'ok' }

  vocabMark(data: { id: number; action: MarkAction }): VocabRecord | null

  vocabSettle(data: { id: number; now?: number }): VocabRecord | null

  vocabExport(data: undefined): {
    records: Array<Omit<VocabRecord, 'id'>>
    tombstones: VocabTombstone[]
  }

  vocabImport(data: {
    records: Array<Partial<VocabRecord>>
    tombstones: Array<Partial<VocabTombstone>>
  }): { recordCount: number; tombstoneCount: number }

  vocabReplace(data: {
    records: Array<Partial<VocabRecord>>
    tombstones: Array<Partial<VocabTombstone>>
  }): { recordCount: number; tombstoneCount: number }
}

export type RuntimeMessage =
  | { type: 'openVocabList' }
  | { type: 'vocabChanged' }

// Create and export the messaging functions
export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();

// Define response type for backward compatibility
export interface ResponseType<T = any> {
  status: 'success' | 'error';
  message: T;
}

// Helper function to send messages with proper response handling
export async function sendMessageWithResponse<K extends keyof ProtocolMap>(
  action: K,
  payload: GetDataType<ProtocolMap[K]>
): Promise<ResponseType> {
  try {
    const response = await sendMessage(action, payload);
    return {
      status: 'success',
      message: response,
    };
  } catch (error) {
    console.error(`Error sending message ${String(action)}:`, error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
