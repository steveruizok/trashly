import { useStoreContext } from "../immerstore"
import { Node } from "./Node"

export function Canvas() {
  const store = useStoreContext()
  const nodes = store.useStaticSelector((s) => s.nodes)

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
      {Object.values(nodes).map((node) => (
        <Node key={node.id} node={node} />
      ))}
    </svg>
  )
}
