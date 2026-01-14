// valtio-reactive-plugin/plugin.ts
import type { ValtioPlugin, ProxyFactory, EnhancedGlobalProxy } from 'valtio-plugin'
import { reportUsage, reportChange, watch, effect, batch, isTracking } from './core'

export interface ComputedResult<T> {
  /** The reactive computed state */
  state: T
  /** Dispose all watchers and stop updating */
  dispose: () => void
}

export interface ReactivePluginAPI {
  watch: typeof watch
  /** @deprecated Use `effect` instead */
  unstable_watch: typeof watch
  effect: typeof effect
  batch: typeof batch
  isTracking: typeof isTracking
  /**
   * Create computed/derived state that automatically updates when dependencies change
   * @param obj Object with getter functions for each computed property
   * @returns ComputedResult with state and dispose function
   */
  computed: <T extends object>(obj: { [K in keyof T]: () => T[K] }) => ComputedResult<T>
}

export type ReactivePlugin = ValtioPlugin & ReactivePluginAPI

export const createReactivePlugin = (): ReactivePlugin => {
  // Captured proxy function from onAttach - will be the factory or global proxy
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
      // Capture the proxy/factory this plugin is attached to
      boundProxy = proxyFn as <T extends object>(obj: T) => T
    },

    // Track property reads for dependency collection
    onGetRaw: (_target, prop, receiver, value) => {
      reportUsage(receiver as object, prop, value)
    },

    // Notify watchers when something changes
    afterChange: () => {
      reportChange()
    },

    watch,
    unstable_watch: watch,
    effect,
    batch,
    isTracking,
    computed,
  }

  return plugin
}