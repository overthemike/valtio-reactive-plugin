// store.tsx
import { proxy } from 'valtio-plugin'
import { createReactivePlugin } from '../../../src'

const reactive = createReactivePlugin()

proxy.use(reactive)

const { effect, computed } = reactive

export const store = proxy({
  count: 0
})

export { effect, computed }

