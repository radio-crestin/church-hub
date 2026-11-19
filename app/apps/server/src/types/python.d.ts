/** A Python script embedded with `import x from './x.py' with { type: 'text' }`. */
declare module '*.py' {
  const source: string
  export default source
}
