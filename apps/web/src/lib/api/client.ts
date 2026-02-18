import { edenTreaty } from "@elysiajs/eden";
import type { ApiApp } from "@/server/api";
import type { KvInput, KvItem, KvUpdateInput } from "./types";

function createClient() {
  const baseUrl =
    typeof window === "undefined" ? "http://localhost:3000/api" : `${window.location.origin}/api`;

  return edenTreaty<ApiApp>(baseUrl);
}

function unwrapResult<T>(result: { data: T | null; error: unknown }) {
  if (result.error) {
    if (result.error instanceof Error) {
      throw result.error;
    }

    throw new Error("API request failed.");
  }

  if (result.data === null) {
    throw new Error("API response data was empty.");
  }

  return result.data;
}

export async function fetchKvList() {
  const api = createClient();
  const result = await api.api.kv.get();
  const data = unwrapResult<{ items: KvItem[] }>(result);

  return data.items;
}

export async function createKvEntry(input: KvInput) {
  const api = createClient();
  const result = await api.api.kv.post(input);
  const data = unwrapResult<{ item: KvItem }>(result);

  return data.item;
}

export async function updateKvEntry(input: KvUpdateInput) {
  const api = createClient();
  const result = await api.api.kv.patch({ key: input.key, value: input.value });
  const data = unwrapResult<{ item: KvItem }>(result);

  return data.item;
}

export async function deleteKvEntry(key: string) {
  const api = createClient();
  const result = await api.api.kv.delete({ key });

  unwrapResult<{ ok: boolean; key: string }>(result);

  return key;
}
