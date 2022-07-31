import React from "react"
import { nanoid } from "nanoid"
import { Trashly } from "trashly-react"
import { diff } from "trashly-core"
import set from "lodash.set"
import unset from "lodash.unset"
import cloneDeep from "lodash.clonedeep"
import { Difference } from "trashly-core/dist/lib/types"

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
  chain = () => {
    const tNext = { ...this.current }
    const ops: ((state: IStore) => void)[] = []

    const api = {
      setStatus: (fn: (state: IStore) => IStore["status"]) => {
        ops.push((state: IStore) => {
          state.status = fn(state)
        })
        return api
      },
      setSelectedId: (fn: (state: IStore) => IStore["selectedId"]) => {
        ops.push((state: IStore) => {
          state.selectedId = fn(state)
        })
        return api
      },
      createNodes: (fn: (state: IStore) => INode[]) => {
        ops.push((state: IStore) => {
          const changes = fn(state)
          state.nodes = { ...state.nodes }
          for (const n of changes) {
            state.nodes[n.id] = n
          }
        })
        return api
      },
      updateNodes: (
        fn: (state: IStore) => Partial<Omit<INode, "id">> & Pick<INode, "id">[]
      ) => {
        ops.push((state: IStore) => {
          const changes = fn(state)
          state.nodes = { ...state.nodes }
          for (const n of changes) {
            state.nodes[n.id] = { ...state.nodes[n.id], ...n }
          }
        })
        return api
      },
      run: () => {
        this.willChange()
        for (const op of ops) op(tNext)
        this.current = tNext
        this.didChange()
        return this
      },
    }

    return api
  }

  // EVENTS

  startPointingNode = (id: string) => {
    this.pause()
      .chain()
      .setSelectedId(() => id)
      .setStatus(() => "pointing")
      .run()
  }

  movePointingNode = (dx: number, dy: number, shiftKey: boolean) => {
    const { current } = this

    if (current.status === "pointing" && current.selectedId) {
      if (shiftKey) {
        this.chain()
          .updateNodes((s) =>
            Object.values(s.nodes).map((n) => ({
              id: n.id,
              x: n.x + dx,
              y: n.y + dy,
            }))
          )
          .run()

        return
      }

      this.chain()
        .updateNodes((s) => {
          const node = s.nodes[s.selectedId!]
          return [{ id: node.id, x: node.x + dx, y: node.y + dy }]
        })
        .run()
    }
  }

  stopPointingNode = () => {
    this.chain()
      .setStatus((s) => "idle")
      .setSelectedId((s) => null)
      .run()
      .resume()
  }

  startPointingCanvas = (x: number, y: number) => {
    const id = nanoid()

    this.pause()
      .chain()
      .createNodes(() => [
        { id, x: x - 50, y: y - 50, width: 100, height: 100 },
      ])
      .setSelectedId(() => id)
      .setStatus(() => "pointing")
      .run()
  }

  stopPointingCanvas = () => {
    this.chain()
      .setStatus((s) => "idle")
      .setSelectedId((s) => null)
      .run()
      .resume()
  }

  // OVERRIDES

  undo = () => {
    if (this.isPaused) {
      // Resume and undo anything that has changed since we paused
      if (this.didChangeWhilePaused) {
        this.history = this.history.splice(0, this.pointer + 1)
        this.history.push(diff(this.prev, this.current))
        this.pointer = this.history.length - 1
        this.didChangeWhilePaused = false
        this.isPaused = false
      }
    }

    if (!this.canUndo) return

    const patch = this.history[this.pointer]

    const next = { ...this.current }
    const newRefs = new Set<string | number>()

    patch.forEach((item) => {
      const len = item.path.length
      let t = next

      item.path.forEach((step, i) => {
        if (i < len - 1) {
          if (!newRefs.has(step)) {
            t[step] = { ...t[step] }
            newRefs.add(step)
          }
          t = t[step]
          return
        }

        switch (item.type) {
          case "CREATE": {
            delete t[step]
            break
          }
          case "CHANGE": {
            t[step] = item.oldValue
            break
          }
          case "REMOVE": {
            t[step] = item.oldValue
            break
          }
          default: {
            throw new Error(`unknown diff entry type: ${(item as any).type}`)
          }
        }
      })
    })

    this.pointer--
    this.prev = this.current
    this.current = next

    this.notifySubscribers()

    return this
  }

  applyPatch = (patch: Difference[]) => {
    const next = { ...this.current }
    const newRefs = new Set<string | number>()

    patch.forEach((item) => {
      const len = item.path.length
      let t = next

      item.path.forEach((step, i) => {
        if (i < len - 1) {
          if (!newRefs.has(step)) {
            newRefs.add(step)
            t[step] = { ...t[step] }
          }
          t = t[step]
          return
        }

        switch (item.type) {
          case "CREATE": {
            t[step] = item.value
            break
          }
          case "CHANGE": {
            t[step] = item.value
            break
          }
          case "REMOVE": {
            delete t[step]
            break
          }
          default: {
            throw new Error(`unknown diff entry type: ${(item as any).type}`)
          }
        }
      })
    })

    this.prev = this.current
    this.current = this.processStateBeforeMerging(next)

    this.notifySubscribers()

    return this
  }

  mutate = (mutator: (state: IStore) => void) => {
    const draft = cloneDeep(this.current)

    mutator(draft)

    const patch: Difference[] = diff(this.current, draft)

    const newRefs = new Set<string | number>()

    const next = { ...this.current }

    patch.forEach((item) => {
      const len = item.path.length
      let t = next

      item.path.forEach((step, i) => {
        if (i < len - 1) {
          if (!newRefs.has(step)) {
            newRefs.add(step)
            t[step] = { ...t[step] }
          }
          t = t[step]
          return
        }

        switch (item.type) {
          case "CREATE": {
            t[step] = item.value
            break
          }
          case "CHANGE": {
            t[step] = item.value
            break
          }
          case "REMOVE": {
            delete t[step]
            break
          }
          default: {
            throw new Error(`unknown diff entry type: ${(item as any).type}`)
          }
        }
      })
    })

    if (this.isPaused) {
      if (!this.didChangeWhilePaused) {
        this.didChangeWhilePaused = true
      }
    }

    this.prev = this.current
    this.current = this.processStateBeforeMerging(next)

    if (!this.isPaused) {
      // Commit an entry to the history
      this.history = this.history.splice(0, this.pointer + 1)
      this.history.push(patch)
      this.pointer++
    }

    this.notifySubscribers()
  }
}

export const storeContext = React.createContext({} as CustomStore)

const INITIAL_STATE: IStore = {
  status: "idle",
  selectedId: null,
  nodes: {},
}

const NODE_COUNT = 1000
const SIZE = 4
const PADDING = 2

const rows = Math.floor(Math.sqrt(NODE_COUNT))

for (let i = 0; i < NODE_COUNT; i++) {
  const id = nanoid()
  INITIAL_STATE.nodes[id] = {
    id,
    x: 0 + (i % rows) * (SIZE + PADDING),
    y: 64 + Math.floor(i / rows) * (SIZE + PADDING),
    width: SIZE,
    height: SIZE,
  }
}

export const useStoreInitializer = () => {
  const [store] = React.useState(() => new CustomStore(INITIAL_STATE))

  return store
}

export const useStoreContext = () => React.useContext(storeContext)
