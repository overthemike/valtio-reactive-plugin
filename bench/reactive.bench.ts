import { bench, describe, beforeAll } from 'vitest'
import { proxy } from 'valtio-plugin'
import { proxy as valtioProxy } from 'valtio/vanilla'
import { unstable_watch as originalWatch, batch as originalBatch } from 'valtio-reactive'
import { createReactivePlugin } from '../src/index'

const reactivePlugin = createReactivePlugin()
proxy.use(reactivePlugin)
const { watch: pluginWatch, batch: pluginBatch } = reactivePlugin

describe('GET - no active watch', () => {
  const originalState = valtioProxy({ count: 0, name: 'test', active: true })
  const pluginState = proxy({ count: 0, name: 'test', active: true })

  bench('valtio-reactive', () => {
    const _ = originalState.count
    const __ = originalState.name
  })

  bench('valtio-reactive-plugin', () => {
    const _ = pluginState.count
    const __ = pluginState.name
  })
})

describe('GET - with watch active (outside tracking)', () => {
  const originalState = valtioProxy({ count: 0, name: 'test', active: true })
  const pluginState = proxy({ count: 0, name: 'test', active: true })

  // Setup watchers once
  const originalUnwatch = originalWatch(() => {
    originalState.count
  })
  const pluginUnwatch = pluginWatch(() => {
    pluginState.count
  })

  bench('valtio-reactive', () => {
    const _ = originalState.count
    const __ = originalState.name
  })

  bench('valtio-reactive-plugin', () => {
    const _ = pluginState.count
    const __ = pluginState.name
  })
})

describe('GET - nested 4 levels', () => {
  const originalState = valtioProxy({
    user: { profile: { settings: { theme: 'dark' } } },
  })
  const pluginState = proxy({
    user: { profile: { settings: { theme: 'dark' } } },
  })

  bench('valtio-reactive', () => {
    const _ = originalState.user.profile.settings.theme
  })

  bench('valtio-reactive-plugin', () => {
    const _ = pluginState.user.profile.settings.theme
  })
})

describe('GET - wide object (100 keys)', () => {
  const createWideObject = () => {
    const obj: Record<string, number> = {}
    for (let i = 0; i < 100; i++) obj[`key${i}`] = i
    return obj
  }

  const originalState = valtioProxy(createWideObject())
  const pluginState = proxy(createWideObject())
  const keys = Object.keys(originalState)

  let idx = 0

  bench('valtio-reactive', () => {
    const _ = originalState[keys[idx % 100]]
    idx++
  })

  bench('valtio-reactive-plugin', () => {
    const _ = pluginState[keys[idx % 100]]
    idx++
  })
})

describe('SET - no watch', () => {
  const originalState = valtioProxy({ count: 0 })
  const pluginState = proxy({ count: 0 })

  bench('valtio-reactive', () => {
    originalState.count++
  })

  bench('valtio-reactive-plugin', () => {
    pluginState.count++
  })
})

describe('SET - triggers watch', () => {
  const originalState = valtioProxy({ count: 0 })
  const pluginState = proxy({ count: 0 })

  const originalUnwatch = originalWatch(() => {
    originalState.count
  })
  const pluginUnwatch = pluginWatch(() => {
    pluginState.count
  })

  bench('valtio-reactive', () => {
    originalState.count++
  })

  bench('valtio-reactive-plugin', () => {
    pluginState.count++
  })
})

describe('SET - batched 3 updates', () => {
  const originalState = valtioProxy({ a: 0, b: 0, c: 0 })
  const pluginState = proxy({ a: 0, b: 0, c: 0 })

  const originalUnwatch = originalWatch(() => {
    originalState.a
    originalState.b
    originalState.c
  })
  const pluginUnwatch = pluginWatch(() => {
    pluginState.a
    pluginState.b
    pluginState.c
  })

  bench('valtio-reactive', () => {
    originalBatch(() => {
      originalState.a++
      originalState.b++
      originalState.c++
    })
  })

  bench('valtio-reactive-plugin', () => {
    pluginBatch(() => {
      pluginState.a++
      pluginState.b++
      pluginState.c++
    })
  })
})

describe('SET - 5 watchers', () => {
  const originalState = valtioProxy({ count: 0 })
  const pluginState = proxy({ count: 0 })

  const originalUnwatchers = Array.from({ length: 5 }, () =>
    originalWatch(() => {
      originalState.count
    })
  )
  const pluginUnwatchers = Array.from({ length: 5 }, () =>
    pluginWatch(() => {
      pluginState.count
    })
  )

  bench('valtio-reactive', () => {
    originalState.count++
  })

  bench('valtio-reactive-plugin', () => {
    pluginState.count++
  })
})

describe('watch setup/teardown', () => {
  const originalState = valtioProxy({ count: 0 })
  const pluginState = proxy({ count: 0 })

  bench('valtio-reactive', () => {
    const unwatch = originalWatch(() => {
      originalState.count
    })
    unwatch()
  })

  bench('valtio-reactive-plugin', () => {
    const unwatch = pluginWatch(() => {
      pluginState.count
    })
    unwatch()
  })
})

describe('proxy creation', () => {
  bench('valtio-reactive', () => {
    const state = valtioProxy({ count: 0, name: 'test' })
  })

  bench('valtio-reactive-plugin', () => {
    const state = proxy({ count: 0, name: 'test' })
  })
})