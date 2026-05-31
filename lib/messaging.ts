import { defineExtensionMessaging, GetDataType } from '@webext-core/messaging';

// Define all message types and their payloads/return types
export interface ProtocolMap {
  // Trigger selection - content script notifies background to call AI
  triggerSelection(data: string): { status: 'ok' }

  // Get highlight style settings
  getHighlightStyleSettings(data: undefined): any

  // Open extension options from content UI through the background context
  openOptionsPage(data: undefined): { status: 'ok' }
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
