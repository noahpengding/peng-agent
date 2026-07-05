import { apiCall } from '../utils/apiCall';
import type { Memory, MemoryPageResponse } from '../hooks/MemoryAPI';

type RawRecord = Record<string, unknown>;

const asRecord = (value: unknown): RawRecord => {
  if (typeof value === 'object' && value !== null) {
    return value as RawRecord;
  }
  return {};
};

const toStringValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

const toOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  return String(value);
};

const toNumberValue = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeMemory = (value: unknown): Memory => {
  const memory = asRecord(value);
  return {
    id: toStringValue(memory.id),
    user_name: toStringValue(memory.user_name ?? memory.username),
    type: toStringValue(memory.type),
    base_model: toStringValue(memory.base_model),
    human_input: toStringValue(memory.human_input),
    other_input: toStringValue(memory.other_input),
    ai_response: toStringValue(memory.ai_response),
    created_at: toOptionalString(memory.created_at),
    timestamp: toOptionalString(memory.timestamp),
  };
};

const normalizeMemoryPageResponse = (value: unknown): MemoryPageResponse => {
  const response = asRecord(value);
  const rawMemories = Array.isArray(response.memories) ? response.memories : Array.isArray(value) ? value : [];
  const memories = rawMemories.map(normalizeMemory).filter((memory) => memory.id);
  const page = Math.max(toNumberValue(response.page, 1), 1);
  const pageSize = Math.max(toNumberValue(response.page_size, 20), 1);
  const totalCount = Math.max(toNumberValue(response.total_count, memories.length), 0);
  const totalPages = Math.max(toNumberValue(response.total_pages, Math.ceil(totalCount / pageSize) || 1), 1);

  return {
    memories,
    page,
    page_size: pageSize,
    total_count: totalCount,
    total_pages: totalPages,
    has_next: Boolean(response.has_next),
    has_previous: Boolean(response.has_previous),
    search: toStringValue(response.search),
  };
};

export const MemoryService = {
  async fetchMemories(username: string, page = 1, search = ''): Promise<MemoryPageResponse> {
    try {
      const response = await apiCall('POST', '/memory', {
        user_name: username,
        page,
        search,
      });
      return normalizeMemoryPageResponse(response);
    } catch (error) {
      throw error;
    }
  },
};
