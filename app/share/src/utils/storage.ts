export interface StorageInterface {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
}

class MemoryStorage implements StorageInterface {
  private data: Record<string, string> = {};
  
  getItem(key: string) {
    return this.data[key] || null;
  }
  
  setItem(key: string, value: string) {
    this.data[key] = value;
  }
  
  removeItem(key: string) {
    delete this.data[key];
  }
}

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export let storage: StorageInterface = isBrowser ? window.localStorage : new MemoryStorage();

export const setStorageAdapter = (newStorage: StorageInterface) => {
  storage = newStorage;
};
