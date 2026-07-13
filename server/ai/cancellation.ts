export const cancellationRegistry = new Map<string, AbortController>();

export function registerRequest(requestId: string): AbortController {
  const controller = new AbortController();
  cancellationRegistry.set(requestId, controller);
  return controller;
}

export function cancelRequest(requestId: string) {
  const controller = cancellationRegistry.get(requestId);
  if (controller) {
    controller.abort(new Error("USER_CANCELLED"));
    cancellationRegistry.delete(requestId);
  }
}

export function unregisterRequest(requestId: string) {
  cancellationRegistry.delete(requestId);
}
