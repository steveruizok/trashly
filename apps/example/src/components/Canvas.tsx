import { useStoreContext } from "../store"
import { Node } from "./Node"
import { nanoid } from "nanoid"

export function Canvas() {
  const store = useStoreContext()
  const state = store.useStore()

  return (
    <svg
      className="canvas"
      onPointerDown={(e) => {
        store.startPointingCanvas(e.clientX, e.clientY)
      }}
      onPointerUp={() => {
        store.stopPointingCanvas()
      }}
      onPointerMove={(e) => {
        store.movePointingNode(e.movementX, e.movementY, e.shiftKey)
      }}
    >
      {Object.values(state.nodes).map((node) => (
        <Node key={node.id} {...node} />
      ))}
    </svg>
  )
}
