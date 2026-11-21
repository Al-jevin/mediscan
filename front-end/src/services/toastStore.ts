export type AppToast = {
  id: number;
  title: string;
  body: string;
};

type Listener = (toast: AppToast | null) => void;

let listener: Listener | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let seq = 0;

/** Show a non-blocking in-app toast (reminder fallback when OS notifications fail). */
export function showAppToast(title: string, body: string, durationMs = 5000): void {
  seq += 1;
  const toast: AppToast = { id: seq, title, body };
  listener?.(toast);
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    listener?.(null);
    hideTimer = null;
  }, durationMs);
}

export function dismissAppToast(): void {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
  listener?.(null);
}

export function subscribeAppToast(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}
