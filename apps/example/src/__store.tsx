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
      const { path } = item
      let t = next
      let key = path[path.length - 1]

      for (let i = 0; i < path.length - 1; i++) {
        if (!newRefs.has(path[i])) {
          newRefs.add(path[i])
          t[path[i]] = { ...t[path[i]] }
        }
        t = t[path[i]]
      }

      switch (item.type) {
        case "CREATE": {
          t[key] = item.value
          break
        }
        case "CHANGE": {
          t[key] = item.value
          break
        }
        case "REMOVE": {
          delete t[key]
          break
        }
        default: {
          throw new Error(`unknown diff entry type: ${(item as any).type}`)
        }
      }
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

    const delQueue: (() => void)[] = []

    patch.forEach((item) => {
      const { path } = item
      let t = next
      let secondToLastKey = path[path.length - 1]
      let lastKey = path[path.length - 1]

      for (let i = 0; i < path.length - 1; i++) {
        const step = path[i]
        if (!newRefs.has(step)) {
          newRefs.add(step)
          t[step] = { ...t[step] }
        }
        t = t[step]
      }

      switch (item.type) {
        case "CREATE": {
          t[lastKey] = item.value
          break
        }
        case "CHANGE": {
          t[lastKey] = item.value
          break
        }
        case "REMOVE": {
          if (Array.isArray(t)) {
            t[lastKey] = REMOVE_SYMBOL
            delQueue.push(() => {
              if (secondToLastKey !== undefined) {
                t[secondToLastKey] = t[secondToLastKey].filter(
                  (x: any) => x !== REMOVE_SYMBOL
                )
              } else {
                t.filter((x: any) => x !== REMOVE_SYMBOL)
              }
            })
          } else {
            delete t[lastKey]
          }
          break
        }
        default: {
          throw new Error(`unknown diff entry type: ${(item as any).type}`)
        }
      }
    })

    delQueue.forEach((t) => t())

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

  runCommand = (fn: (state: IStore) => void) => {
    this.willChange()
    const tNext = { ...this.current }
    // ---
    fn(tNext)
    // ---
    this.current = tNext
    this.didChange()
    return this
  }

  updateNodes = (
    fn: (state: IStore) => Partial<Omit<INode, "id">> & Pick<INode, "id">[]
  ) => {
    this.willChange()
    const tNext = { ...this.current }
    // ---
    const changes = fn(tNext)
    tNext.nodes = { ...tNext.nodes }
    for (const n of changes) {
      tNext.nodes[n.id] = { ...tNext.nodes[n.id], ...n }
    }
    // ---
    this.current = tNext
    this.didChange()
    return this
  }

  // EVENTS

  startPointingNode = (id: string) => {
    this.pause()
    this.runCommand((s) => {
      s.selectedId = id
      s.status = "pointing"
    })
  }

  movePointingNode = (dx: number, dy: number, shiftKey: boolean) => {
    const { current } = this

    if (current.status === "pointing" && current.selectedId) {
      this.runCommand((s) => {
        s.nodes = { ...s.nodes }

        if (shiftKey) {
          Object.values(s.nodes).forEach((n) => {
            s.nodes[n.id] = {
              ...n,
              x: n.x + dx,
              y: n.y + dy,
            }
          })
        } else {
          const n = s.nodes[s.selectedId!]
          s.nodes[n.id] = {
            ...n,
            x: n.x + dx,
            y: n.y + dy,
          }
        }
      })
    }
  }

  stopPointingNode = () => {
    this.runCommand((s) => {
      s.status = "idle"
      s.selectedId = null
    })

    this.resume()
  }

  startPointingCanvas = (x: number, y: number) => {
    const id = nanoid()

    this.pause()

    this.runCommand((s) => {
      s.nodes = { ...s.nodes }
      s.nodes[id] = { id, x: x - 50, y: y - 50, width: 100, height: 100 }
      s.selectedId = id
      s.status = "pointing"
    })
  }

  stopPointingCanvas = () => {
    this.runCommand((s) => {
      s.status = "idle"
      s.selectedId = null
    })

    this.resume()
  }

  // startPointingNode = (id: string) => {
  //   this.pause()
  //     .chain()
  //     .setSelectedId(() => id)
  //     .setStatus(() => "pointing")
  //     .run()
  // }

  // movePointingNode = (dx: number, dy: number, shiftKey: boolean) => {
  //   const { current } = this

  //   if (current.status === "pointing" && current.selectedId) {
  //     if (shiftKey) {
  //       this.chain()
  //         .updateNodes((s) =>
  //           Object.values(s.nodes).map((n) => ({
  //             id: n.id,
  //             x: n.x + dx,
  //             y: n.y + dy,
  //           }))
  //         )
  //         .run()

  //       return
  //     }

  //     this.chain()
  //       .updateNodes((s) => {
  //         const node = s.nodes[s.selectedId!]
  //         return [{ id: node.id, x: node.x + dx, y: node.y + dy }]
  //       })
  //       .run()
  //   }
  // }

  // stopPointingNode = () => {
  //   this.chain()
  //     .setStatus((s) => "idle")
  //     .setSelectedId((s) => null)
  //     .run()
  //     .resume()
  // }

  // startPointingCanvas = (x: number, y: number) => {
  //   const id = nanoid()

  //   this.pause()
  //     .chain()
  //     .createNodes(() => [
  //       { id, x: x - 50, y: y - 50, width: 100, height: 100 },
  //     ])
  //     .setSelectedId(() => id)
  //     .setStatus(() => "pointing")
  //     .run()
  // }

  // stopPointingCanvas = () => {
  //   this.chain()
  //     .setStatus((s) => "idle")
  //     .setSelectedId((s) => null)
  //     .run()
  //     .resume()
  // }

  // startPointingNode = (id: string) => {
  //   this.pause()
  //   this.mutate((s) => {
  //     s.selectedId = id
  //     s.status = "pointing"
  //   })
  // }

  // movePointingNode = (dx: number, dy: number, shiftKey: boolean) => {
  //   const { current } = this

  //   if (current.status === "pointing" && current.selectedId) {
  //     if (shiftKey) {
  //       this.mutate((s) => {
  //         Object.values(s.nodes).forEach((n) => {
  //           n.x += dx
  //           n.y += dy
  //         })
  //       })

  //       return
  //     }

  //     this.mutate((s) => {
  //       const node = s.nodes[s.selectedId!]
  //       node.x += dx
  //       node.y += dy
  //     })
  //   }
  // }

  // stopPointingNode = () => {
  //   this.mutate((s) => {
  //     s.status = "idle"
  //     s.selectedId = null
  //   })

  //   this.resume()
  // }

  // startPointingCanvas = (x: number, y: number) => {
  //   const id = nanoid()

  //   this.pause()

  //   this.mutate((s) => {
  //     s.nodes[id] = { id, x: x - 50, y: y - 50, width: 100, height: 100 }
  //     s.selectedId = id
  //     s.status = "pointing"
  //   })
  // }

  // stopPointingCanvas = () => {
  //   this.mutate((s) => {
  //     s.status = "idle"
  //     s.selectedId = null
  //   })

  //   this.resume()
  // }
}

export const storeContext = React.createContext({} as CustomStore)

const INITIAL_STATE: IStore = {
  status: "idle",
  selectedId: null,
  nodes: {},
}

const NODE_COUNT = 10000
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

const REMOVE_SYMBOL = Symbol("remove")
