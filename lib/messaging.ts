import { defineExtensionMessaging, GetDataType } from '@webext-core/messaging';

// Define all message types and their payloads/return types
export interface ProtocolMap {
  // Save word or phrase
  saveWordOrPhrase(data: {
    wordOrPhrase: string;
    meaning: string;
  }): { title: string; detail: string };

  // Pagination query
  findByPage(data: {
    pageNum: number;
    pageSize: number;
  }): { records: any[]; total: number };

  // Fuzzy search
  fuzzySearchByKeyword(data: string): { records: any[]; total: number };

  // Delete word or phrase
  deleteWordOrPhrase(data: {
    wordOrPhrase: string;
  }): undefined | string;

  // Open side panel
  openSidePanel(data: undefined): Promise<void>;

  // SidePanelPrepared
  sidePanelPrepared(data: undefined): Promise<void>;

  // SidePanelClosed
  sidePanelClosed(data: undefined): Promise<void>;

  // Trigger selection
  triggerSelection(data: string): Promise<void>;

  // Trigger check
  triggerCheck(data: string): Promise<void>;

  // Get all records
  getAllRecordsData(data: undefined): Promise<any[]>;

  // Get highlight style settings
  getHighlightStyleSettings(data: undefined): Promise<any>;

  // Send to AI
  sendToAi(data: string): Promise<void>;

  // Check word
  checkWord(data: string): Promise<void>;
}

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
