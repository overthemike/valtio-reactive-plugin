import { getVersion, subscribe } from 'valtio/vanilla'

type ProxyObject = object
type Unsubscribe = () => void
type PrevValue = [value: unknown, version: number | undefined]
type PrevValues = Map<string | symbol, PrevValue>

interface Collector {
  add: (proxy: object, p: string | symbol, value: unknown) => void
}

const callbackStack: Collector[] = []

export const reportUsage = (proxy: object, p: string | symbol, value: unknown): void => {
  if (callbackStack.length === 0) return
  callbackStack[callbackStack.length - 1].add(proxy, p, value)
}

export const isTracking = (): boolean => callbackStack.length > 0

export function watch(fn: () => void): Unsubscribe {
  const subscriptions = new Map<ProxyObject, Unsubscribe>()
  const touchedKeys = new Map<ProxyObject, PrevValues>()

  const isChanged = (p: ProxyObject, prev: PrevValues): boolean =>
    Array.from(prev).some(([key, prevValue]) => {
      const value: unknown = (p as Record<string | symbol, unknown>)[key]

      const prevOfValue = touchedKeys.get(value as ProxyObject)
      if (prevOfValue) {
        return isChanged(value as ProxyObject, prevOfValue)
      }

      if (!Object.is(value, prevValue[0])) {
        return true
      }

      const version = getVersion(value)
      const prevVersion = prevValue[1]
      if (typeof version === 'number' && typeof prevVersion === 'number') {
        return version !== prevVersion
      }

      return false
    })

  const callback = () => {
    if (Array.from(touchedKeys).some(([p, prev]) => isChanged(p, prev))) {
      runFn()
    }
  }

  const subscribeProxies = () => {
    const proxiesToSubscribe = new Set<ProxyObject>(touchedKeys.keys())

    for (const [p, unsub] of subscriptions) {
      if (!proxiesToSubscribe.has(p)) {
        unsub()
        subscriptions.delete(p)
      } else {
        proxiesToSubscribe.delete(p)
      }
    }

    for (const p of proxiesToSubscribe) {
      const unsub = subscribe(p, () => registerBatchCallback(callback), true);
      subscriptions.set(p, unsub);
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
      subscribeProxies()
    }
  }

  runFn()

  return () => {
    for (const unsub of subscriptions.values()) {
      unsub()
    }
    subscriptions.clear()
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
  const unwatch = watch(fn);
  return () => {
    unwatch();
    cleanup?.();
  };
}