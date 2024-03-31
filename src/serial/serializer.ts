export type SyrnykmqSerializer = (object: Record<string, unknown>) => Buffer;

export const defaultSerializer: SyrnykmqSerializer = (object: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(object));
