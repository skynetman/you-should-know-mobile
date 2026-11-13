// The values this mod keeps in $.state, which Claude Code holds for the
// session only, each keyed by session id: the session's latest note, and the
// time the mod started in this Claude Code process.
/** The note as printed: title with its number, then the text. */
export type Note = string

declare module 'claude-code' {
  interface PluginState {
    'you-should-know-mobile': { note: StateFamily<Note>; started: StateFamily<number> }
  }
}
