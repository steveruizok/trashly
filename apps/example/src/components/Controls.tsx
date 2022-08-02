import { stopPropagation } from "../shared"
import { useStoreContext } from "../LiquorStore"

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
      <button
        onClick={() => {
          store.mutate((s) => {
            Object.values(s.nodes).forEach((n) => {
              n.x += 100
            })
          })
        }}
      >
        Jump All
      </button>
      <button
        onClick={() => {
          store.mutate((s) => {
            const nodes = Object.values(s.nodes)
            const halfNodes = nodes.slice(0, Math.floor(nodes.length / 2))
            for (const node of halfNodes) {
              node.x += 100
            }
          })
        }}
      >
        Jump Some
      </button>
    </div>
  )
}
