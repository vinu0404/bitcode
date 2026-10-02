import { ApiError } from "./api";

export type Severity = "error" | "warn";

export interface Described {
  kind: Severity;
  title: string;
  body: string;
  /** Worth offering a Retry button for. */
  retryable: boolean;
}

/** One place that turns any thrown value into words a student can act on.
 * `doing` names the action in progress: "run the tests", "submit". */
export function describeError(err: unknown, doing = "finish that"): Described {
  if (err instanceof ApiError) {
    if (err.offline) {
      return { kind: "warn", title: "You are offline", body: `Could not ${doing}. Your code is kept on this device, so nothing is lost.`, retryable: true };
    }
    if (err.status === 429) {
      const wait = err.retryAfter ? `in ${err.retryAfter}s` : "in a moment";
      return { kind: "warn", title: "Easy, one at a time", body: `You can ${doing} again ${wait}.`, retryable: false };
    }
    if (err.status === 401) {
      return { kind: "warn", title: "Your session ended", body: "Log in again to carry on. Your draft is still saved.", retryable: false };
    }
    if (err.status === 403) {
      return { kind: "error", title: "Not allowed", body: err.message, retryable: false };
    }
    if (err.status === 404) {
      return { kind: "error", title: "Not found", body: err.message, retryable: false };
    }
    if (err.status >= 500) {
      return { kind: "error", title: "Something broke on our side", body: `Could not ${doing}. Try again in a moment; your code is safe.`, retryable: true };
    }
    return { kind: "error", title: `Could not ${doing}`, body: err.message, retryable: false };
  }
  return { kind: "error", title: `Could not ${doing}`, body: err instanceof Error ? err.message : "Something unexpected happened.", retryable: true };
}
