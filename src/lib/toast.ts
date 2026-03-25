type ToastType = "success" | "error"
type ToastListener = (message: string, type: ToastType) => void

const listeners = new Set<ToastListener>()

export function toast(message: string, type: ToastType = "success") {
  listeners.forEach((l) => l(message, type))
}

export function subscribeToast(listener: ToastListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
