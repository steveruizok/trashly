import React from "react"
import { INode, LiquorStore, storeContext } from "../LiquorStore"

export class CNode extends React.PureComponent<{ id: string }> {
  static contextType = storeContext as React.Context<LiquorStore>

  context = {} as React.ContextType<typeof storeContext>

  componentDidMount() {
    this.context.addListener(`nodes.${this.props.id}`, () => this.forceUpdate())
  }

  handlePointerDown = (e: React.PointerEvent<SVGRectElement>) => {
    this.context.startPointingNode(this.props.id)
    e.stopPropagation()
  }

  handlePointerUp = (e: React.PointerEvent<SVGRectElement>) => {
    this.context.stopPointingNode()
    e.stopPropagation()
  }

  render() {
    const node = this.context.state.nodes[this.props.id]

    return (
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        onPointerDown={this.handlePointerDown}
        onPointerUp={this.handlePointerUp}
        fill="rgba(144, 144, 144, .5)"
      />
    )
  }
}
