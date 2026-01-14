import { proxy } from 'valtio-plugin'
import { createReactivePlugin } from '../../../src'

const reactive = createReactivePlugin()
const instance1 = proxy.createInstance()
const instance2 = proxy.createInstance()

instance1.use(reactive)

const { effect, computed } = reactive

export const store1 = instance1({
  count: 0
})

export const store2 = instance2({
  count: 0
})

export { effect, computed }

