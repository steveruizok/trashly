import { Difference } from "./types"

export function applyPatch<T>(target: T, patch: Difference[]) {
  const refs = new Set<string | number>()
  const delQueue: (() => void)[] = []
  const next = (Array.isArray(target)
    ? target.slice()
    : Object.assign({}, target)) as T

  patch.forEach((item) => {
    const { path } = item
    let secondToLastKey = path[path.length - 1]
    let lastKey = path[path.length - 1]

    let t = next as any

    for (let i = 0; i < path.length - 1; i++) {
      const step = path[i]

      // Create new object references
      if (!refs.has(step)) {
        refs.add(step)
        t[step] = Object.assign({}, t[step])
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
          t[lastKey as number] = REMOVE_SYMBOL
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

  // emit events for each new ref?

  delQueue.forEach((t) => t())

  return next
}

const REMOVE_SYMBOL = Symbol("remove")
