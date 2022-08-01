import * as React from "react"
import set from "lodash.set"
import unset from "lodash.unset"
import cloneDeep from "lodash.clonedeep"
import { diff } from "./diff"
import { Difference } from "./types"
import { nanoid } from "nanoid"
import { applyPatch } from "./applyPatch"

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

export class LiquorStore {
  constructor(initial: IStore) {
    this.prev = initial
    this.current = initial
  }

  private prev: IStore
  private current: IStore
  private pointer = -1
  private history: Difference[][] = []
  private isPaused = false
  private didChangeWhilePaused = false
  private listeners = new Set<() => void>()

  // PRIVATE

  protected willChange() {
    if (this.isPaused) {
      if (!this.didChangeWhilePaused) {
        this.prev = this.current
        this.didChangeWhilePaused = true
      }
      return
    }

    this.prev = this.current
  }

  protected didChange() {
    if (!this.isPaused) {
      // Commit an entry to the history
      const change = diff(this.prev, this.current)
      this.history = this.history.splice(0, this.pointer + 1)
      this.history.push(change)
      this.pointer++
    }

    this.notifySubscribers()

    return this
  }

  protected notifySubscribers() {
    this.listeners.forEach((l) => l())
  }

  // PUBLIC API

  /**
   * Get whether the store is capable of undoing.
   * @public
   */
  get canUndo() {
    return (
      this.pointer >= 0 ||
      (this.pointer === 0 && this.isPaused && this.didChangeWhilePaused)
    )
  }

  /**
   * Get whether the store is capable of redoing.
   * @public
   */
  get canRedo() {
    return this.pointer < this.history.length - 1
  }

  /**
   * Replace the entire state tree with a different state.
   *
   * @example
   * store.replaceState(newState)
   *
   * @param state The new state to replace the current state with.
   * @public
   */
  replaceState = (state: IStore) => {
    this.willChange()

    this.prev = this.current
    this.current = this.processStateBeforeMerging(state)

    this.didChange()
    return this
  }

  /**
   * Set a new state by mutating the current state.
   *
   * @example
   * store.mutate(state => {
   *  state.age = 42
   *  state.settings.darkMode = true
   * })
   *
   * @param mutator A function that receives the current state and mutates it.
   * @public
   */
  mutate = (mutator: (state: IStore) => void) => {
    const draft = cloneDeep(this.current)

    mutator(draft)

    const patch: Difference[] = diff(this.current, draft)

    const next = applyPatch(this.current, patch)

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

  /**
   * Run a command that mutates the state. Note that this command assumes that you will create new object references for any objects that are mutated.
   * @example
   * store.runCommand(state => {
   *   state.user = { ...state.user, address: { ...state.user.address } }
   *   state.user.address.street = "123 Main St"
   * })
   */
  runCommand = (fn: (state: IStore) => void) => {
    this.willChange()
    const tNext = { ...this.current }
    fn(tNext)
    this.current = tNext
    this.didChange()
    return this
  }

  /**
   * Pause the state's history.
   * @example
   * store.pause()
   * @public
   */
  pause = () => {
    this.isPaused = true
    this.notifySubscribers()
    return this
  }

  /**
   * Resume the state's history. If the state has changed while paused, this will create a new history entry.
   * @example
   * store.resume()
   * @public
   */
  resume = () => {
    if (this.didChangeWhilePaused) {
      // Commit an entry to the history
      const change = diff(this.prev, this.current)
      this.prev = this.current
      this.history = this.history.splice(0, this.pointer + 1)
      this.history.push(change)
      this.pointer++
      this.didChangeWhilePaused = false
    }

    this.isPaused = false
    this.notifySubscribers()
    return this
  }

  /**
   * Undo the state's history.
   * @example
   * store.undo()
   * @public
   */
  undo = () => {
    if (this.isPaused) {
      // Resume and undo anything that has changed since we paused
      if (this.didChangeWhilePaused) {
        this.history = this.history.splice(0, this.pointer + 1)
        this.history.push(diff(this.prev, this.current))
        this.pointer = this.history.length - 1
        this.didChangeWhilePaused = false
      }
      this.isPaused = false
    }

    if (!this.canUndo) return

    const patch = this.history[this.pointer]
    const next = cloneDeep(this.current)

    for (let i = 0; i < patch.length; i++) {
      const item = patch[i]

      switch (item.type) {
        case "CREATE": {
          unset(next, item.path)
          break
        }
        case "CHANGE": {
          set(next, item.path, item.oldValue)
          break
        }
        case "REMOVE": {
          set(next, item.path, item.oldValue)
          break
        }
        default: {
          throw new Error(`unknown diff entry type: ${(item as any).type}`)
        }
      }
    }

    this.pointer--
    this.prev = this.current
    this.current = next

    this.notifySubscribers()

    return this
  }

  /**
   * Redo the state's history. This will resume the history.
   * @example
   * store.redo()
   * @public
   */
  redo = () => {
    if (this.isPaused) {
      if (this.didChangeWhilePaused) {
        this.history = this.history.splice(0, this.pointer + 1)
        this.history.push(diff(this.prev, this.current))
        this.pointer = this.history.length - 1
        this.didChangeWhilePaused = false
        return
      }

      this.isPaused = false
    }

    if (!this.canRedo) return

    this.pointer++

    const patches = this.history[this.pointer]
    const next = cloneDeep(this.current)

    for (let i = 0; i < patches.length; i++) {
      const item = patches[i]

      switch (item.type) {
        case "CREATE": {
          set(next, item.path, item.value)
          break
        }
        case "CHANGE": {
          set(next, item.path, item.value)
          break
        }
        case "REMOVE": {
          unset(next, item.path)
          break
        }
        default: {
          throw new Error(`unknown diff entry type: ${(item as any).type}`)
        }
      }
    }

    this.prev = this.current
    this.current = this.processStateBeforeMerging(next)

    this.notifySubscribers()

    return this
  }

  processStateBeforeMerging(state: IStore) {
    return state
  }

  getState = () => {
    return this.current
  }

  getIsPaused = () => {
    return this.isPaused
  }

  getCanUndo = () => {
    return this.canUndo
  }

  getCanRedo = () => {
    return this.canRedo
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

export const storeContext = React.createContext({} as IStore)

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
  const [store] = React.useState(() => new LiquorStore(INITIAL_STATE))

  return store
}

export const useStoreContext = () => React.useContext(storeContext)
