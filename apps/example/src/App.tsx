import { Trashly } from "trashly-react"

interface INode {
  id: string
  x: number
  y: number
  width: number
  height: number
}

interface IStore extends Record<string, any> {
  status: "idle" | "pointing"
  selectedId: string | null
  nodes: Record<string, INode>
}

const store = new Trashly<IStore>({
  status: "idle",
  selectedId: null,
  nodes: {},
})

function Node({ node }: { node: INode }) {
  return (
    <rect
      x={node.x}
      y={node.y}
      width={node.width}
      height={node.height}
      onPointerDown={(e) => {
        store.pause()
        if (e.shiftKey) {
          store.mutate((s) => {
            for (const id in s.nodes) {
              s.nodes[id].x += e.movementX
              s.nodes[id].y += e.movementY
            }
          })
        } else {
          store.mutate((s) => {
            s.selectedId = node.id
            s.status = "pointing"
          })
        }
        e.stopPropagation()
      }}
      onPointerUp={(e) => {
        store.mutate((s) => {
          s.status = "idle"
          s.selectedId = null
        })
        store.resume()
        e.stopPropagation()
      }}
    />
  )
}

function App() {
  const state = store.useStore()

  return (
    <div className="App">
      <svg
        className="canvas"
        onPointerDown={(e) => {
          store.pause()
          store.mutate((s) => {
            const id = "n" + Date.now()
            s.nodes[id] = {
              id,
              x: e.clientX - 50,
              y: e.clientY - 50,
              width: 100,
              height: 100,
            }
            s.selectedId = id
            s.status = "pointing"
          })
        }}
        onPointerUp={() => {
          store.mutate((s) => {
            s.status = "idle"
            s.selectedId = null
          })
          store.resume()
        }}
        onPointerMove={(e) => {
          if (state.status === "pointing" && state.selectedId) {
            if (e.shiftKey) {
              store.mutate((s) => {
                for (const id in s.nodes) {
                  s.nodes[id].x += e.movementX
                  s.nodes[id].y += e.movementY
                }
              })
            } else {
              store.mutate((s) => {
                const node = s.nodes[s.selectedId!]

                if (node) {
                  node.x = e.clientX - 50
                  node.y = e.clientY - 50
                }
              })
            }
          }
        }}
      >
        {Object.values(state.nodes).map((node) => (
          <Node key={node.id} node={node} />
        ))}
      </svg>
      <div
        className="controls"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => {
            store.undo()
          }}
        >
          Undo
        </button>
        <button
          onClick={() => {
            store.redo()
          }}
        >
          Redo
        </button>
      </div>
    </div>
  )
}

export default App
