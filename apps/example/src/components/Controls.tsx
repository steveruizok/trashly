import { stopPropagation } from "../shared"
import { useStoreContext } from "../store"

export function Controls() {
  const store = useStoreContext()

  return (
    <div
      className="controls"
      onPointerDown={stopPropagation}
      onPointerUp={stopPropagation}
    >
      <button onClick={store.undo}>Undo</button>
      <button onClick={store.redo}>Redo</button>
    </div>
  )
}
