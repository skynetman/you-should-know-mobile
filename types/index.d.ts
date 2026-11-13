// The values this mod keeps in $.state, which Claude Code holds for the
// session only: the session's latest note, keyed by session id.
/** The note as printed: title with its number, then the text. */
export type Note = string

declare module 'claude-code' {
  interface PluginState {
    'you-should-know-mobile': { note: StateFamily<Note> }
  }
}
