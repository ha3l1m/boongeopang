export type Notify = { onChanged: () => void; onError: (message: string) => void }

export function runSafely(action: () => void, { onChanged, onError }: Notify, fallback: string): void {
  try {
    action()
    onChanged()
  } catch (e) {
    onError(e instanceof Error ? e.message : fallback)
  }
}
