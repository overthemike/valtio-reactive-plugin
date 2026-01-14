import type { ValtioPlugin, ProxyFactory, EnhancedGlobalProxy } from 'valtio-plugin'
import { reportUsage, watch, effect, batch, isTracking } from './core'

export interface ComputedResult<T> {
  state: T
  dispose: () => void
}

export interface ReactivePluginAPI {
  watch: typeof watch
  effect: typeof effect
  batch: typeof batch
  isTracking: typeof isTracking
  computed: <T extends object>(obj: { [K in keyof T]: () => T[K] }) => ComputedResult<T>
}

export type ReactivePlugin = ValtioPlugin & ReactivePluginAPI

export const createReactivePlugin = (): ReactivePlugin => {
  let boundProxy: (<T extends object>(obj: T) => T) | null = null

  const computed = <T extends object>(
    obj: { [K in keyof T]: () => T[K] }
  ): ComputedResult<T> => {
    if (!boundProxy) {
      throw new Error('Reactive plugin must be attached to a proxy before using computed()')
    }

    const computedState = boundProxy({} as T)
    const unwatchers: (() => void)[] = []

    for (const key in obj) {
      const getter = obj[key]
      const unwatch = watch(() => {
        computedState[key] = getter()
      })
      unwatchers.push(unwatch)
    }

    return {
      state: computedState,
      dispose: () => {
        unwatchers.forEach((u) => u())
        unwatchers.length = 0
      },
    }
  }

  const plugin: ReactivePlugin = {
    id: 'reactive',
    name: 'Reactive Plugin',
    onAttach: (proxyFn: ProxyFactory | EnhancedGlobalProxy) => {
      boundProxy = proxyFn as <T extends object>(obj: T) => T
    },
    onGetRaw: (_target, prop, receiver, value) => {
      reportUsage(receiver as object, prop, value)
    },
    watch,
    effect,
    batch,
    isTracking,
    computed,
  }

  return plugin
}