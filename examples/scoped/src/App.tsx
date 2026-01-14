import { store1, store2, effect, computed } from './store'
import { useSnapshot } from "valtio";

effect(() => {
  console.log(store1.count)
}, () => {
  console.log('disposed')
})

const {state: computedState } = computed({
  doubled: () => store1.count * 2
})

const Counter = () => {
  const snap = useSnapshot(store1);
  const snap2 = useSnapshot(store2)
  const comp = useSnapshot(computedState)
  return (
    <div>
      <div>store 1 count: {snap.count}</div>
      <div>store 1 doubled: {comp.doubled}</div>
      <div>store 2 count: {snap2.count}</div>

      <button onClick={() => store1.count++}>store 1: +1</button>
      <button onClick={() => store2.count++}>store 2: +1</button>
    </div>
  );
};

const App = () => (
  <>
    <Counter />
  </>
);

export default App;