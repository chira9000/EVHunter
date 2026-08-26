import Redis from "ioredis";
import { env } from "@/lib/env";

let redis: Redis | null = null;
/** After a connection failure, skip Redis for the rest of this process. */
let redisDisabled = false;
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

function disableRedis(client: Redis): void {
  redisDisabled = true;
  redis = null;
  client.disconnect();
}

export function getRedis(): Redis | null {
  if (!env.REDIS_URL || redisDisabled) return null;
  if (!redis) {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 2000,
    });
    client.on("error", () => {
      disableRedis(client);
    });
    redis = client;
  }
  return redis;
}

async function tryRedis<T>(fn: (client: Redis) => Promise<T>): Promise<T | undefined> {
  const client = getRedis();
  if (!client) return undefined;
  try {
    if (client.status === "wait") await client.connect();
    return await fn(client);
  } catch {
    disableRedis(client);
    return undefined;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const fromRedis = await tryRedis(async (client) => {
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  });
  if (fromRedis !== undefined) return fromRedis;

  const entry = memoryCache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 60
): Promise<void> {
  const serialized = JSON.stringify(value);
  const stored = await tryRedis(async (client) => {
    await client.setex(key, ttlSeconds, serialized);
    return true;
  });
  if (stored) return;

  memoryCache.set(key, {
    value: serialized,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function cacheDel(key: string): Promise<void> {
  await tryRedis(async (client) => {
    await client.del(key);
  });
  memoryCache.delete(key);
}
