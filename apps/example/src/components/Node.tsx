import React from "react"
import { INode, useStoreContext } from "../store"

export const Node = React.memo(({ node }: { node: INode }) => {
  const store = useStoreContext()
  return (
    <rect
      x={node.x}
      y={node.y}
      width={node.width}
      height={node.height}
      onPointerDown={(e) => {
        store.startPointingNode(node.id)
        e.stopPropagation()
      }}
      onPointerUp={(e) => {
        store.stopPointingNode()
        e.stopPropagation()
      }}
    />
  )
})
