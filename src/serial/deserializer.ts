export type SyrnykmqDeserializer = (buffer: Buffer) => Record<string, unknown>;

export const defaultDeserializer: SyrnykmqDeserializer = (buffer: Buffer) => JSON.parse(buffer.toString());
