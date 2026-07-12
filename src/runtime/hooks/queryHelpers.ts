import type { QueryObserverResult } from "@tanstack/react-query";

export async function refetchOrThrow<TData>(
  refetch: () => Promise<QueryObserverResult<TData, unknown>>,
  fallback: TData
): Promise<TData> {
  const result = await refetch();
  if (result.error) throw result.error;
  return result.data ?? fallback;
}
