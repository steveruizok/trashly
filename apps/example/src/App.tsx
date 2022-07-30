import "./App.css"
import { Trashly } from "trashly-react"

const store = new Trashly({
  name: "Trashly",
  age: 36,
  settings: {
    theme: "dark",
    language: "en",
  },
})

function App() {
  const name = store.useSelector((s) => s.name)
  const canUndo = store.useCanUndo()
  const canRedo = store.useCanRedo()
  const isPaused = store.useIsPaused()

  return (
    <div className="App">
      <h1>{name}</h1>
      <button
        onClick={() => {
          store.mutate((s) => (s.name += "!"))
        }}
      >
        Click me
      </button>
      <div>
        <button disabled={!canUndo} onClick={store.undo}>
          Undo
        </button>
        <button disabled={!canRedo} onClick={store.redo}>
          Redo
        </button>
        <button disabled={isPaused} onClick={store.pause}>
          Pause
        </button>
        <button disabled={!isPaused} onClick={store.resume}>
          Resume
        </button>
      </div>
    </div>
  )
}

export default App
