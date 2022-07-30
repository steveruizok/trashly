# trashly

A reactive store that is fine, really. It works with React.

[![Try it Out](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/fancy-hill-yo4sbb?fontsize=14&hidenavigation=1&theme=dark)

> **Note:** These docs assume you're using the `trashly-react` library. The vanilla `trashly-core` library is also available and works exactly the same but without the React hooks.


## Development

```bash
yarn

yarn dev
```

## Installation
```bash
npm i trashly-react
```

or

```
yarn add trashly-react
```

## Usage

Create your state with the `Trashly` constructor.

```tsx
import { Trashly } from "trashly-react"

const store = new Trashly({
  name: "Steve",
  age: 93,
  settings: {
    theme: "dark",
  },
})
```

> **Tip:** The Trashly constructor takes a generic type for the initial state, in case the full type cannot be inferred from the initial value.

Next, subscribe to the store's changes via its hooks.

```tsx
const App = () => {
  const { name, age, settings } = store.useStore()

  return (
    <div>
      <h1>{name}</h1>
      <h2>{age}</h2>
      <h3>{settings.theme}</h3>
    </div>
  )
}
```

There are a few hooks you can use:

- `useStore` - Subscribe to any and all changes in the store.
- `useSelector` - Use a selector function to select out just the state that you need.
- `useStaticSelector` - Like `useSelector` but you don't really have to memoize the selector function.
- `useCanUndo` - Subscribe to whether the store can undo or not.
- `useCanRedo` - Subscribe to whether the store can redo or not.
- `useIsPaused` - Subscribe to whether the store is paused.

### `store.mutate(state => void)`

You can update the state using `store.mutate()`.

```tsx
store.mutate((state) => {
  state.name = "Steve"
  state.age = 94
  state.settings.theme = "light"
})
```

### `store.undo()`

You can undo changes with `store.undo()`. If the store's history was paused then it will resume when `store.undo()` is called.

```tsx
// store.current.age = 93
store.mutate((state) => (state.age = 94))
// store.current.age = 94
store.undo()
// store.current.age = 93
```

### `store.redo()`

You can redo changes with `store.redo()`. If the store's history was paused then it will resume when `store.redo()` is called.

```tsx
store.mutate((state) => (state.age = 94))
store.undo()
store.redo()
// store.current.age = 94
```

### `store.pause()`

You can pause the store's history with `store.pause()`. Changes that occur while paused still effect the state and cause updates, however they do not create entries in the undo / redo stack.

```tsx
store.mutate((state) => (state.age = 94))
store.pause()
store.mutate((state) => (state.age = 95))
store.mutate((state) => (state.age = 96))
store.mutate((state) => (state.age = 97))
store.undo()
// store.current.age = 94
```

### `store.resume()`

You can resume the store's history with `store.resume()`. If the state has changed while paused, this will create a new entry in the undo / redo stack.

```tsx
store.mutate((state) => (state.age = 94))
store.pause()
store.mutate((state) => (state.age = 95))
store.mutate((state) => (state.age = 96))
store.resume()
store.mutate((state) => (state.age = 97))
store.undo()
// store.current.age = 96
store.redo()
// store.current.age = 97
```

## Contribution

Contributions are welcome! Visit the [GitHub repository](https://github.com/steveruizok/trashly) to submit issues or pull requests.

## License

MIT

## Author

- [@steveruizok](https://twitter.com/steveruizok)

## Support

💕 Love this project? Consider [becoming a sponsor](https://github.com/sponsors/steveruizok?frequency=recurring&sponsor=steveruizok).
