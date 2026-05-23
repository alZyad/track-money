export type ToastSeverity = 'error' | 'warn' | 'info'

export type Toast = {
  id: number
  severity: ToastSeverity
  message: string
}

class ToastQueue {
  items: Toast[] = $state([])
  private nextId = 1

  push(severity: ToastSeverity, message: string, durationMs = 4000) {
    const id = this.nextId++
    this.items.push({ id, severity, message })
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs)
    }
    return id
  }

  error(msg: string, durationMs?: number) { return this.push('error', msg, durationMs) }
  warn(msg: string, durationMs?: number)  { return this.push('warn',  msg, durationMs) }
  info(msg: string, durationMs?: number)  { return this.push('info',  msg, durationMs) }

  dismiss(id: number) {
    const i = this.items.findIndex((t) => t.id === id)
    if (i >= 0) this.items.splice(i, 1)
  }
}

export const toasts = new ToastQueue()
