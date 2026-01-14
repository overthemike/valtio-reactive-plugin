import { store, effect, computed } from './store'
import { useSnapshot } from "valtio";

effect(() => {
  console.log(store.count)
}, () => {
  console.log('disposed')
})

const {state: computedState } = computed({
  doubled: () => store.count * 2
})

const Counter = () => {
  const snap = useSnapshot(store);
  const comp = useSnapshot(computedState)
  return (
    <div>
      <div>count: {snap.count}</div>
      <div>doubled: {comp.doubled}</div>

      <button onClick={() => store.count++}>+1</button>
    </div>
  );
};

const App = () => (
  <>
    <Counter />
  </>
);

export default App;