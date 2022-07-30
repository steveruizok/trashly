import { Trashly as _Trashly } from "trashly-core"
import React, { useSyncExternalStore } from "react"

export class Trashly<T extends object> extends _Trashly<T> {
  constructor(initial: T) {
    super(initial)
  }

  useCanUndo = () => {
    return useSyncExternalStore(this.subscribe, this.getCanUndo)
  }

  useCanRedo = () => {
    return useSyncExternalStore(this.subscribe, this.getCanRedo)
  }

  useIsPaused = () => {
    return useSyncExternalStore(this.subscribe, this.getIsPaused)
  }

  useStore = () => {
    return useSyncExternalStore<T>(this.subscribe, this.getState)
  }

  useSelector = <K extends (state: T) => any>(selector: K) => {
    const fn = React.useCallback(() => selector(this.getState()), [selector])
    return useSyncExternalStore<ReturnType<K>>(this.subscribe, fn)
  }

  useStaticSelector = <K extends (state: T) => any>(selector: K) => {
    const [fn] = React.useState(() => () => selector(this.getState()))
    return useSyncExternalStore<ReturnType<K>>(this.subscribe, fn)
  }
}
