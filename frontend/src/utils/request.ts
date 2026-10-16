/** Keep a slow or unreachable API from leaving a screen loading indefinitely. */
export function request(input: RequestInfo | URL, init?: RequestInit) {
    return fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) })
}
