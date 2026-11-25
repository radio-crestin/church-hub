/** A SoundFont embedded with `with { type: 'file' }`: its path at runtime. */
declare module '*.sf3' {
  const path: string
  export default path
}
