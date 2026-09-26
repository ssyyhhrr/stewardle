/**
 * Talking to the server. Every call resolves to a tagged result instead of
 * throwing, so the UI has to handle "offline" and "rejected" explicitly.
 */
import type { ErrorResponse, GuessRequest, GuessResponse, PuzzleResponse } from "../../core/api";

/** A call's outcome: the data, a server refusal, or no usable answer at all. */
export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly kind: "rejected"; readonly error: ErrorResponse["error"] }
  | { readonly ok: false; readonly kind: "offline" };

async function call<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch {
    return { ok: false, kind: "offline" };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, kind: "offline" };
  }
  if (response.ok) return { ok: true, data: body as T };
  const error = (body as Partial<ErrorResponse> | null)?.error;
  return error ? { ok: false, kind: "rejected", error } : { ok: false, kind: "offline" };
}

/** Today's puzzle and the driver list. */
export function fetchPuzzle(): Promise<ApiResult<PuzzleResponse>> {
  return call<PuzzleResponse>("/api/puzzle", { cache: "no-store" });
}

/** Submits a guess with the token from the previous one (null for the first). */
export function submitGuess(request: GuessRequest): Promise<ApiResult<GuessResponse>> {
  return call<GuessResponse>("/api/guess", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
}
