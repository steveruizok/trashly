import set from "lodash.set"
import unset from "lodash.unset"
import cloneDeep from "lodash.clonedeep"
import { diff } from "./diff"
import { Difference } from "./types"

export class Trashly<T extends object> {
  constructor(initial: T) {
    this.prev = initial
    this.current = initial
  }

  prev: T

  current: T

  pointer = -1
  history: Difference[][] = []

  isPaused = false

  didChangeWhilePaused = false

  listeners = new Set<() => void>()

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

  /**
   * Apply a patch to the state.
   * @example
   * store.applyPatch(patch)
   * @private
   */
  protected applyPatch = (patch: Difference[]) => {
    const next = cloneDeep(this.current)

    for (let i = 0; i < patch.length; i++) {
      const item = patch[i]

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

  // PUBLIC API

  get canUndo() {
    return (
      this.pointer >= 0 ||
      (this.pointer === 0 && this.isPaused && this.didChangeWhilePaused)
    )
  }

  get canRedo() {
    return this.pointer < this.history.length - 1
  }

  patch = (patch: Difference[]) => {
    this.willChange()

    this.applyPatch(patch)

    return this
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
  replaceState = (state: T) => {
    this.willChange()

    this.prev = this.current
    this.current = this.processStateBeforeMerging(state)

    this.didChange()
    return this
  }

  /**
   * Set a new state using a partial.
   *
   * @example
   * store.setState({ age: 42})
   * store.setState(state => ({ settings: {...state.settings, darkMode: true } })
   *
   * @param state A state partial OR a function that receives the current state and returns a state partial.
   * @public
   */
  setState = (state: Partial<T> | ((state: T) => Partial<T>)) => {
    this.willChange()

    this.current = this.processStateBeforeMerging(
      typeof state === "function"
        ? { ...this.current, ...state(this.current) }
        : { ...this.current, ...state }
    )

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
  mutate = (mutator: (state: T) => void) => {
    const next = cloneDeep(this.current)
    mutator(next)

    this.willChange()
    this.current = this.processStateBeforeMerging(next)
    this.didChange()
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

    return this.applyPatch(this.history[this.pointer])
  }

  processStateBeforeMerging(state: T) {
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
