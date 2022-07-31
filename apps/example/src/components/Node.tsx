import React from "react"
import { INode, useStoreContext } from "../store"

export const Node = React.memo(({ x, y, width, height, id }: INode) => {
  const store = useStoreContext()
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      onPointerDown={(e) => {
        store.startPointingNode(id)
        e.stopPropagation()
      }}
      onPointerUp={(e) => {
        store.stopPointingNode()
        e.stopPropagation()
      }}
    />
  )
})
