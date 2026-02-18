import { mutationOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { createKvEntry, deleteKvEntry, updateKvEntry } from "./client";
import { kvListQueryKey } from "./query-options";
import type { KvInput, KvItem, KvUpdateInput } from "./types";

function upsertList(entries: KvItem[], next: KvItem) {
  const existingIndex = entries.findIndex((entry) => entry.key === next.key);

  if (existingIndex === -1) {
    return [next, ...entries];
  }

  const copy = [...entries];
  copy[existingIndex] = next;

  return copy;
}

export function createKvMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (input: KvInput) => createKvEntry(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: kvListQueryKey });

      const previous = queryClient.getQueryData<KvItem[]>(kvListQueryKey) ?? [];
      const optimistic: KvItem = {
        key: input.key,
        value: input.value,
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<KvItem[]>(kvListQueryKey, upsertList(previous, optimistic));

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(kvListQueryKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: kvListQueryKey });
    },
  });
}

export function updateKvMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (input: KvUpdateInput) => updateKvEntry(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: kvListQueryKey });

      const previous = queryClient.getQueryData<KvItem[]>(kvListQueryKey) ?? [];
      const optimistic: KvItem = {
        key: input.key,
        value: input.value,
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<KvItem[]>(kvListQueryKey, upsertList(previous, optimistic));

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(kvListQueryKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: kvListQueryKey });
    },
  });
}

export function deleteKvMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (key: string) => deleteKvEntry(key),
    onMutate: async (key) => {
      await queryClient.cancelQueries({ queryKey: kvListQueryKey });

      const previous = queryClient.getQueryData<KvItem[]>(kvListQueryKey) ?? [];
      queryClient.setQueryData<KvItem[]>(
        kvListQueryKey,
        previous.filter((entry) => entry.key !== key),
      );

      return { previous };
    },
    onError: (_error, _key, context) => {
      if (context?.previous) {
        queryClient.setQueryData(kvListQueryKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: kvListQueryKey });
    },
  });
}
