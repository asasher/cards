import { queryOptions } from "@tanstack/react-query";
import { fetchKvList } from "./client";

export const kvListQueryKey = ["kv"] as const;

export function kvListQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: kvListQueryKey,
    queryFn: fetchKvList,
    enabled,
  });
}
