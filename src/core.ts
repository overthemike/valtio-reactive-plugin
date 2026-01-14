import { getVersion } from 'valtio/vanilla'

type ProxyObject = object
type Unsubscribe = () => void
type PrevValue = [value: unknown, version: number | undefined]
type PrevValues = Map<string | symbol, PrevValue>

interface Collector {
  add: (proxy: object, p: string | symbol, value: unknown) => void
}

const callbackStack: Collector[] = []
const watcherCallbacks = new Set<() => void>()

export const reportUsage = (proxy: object, p: string | symbol, value: unknown): void => {
  if (callbackStack.length === 0) return
  callbackStack[callbackStack.length - 1].add(proxy, p, value)
}

export const reportChange = (): void => {
  for (const callback of watcherCallbacks) {
    registerBatchCallback(callback)
  }
}

export const isTracking = (): boolean => callbackStack.length > 0

export function watch(fn: () => void): Unsubscribe {
  const touchedKeys = new Map<ProxyObject, PrevValues>()
  let isDisposed = false

  const isChanged = (): boolean => {
    for (const [proxy, prev] of touchedKeys) {
      for (const [key, [prevValue, prevVersion]] of prev) {
        const currentValue = (proxy as Record<string | symbol, unknown>)[key]

        // Direct value change
        if (!Object.is(currentValue, prevValue)) {
          return true
        }

        // If the value is another proxy we're tracking, check it recursively
        // (its properties will be checked in the outer loop)
        if (touchedKeys.has(currentValue as ProxyObject)) {
          continue
        }

        // Version change (for nested proxies that changed internally)
        // Only check this for values we're NOT tracking deeper into
        const currentVersion = getVersion(currentValue)
        if (
          typeof currentVersion === 'number' &&
          typeof prevVersion === 'number' &&
          currentVersion !== prevVersion
        ) {
          return true
        }
      }
    }
    return false
  }

  const callback = () => {
    if (isDisposed) return
    if (isChanged()) {
      runFn()
    }
  }

  const runFn = () => {
    touchedKeys.clear()

    const collector: Collector = {
      add: (proxy, p, value) => {
        let prev = touchedKeys.get(proxy)
        if (!prev) {
          prev = new Map()
          touchedKeys.set(proxy, prev)
        }
        prev.set(p, [value, getVersion(value)])
      },
    }

    callbackStack.push(collector)

    try {
      fn()
    } finally {
      callbackStack.pop()
    }
  }

  watcherCallbacks.add(callback)
  runFn()

  return () => {
    if (isDisposed) return
    isDisposed = true
    watcherCallbacks.delete(callback)
    touchedKeys.clear()
  }
}

const batchCallbackStack: Set<() => void>[] = []

export const registerBatchCallback = (callback: () => void): void => {
  if (batchCallbackStack.length > 0) {
    batchCallbackStack[batchCallbackStack.length - 1].add(callback)
  } else {
    callback()
  }
}

export function batch<T>(fn: () => T): T {
  const callbacks = new Set<() => void>()
  batchCallbackStack.push(callbacks)
  try {
    return fn()
  } finally {
    batchCallbackStack.pop()
    if (batchCallbackStack.length > 0) {
      const outerBatch = batchCallbackStack[batchCallbackStack.length - 1]
      for (const cb of callbacks) {
        outerBatch.add(cb)
      }
    } else {
      for (const cb of callbacks) {
        cb()
      }
    }
  }
}

export function effect(fn: () => void, cleanup?: () => void): () => void {
  const unwatch = watch(fn)
  return () => {
    unwatch()
    cleanup?.()
  }
}