import { Trashly } from "./Trashly"

it("Initializes state", () => {
  const store = new Trashly({ name: "Steve", age: 36 })
  expect(store.current.name).toBe("Steve")
  expect(store.current.age).toBe(36)
})

it("Sets state", () => {
  const store = new Trashly({ name: "Steve", age: 36 })
  store.setState({ name: "Kyle", age: 37 })
  expect(store.current.name).toBe("Kyle")
  expect(store.current.age).toBe(37)
  expect(store.history).toMatchObject([
    [
      {
        oldValue: "Steve",
        path: ["name"],
        type: "CHANGE",
        value: "Kyle",
      },
      {
        oldValue: 36,
        path: ["age"],
        type: "CHANGE",
        value: 37,
      },
    ],
  ])
})

it("Sets undoes", () => {
  const store = new Trashly({ name: "Steve", age: 36 })
  store.setState({ name: "Kyle", age: 37 })
  store.setState({ name: "Kyle", age: 38 })
  expect(store.current).toMatchObject({
    name: "Kyle",
    age: 38,
  })
  store.undo()
  expect(store.current).toMatchObject({
    name: "Kyle",
    age: 37,
  })
  store.undo()
  expect(store.current).toMatchObject({
    name: "Steve",
    age: 36,
  })
  store.redo()
  expect(store.current).toMatchObject({
    name: "Kyle",
    age: 37,
  })
  store.undo()
  expect(store.current).toMatchObject({
    name: "Steve",
    age: 36,
  })
  store.redo()
  store.redo()
  store.redo()
  store.redo()
  store.redo()
  store.redo() // Too many redos!
  expect(store.current).toMatchObject({
    name: "Kyle",
    age: 38,
  })
  store.undo()
  store.undo()
  store.undo()
  store.undo()
  store.undo()
  store.undo() // Too many undos!
  expect(store.current).toMatchObject({
    name: "Steve",
    age: 36,
  })
})

it("Pauses and resumes", () => {
  const store = new Trashly({ name: "Steve", age: 36 })
  store.pause()
  expect(store.isPaused).toBe(true)
  store.resume()
  expect(store.isPaused).toBe(false)
})

it("Ignores patches while paused", () => {
  const store = new Trashly({ name: "Steve", age: 36 })
  store.setState({ age: 37 })
  expect(store.prev).toMatchObject({ name: "Steve", age: 36 })
  let t = store.pointer
  store.pause()
  store.setState({ age: 38 })
  expect(store.prev).toMatchObject({ name: "Steve", age: 37 })
  expect(store.pointer).toBe(t)
  store.undo()
  expect(store.current).toMatchObject({ name: "Steve", age: 37 })
  expect(store.pointer).toBe(t)
})

it("Creates a commit after resuming after changing while paused", () => {
  const store = new Trashly({ name: "Steve", age: 36 })
  store.pause()
  store.setState({ age: 37 })
  store.setState({ age: 38 })
  store.resume()
  expect(store.current).toMatchObject({ name: "Steve", age: 38 })
  store.undo()
  expect(store.current).toMatchObject({ name: "Steve", age: 36 })
})

it("Works with mutator", () => {
  const store = new Trashly({
    name: "Steve",
    age: 36,
    interests: {
      manga: false,
      anime: false,
      videoGames: false,
    },
  })

  store.mutate((s) => {
    s.name = "Kyle"
    s.age = 38
    s.interests.manga = true
  })

  expect(store.current).toMatchObject({
    name: "Kyle",
    age: 38,
    interests: { manga: true, anime: false, videoGames: false },
  })

  store.undo()

  expect(store.current).toMatchObject({
    name: "Steve",
    age: 36,
    interests: { manga: false, anime: false, videoGames: false },
  })
})

it("Behaves correctly when acting while in undos", () => {
  const store = new Trashly({ name: "Steve", age: 36 })
  store.setState({ name: "Steve", age: 37 })
  store.setState({ name: "Steve!", age: 38 })
  store.setState({ name: "Steve!!", age: 39 })
  store.undo()
  store.undo()

  expect(store.current).toMatchObject({
    name: "Steve",
    age: 37,
  })

  store.setState({ name: "Steve!!", age: 40 })
  store.undo()

  expect(store.current).toMatchObject({
    name: "Steve",
    age: 37,
  })

  store.redo()

  expect(store.current).toMatchObject({
    name: "Steve!!",
    age: 40,
  })
})

it("Behaves correctly when pausing and resuming while in undos", () => {
  const store = new Trashly({ name: "Steve", age: 36 })
  store.pause()
  store.setState({ name: "Steve", age: 37 })
  store.setState({ name: "Steve!", age: 38 })
  store.setState({ name: "Steve!!", age: 39 })
  store.resume()
  store.pause()
  store.setState({ age: 40 })
  store.resume()
  store.pause()
  store.setState({ name: "Steve!!!!" })
  store.resume()
  store.undo()

  expect(store.current).toMatchObject({
    name: "Steve!!",
    age: 40,
  })

  store.pause()
  store.setState({ age: 44 })
  store.resume()

  expect(store.current).toMatchObject({
    name: "Steve!!",
    age: 44,
  })

  store.undo()

  expect(store.current).toMatchObject({
    name: "Steve!!",
    age: 40,
  })
})
