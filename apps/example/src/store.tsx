import React from "react"
import { nanoid } from "nanoid"
import { Trashly } from "trashly-react"

export interface INode {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface IStore extends Record<string, any> {
  status: "idle" | "pointing"
  selectedId: string | null
  nodes: Record<string, INode>
}

class CustomStore extends Trashly<IStore> {
  startPointingNode = (id: string) => {
    this.pause()

    this.mutate((s) => {
      s.selectedId = id
      s.status = "pointing"
    })
  }

  movePointingNode = (dx: number, dy: number, shiftKey: boolean) => {
    if (this.current.status === "pointing" && this.current.selectedId) {
      if (shiftKey) {
        this.mutate((s) => {
          for (const id in s.nodes) {
            s.nodes[id].x += dx
            s.nodes[id].y += dy
          }
        })
        return
      }

      this.mutate((s) => {
        const node = s.nodes[s.selectedId!]

        if (node) {
          node.x += dx
          node.y += dy
        }
      })
    }
  }

  stopPointingNode = () => {
    this.mutate((s) => {
      s.status = "idle"
      s.selectedId = null
    })

    this.resume()
  }

  startPointingCanvas = (x: number, y: number) => {
    this.pause()
    this.mutate((s) => {
      const id = nanoid()
      s.nodes[id] = {
        id,
        x: x - 50,
        y: y - 50,
        width: 100,
        height: 100,
      }
      s.selectedId = id
      s.status = "pointing"
    })
  }

  stopPointingCanvas = () => {
    this.mutate((s) => {
      s.status = "idle"
      s.selectedId = null
    })

    this.resume()
  }
}

export const storeContext = React.createContext({} as CustomStore)

const INITIAL_STATE: IStore = {
  status: "idle",
  selectedId: null,
  nodes: {},
}

const NODE_COUNT = 10000
const SIZE = 16
const PADDING = 4

const rows = Math.floor(Math.sqrt(NODE_COUNT))

for (let i = 0; i < NODE_COUNT; i++) {
  const id = nanoid()
  INITIAL_STATE.nodes[id] = {
    id,
    x: (i % rows) * (SIZE + PADDING),
    y: Math.floor(i / rows) * (SIZE + PADDING),
    width: SIZE,
    height: SIZE,
  }
}

export const useStoreInitializer = () => {
  const [store] = React.useState(() => new CustomStore(INITIAL_STATE))

  return store
}

export const useStoreContext = () => React.useContext(storeContext)
