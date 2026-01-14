import { describe, expect, it, vi, beforeEach } from 'vitest';
import { proxy } from 'valtio-plugin';
import { createReactivePlugin } from '../src/index';

describe('valtio-reactive-plugin', () => {
  let reactivePlugin: ReturnType<typeof createReactivePlugin>;
  let watch: ReturnType<typeof createReactivePlugin>['watch'];
  let effect: ReturnType<typeof createReactivePlugin>['effect'];
  let batch: ReturnType<typeof createReactivePlugin>['batch'];
  let computed: ReturnType<typeof createReactivePlugin>['computed'];

  beforeEach(() => {
    proxy.clearPlugins();
    reactivePlugin = createReactivePlugin();
    proxy.use(reactivePlugin);
    watch = reactivePlugin.watch;
    effect = reactivePlugin.effect;
    batch = reactivePlugin.batch;
    computed = reactivePlugin.computed;
  });

  describe('watch', () => {
    it('should run function initially', () => {
      const fn = vi.fn();
      const unwatch = watch(fn);
      expect(fn).toHaveBeenCalledTimes(1);
      unwatch();
    });

    it('should rerun function on change', async () => {
      const state = proxy({ count: 0 });
      const data: number[] = [];
      const unwatch = watch(() => {
        data.push(state.count);
      });
      expect(data).toEqual([0]);
      ++state.count;
      await new Promise<void>((r) => setTimeout(r));
      expect(data).toEqual([0, 1]);
      ++state.count;
      await new Promise<void>((r) => setTimeout(r));
      expect(data).toEqual([0, 1, 2]);
      unwatch();
      ++state.count;
      await new Promise<void>((r) => setTimeout(r));
      expect(data).toEqual([0, 1, 2]);
    });

    it('should work with nested object', async () => {
      const state = proxy({
        count: 0,
        nested: { count: 0, anotherCount: 0, anotherObject: { count2: 0 } },
      });
      const data: number[] = [];
      const unwatch = watch(() => {
        data.push(state.nested.count);
      });
      expect(data).toEqual([0]);
      ++state.nested.count;
      expect(data).toEqual([0, 1]);
      ++state.count;
      expect(data).toEqual([0, 1]);
      ++state.nested.anotherCount;
      expect(data).toEqual([0, 1]);
      ++state.nested.anotherObject.count2;
      expect(data).toEqual([0, 1]);
      unwatch();
    });

    it('should work with arrays', async () => {
      const state: { items: number[] } = proxy({ items: [] });
      const data: number[] = [];
      const unwatch = watch(() => {
        data.push(state.items.length);
      });
      expect(data).toEqual([0]);
      state.items.push(1);
      expect(data).toEqual([0, 1]);
      state.items.push(2);
      expect(data).toEqual([0, 1, 2]);
      unwatch();
    });

    it('should work with objects', async () => {
      const fn = vi.fn();
      const list: { todos: Record<string, { title: string }> } = proxy({
        todos: {},
      });
      const unwatch = watch(() => {
        fn(list.todos);
      });
      fn.mockClear();
      list.todos['1'] = { title: 'Buy milk' };
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith({
        '1': { title: 'Buy milk' },
      });
      fn.mockClear();
      list.todos['2'] = { title: 'Buy coffee' };
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith({
        '1': { title: 'Buy milk' },
        '2': { title: 'Buy coffee' },
      });
      fn.mockClear();
      delete list.todos['1'];
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith({
        '2': { title: 'Buy coffee' },
      });
      unwatch();
    });

    it('should watch arrays for structure changes', async () => {
      const fn = vi.fn();
      const state: { items: number[] } = proxy({ items: [] });
      const unwatch = watch(() => {
        fn(state.items);
      });
      fn.mockClear();
      state.items.push(1);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith([1]);
      fn.mockClear();
      state.items.push(2);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith([1, 2]);
      fn.mockClear();
      state.items.shift();
      expect(fn).toHaveBeenLastCalledWith([2]);
      unwatch();
    });

    it('should watch primitive properties on parent when child is also watched', async () => {
      const state = proxy({
        count: 0,
        nested: { text: 'hello' },
      });
      const fn = vi.fn();

      const unwatch = watch(() => {
        void state.count;
        void state.nested.text;
        fn();
      });

      expect(fn).toHaveBeenCalledTimes(1);

      state.count++;
      await new Promise<void>((r) => setTimeout(r));
      expect(fn).toHaveBeenCalledTimes(2);

      state.nested.text = 'world';
      await new Promise<void>((r) => setTimeout(r));
      expect(fn).toHaveBeenCalledTimes(3);

      unwatch();
    });

    it('should handle object replacement when watching nested properties', async () => {
      const state = proxy({
        nested: { text: 'initial' },
      });
      const fn = vi.fn();

      const unwatch = watch(() => {
        fn(state.nested.text);
      });

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenLastCalledWith('initial');

      state.nested = { text: 'replaced' };
      await new Promise<void>((r) => setTimeout(r));

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('replaced');

      unwatch();
    });

    it('should handle multiple watchers on same state', async () => {
      const state = proxy({ count: 0 });
      const fn1 = vi.fn();
      const fn2 = vi.fn();

      const unwatch1 = watch(() => {
        fn1(state.count);
      });
      const unwatch2 = watch(() => {
        fn2(state.count);
      });

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);

      state.count++;
      await new Promise<void>((r) => setTimeout(r));

      expect(fn1).toHaveBeenCalledTimes(2);
      expect(fn2).toHaveBeenCalledTimes(2);

      unwatch1();
      state.count++;
      await new Promise<void>((r) => setTimeout(r));

      expect(fn1).toHaveBeenCalledTimes(2); // Stopped
      expect(fn2).toHaveBeenCalledTimes(3); // Still running

      unwatch2();
    });

    it('should handle conditional property access', async () => {
      const state = proxy({ flag: true, a: 1, b: 2 });
      const fn = vi.fn();

      const unwatch = watch(() => {
        fn(state.flag ? state.a : state.b);
      });

      expect(fn).toHaveBeenLastCalledWith(1);

      // Change a - should trigger (currently watching a)
      state.a = 10;
      await new Promise<void>((r) => setTimeout(r));
      expect(fn).toHaveBeenLastCalledWith(10);

      // Change b - should NOT trigger (not watching b)
      state.b = 20;
      await new Promise<void>((r) => setTimeout(r));
      expect(fn).toHaveBeenCalledTimes(2); // Still 2

      // Change flag - should trigger and now watch b
      state.flag = false;
      await new Promise<void>((r) => setTimeout(r));
      expect(fn).toHaveBeenLastCalledWith(20);

      // Change b - should NOW trigger
      state.b = 30;
      await new Promise<void>((r) => setTimeout(r));
      expect(fn).toHaveBeenLastCalledWith(30);

      // Change a - should NOT trigger anymore
      const callCount = fn.mock.calls.length;
      state.a = 100;
      await new Promise<void>((r) => setTimeout(r));
      expect(fn).toHaveBeenCalledTimes(callCount); // No change

      unwatch();
    });
  });

  describe('watch with batch', () => {
    it('should rerun function on change', async () => {
      const state = proxy({ count: 0 });
      const data: number[] = [];
      const unwatch = watch(() => {
        data.push(state.count);
      });
      expect(data).toEqual([0]);
      batch(() => {
        ++state.count;
        ++state.count;
      });
      expect(data).toEqual([0, 2]);
      batch(() => {
        ++state.count;
        ++state.count;
      });
      expect(data).toEqual([0, 2, 4]);
      unwatch();
      batch(() => {
        ++state.count;
        ++state.count;
      });
      expect(data).toEqual([0, 2, 4]);
    });

    it('should batch multiple property changes', async () => {
      const state = proxy({ a: 0, b: 0, c: 0 });
      const fn = vi.fn();

      const unwatch = watch(() => {
        fn({ a: state.a, b: state.b, c: state.c });
      });

      fn.mockClear();

      batch(() => {
        state.a = 1;
        state.b = 2;
        state.c = 3;
      });

      // Should only be called once with final values
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith({ a: 1, b: 2, c: 3 });

      unwatch();
    });

    it('should handle nested batches', async () => {
      const state = proxy({ count: 0 });
      const fn = vi.fn();

      const unwatch = watch(() => {
        fn(state.count);
      });

      fn.mockClear();

      batch(() => {
        state.count++;
        batch(() => {
          state.count++;
          state.count++;
        });
        state.count++;
      });

      // Should only trigger once after outermost batch completes
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(4);

      unwatch();
    });
  });

  describe('effect', () => {
    it('should run function initially like watch', () => {
      const fn = vi.fn();
      const dispose = effect(fn);
      expect(fn).toHaveBeenCalledTimes(1);
      dispose();
    });

    it('should rerun on state changes', async () => {
      const state = proxy({ count: 0 });
      const fn = vi.fn();

      const dispose = effect(() => {
        fn(state.count);
      });

      expect(fn).toHaveBeenCalledTimes(1);

      state.count++;
      await new Promise<void>((r) => setTimeout(r));

      expect(fn).toHaveBeenCalledTimes(2);

      dispose();
    });

    it('should call cleanup on dispose', () => {
      const fn = vi.fn();
      const cleanup = vi.fn();

      const dispose = effect(fn, cleanup);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(cleanup).not.toHaveBeenCalled();

      dispose();

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should stop reacting after dispose', async () => {
      const state = proxy({ count: 0 });
      const fn = vi.fn();
      const cleanup = vi.fn();

      const dispose = effect(() => {
        fn(state.count);
      }, cleanup);

      fn.mockClear();

      state.count++;
      await new Promise<void>((r) => setTimeout(r));
      expect(fn).toHaveBeenCalledTimes(1);

      dispose();

      state.count++;
      await new Promise<void>((r) => setTimeout(r));
      expect(fn).toHaveBeenCalledTimes(1); // No additional calls
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should work without cleanup function', () => {
      const fn = vi.fn();
      const dispose = effect(fn);

      expect(fn).toHaveBeenCalledTimes(1);

      // Should not throw when disposing without cleanup
      expect(() => dispose()).not.toThrow();
    });
  });

  describe('isTracking', () => {
    it('should return true inside watch execution', () => {
      let trackingStatus: boolean | undefined;

      const unwatch = watch(() => {
        trackingStatus = reactivePlugin.isTracking();
      });

      expect(trackingStatus).toBe(true);
      unwatch();
    });

    it('should return false outside watch execution', () => {
      expect(reactivePlugin.isTracking()).toBe(false);
    });
  });

  describe('instance-scoped reactive plugin', () => {
    it('should work with factory instances', async () => {
      const factory = proxy.createInstance();
      const instanceReactive = createReactivePlugin();
      factory.use(instanceReactive);

      const state = factory({ count: 0 });
      const fn = vi.fn();

      const unwatch = instanceReactive.watch(() => {
        fn(state.count);
      });

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenLastCalledWith(0);

      state.count++;
      await new Promise<void>((r) => setTimeout(r));

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith(1);

      unwatch();
      factory.dispose();
    });

    it('should isolate tracking between instances', async () => {
      const factory1 = proxy.createInstance();
      const factory2 = proxy.createInstance();

      const reactive1 = createReactivePlugin();
      const reactive2 = createReactivePlugin();

      factory1.use(reactive1);
      factory2.use(reactive2);

      const state1 = factory1({ count: 0 });
      const state2 = factory2({ count: 0 });

      const fn1 = vi.fn();
      const fn2 = vi.fn();

      const unwatch1 = reactive1.watch(() => {
        fn1(state1.count);
      });

      const unwatch2 = reactive2.watch(() => {
        fn2(state2.count);
      });

      fn1.mockClear();
      fn2.mockClear();

      // Change state1 - only fn1 should trigger
      state1.count++;
      await new Promise<void>((r) => setTimeout(r));

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(0);

      // Change state2 - only fn2 should trigger
      state2.count++;
      await new Promise<void>((r) => setTimeout(r));

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);

      unwatch1();
      unwatch2();
      factory1.dispose();
      factory2.dispose();
    });
  });

  describe('edge cases', () => {
    it('should handle watching undefined properties', async () => {
      const state: { value?: number } = proxy({});
      const fn = vi.fn();

      const unwatch = watch(() => {
        fn(state.value);
      });

      expect(fn).toHaveBeenLastCalledWith(undefined);

      state.value = 42;
      await new Promise<void>((r) => setTimeout(r));

      expect(fn).toHaveBeenLastCalledWith(42);

      delete state.value;
      await new Promise<void>((r) => setTimeout(r));

      expect(fn).toHaveBeenLastCalledWith(undefined);

      unwatch();
    });

    it('should handle rapid successive changes', async () => {
      const state = proxy({ count: 0 });
      const fn = vi.fn();

      const unwatch = watch(() => {
        fn(state.count);
      });

      fn.mockClear();

      // Rapid changes
      for (let i = 0; i < 10; i++) {
        state.count++;
      }

      await new Promise<void>((r) => setTimeout(r, 50));

      // Should have been called for each change (notifyInSync=true)
      expect(fn).toHaveBeenCalledTimes(10);
      expect(fn).toHaveBeenLastCalledWith(10);

      unwatch();
    });

    it('should handle circular references', async () => {
      const state: { self?: object; count: number } = proxy({ count: 0 });
      state.self = state;

      const fn = vi.fn();

      const unwatch = watch(() => {
        fn(state.count);
      });

      expect(fn).toHaveBeenCalledTimes(1);

      state.count++;
      await new Promise<void>((r) => setTimeout(r));

      expect(fn).toHaveBeenCalledTimes(2);

      unwatch();
    });

    it('should cleanup properly on unwatch', async () => {
      const state = proxy({ count: 0 });
      const fn = vi.fn();

      const unwatch = watch(() => {
        fn(state.count);
      });

      unwatch();

      // Multiple unwatches should be safe
      unwatch();
      unwatch();

      state.count++;
      await new Promise<void>((r) => setTimeout(r));

      expect(fn).toHaveBeenCalledTimes(1); // Only initial call
    });
  });

  describe('computed', () => {
    it('should create computed state from getters', () => {
      const state = proxy({ count: 2, multiplier: 3 });

      const { state: computedState, dispose } = computed({
        doubled: () => state.count * 2,
        tripled: () => state.count * 3,
      });

      expect(computedState.doubled).toBe(4);
      expect(computedState.tripled).toBe(6);

      dispose();
    });

    it('should update when dependencies change', async () => {
      const state = proxy({ count: 2 });

      const { state: computedState, dispose } = computed({
        doubled: () => state.count * 2,
      });

      expect(computedState.doubled).toBe(4);

      state.count = 5;
      await new Promise<void>((r) => setTimeout(r));

      expect(computedState.doubled).toBe(10);

      dispose();
    });

    it('should handle multiple dependencies', async () => {
      const state = proxy({ a: 2, b: 3 });

      const { state: computedState, dispose } = computed({
        sum: () => state.a + state.b,
        product: () => state.a * state.b,
      });

      expect(computedState.sum).toBe(5);
      expect(computedState.product).toBe(6);

      state.a = 10;
      await new Promise<void>((r) => setTimeout(r));

      expect(computedState.sum).toBe(13);
      expect(computedState.product).toBe(30);

      state.b = 5;
      await new Promise<void>((r) => setTimeout(r));

      expect(computedState.sum).toBe(15);
      expect(computedState.product).toBe(50);

      dispose();
    });

    it('should stop updating after dispose', async () => {
      const state = proxy({ count: 2 });

      const { state: computedState, dispose } = computed({
        doubled: () => state.count * 2,
      });

      expect(computedState.doubled).toBe(4);

      dispose();

      state.count = 10;
      await new Promise<void>((r) => setTimeout(r));

      // Should still be 4, not updated
      expect(computedState.doubled).toBe(4);
    });

    it('should work with nested state', async () => {
      const state = proxy({
        user: { name: 'John', age: 30 },
      });

      const { state: computedState, dispose } = computed({
        greeting: () => `Hello, ${state.user.name}!`,
        canDrink: () => state.user.age >= 21,
      });

      expect(computedState.greeting).toBe('Hello, John!');
      expect(computedState.canDrink).toBe(true);

      state.user.name = 'Jane';
      await new Promise<void>((r) => setTimeout(r));

      expect(computedState.greeting).toBe('Hello, Jane!');

      state.user.age = 18;
      await new Promise<void>((r) => setTimeout(r));

      expect(computedState.canDrink).toBe(false);

      dispose();
    });

    it('should work with instance-scoped plugins', async () => {
      const factory = proxy.createInstance();
      const instanceReactive = createReactivePlugin();
      factory.use(instanceReactive);

      const state = factory({ count: 5 });

      const { state: computedState, dispose } = instanceReactive.computed({
        squared: () => state.count * state.count,
      });

      expect(computedState.squared).toBe(25);

      state.count = 4;
      await new Promise<void>((r) => setTimeout(r));

      expect(computedState.squared).toBe(16);

      dispose();
      factory.dispose();
    });

    it('should allow computed to depend on other computed', async () => {
      const state = proxy({ count: 2 });

      const { state: first, dispose: disposeFirst } = computed({
        doubled: () => state.count * 2,
      });

      const { state: second, dispose: disposeSecond } = computed({
        quadrupled: () => first.doubled * 2,
      });

      expect(first.doubled).toBe(4);
      expect(second.quadrupled).toBe(8);

      state.count = 3;
      await new Promise<void>((r) => setTimeout(r));

      expect(first.doubled).toBe(6);
      expect(second.quadrupled).toBe(12);

      disposeSecond();
      disposeFirst();
    });

    it('should handle dispose being called multiple times', () => {
      const state = proxy({ count: 1 });

      const { state: computedState, dispose } = computed({
        doubled: () => state.count * 2,
      });

      // Should not throw
      dispose();
      dispose();
      dispose();

      expect(computedState.doubled).toBe(2);
    });
  });
});