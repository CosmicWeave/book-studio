/**
 * Recursively converts BigInt values to numbers in any JSON-serializable value.
 * Prisma returns BigInt for BIGINT columns; this ensures safe JSON responses.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? Number(v) : v)),
  ) as T;
}
