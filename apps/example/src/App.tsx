import { Canvas } from "./components/Canvas"
import { CCanvas } from "./components/CCanvas"
import { Controls } from "./components/Controls"
import { storeContext, useStoreInitializer } from "./LiquorStore"

function App() {
  const store = useStoreInitializer()

  return (
    <storeContext.Provider value={store}>
      <CCanvas />
      <Controls />
    </storeContext.Provider>
  )
}

export default App
