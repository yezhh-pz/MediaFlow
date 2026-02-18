import { apiClient } from "../api/client";
import type {
  OCRExtractRequest,
  OCRExtractResponse,
  TaskResponse,
  TaskResponse,
  OCRTextEvent,
} from "../api/client";

export type { OCRTextEvent, OCRExtractRequest, OCRExtractResponse };

export const ocrService = {
  extractText: async (params: OCRExtractRequest): Promise<TaskResponse> => {
    return apiClient.extractText(params);
  },
};
