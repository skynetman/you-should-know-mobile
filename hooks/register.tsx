/**
 * you-should-know-mobile
 *
 * The built-in "You should know" plugin (cc-plugin-you-should-know@builtin)
 * draws its notes only in the band above the prompt (AbovePrompt). The Claude
 * mobile app, attached through Remote Control, does not draw that band and does
 * not attach as a mod surface: of the transcript it shows command output, not
 * rows a mod places ($.ui.place) nor system notices ($.session.append with
 * type "system"). Tested on Android, Claude Code 2.1.322.
 *
 * This mod reads the notes from the built-in plugin's data file and, for each
 * new note of the running session, runs /side-note by itself; the command's
 * output is the note. The engine queues the command until the session is idle,
 * so the note arrives at the end of the turn, and the model reads it as
 * context. /side-note typed by hand shows the latest note again.
 * /side-note-test stores a dummy note and delivers it the same way.
 */
import type { EngineInterface, Register } from 'claude-code'

const STORE_PREFIX = 'cc-plugin-you-should-know_builtin-'
const COMMAND = 'side-note'
const TEST_COMMAND = 'side-note-test'
const MANUAL = 'Latest note:'
const NO_NOTE = 'No "You should know" note in this session yet.'
/** What the engine prints when no hook answers the command. */
const FALLBACK = `registered /${COMMAND} but no command.run hook answered it`
// The plugin name in front (without crossing the <local-command-stdout> tag)
// and the whole message up to the closing tag.
const FALLBACK_WHOLE = new RegExp(`[^\\s>]*\\s?${FALLBACK}[^<]*`)
const EVERY_MS = 4000
const MAX_SESSIONS = 50

type View = {
  kind?: string
  line?: string
  text?: string
  explanation?: string
  shownAt?: number
  iteration?: number
}
type BuiltinSession = { id?: string; tag?: string; view?: View }

let logDir: string | undefined
let isChecking = false
/** The last read error logged: the same error is logged once, not every 4 seconds. */
let lastError: string | undefined

async function home($: EngineInterface): Promise<string | undefined> {
  const dir =
    (await $.env.get('HOME').catch(() => undefined)) ||
    (await $.env.get('USERPROFILE').catch(() => undefined))
  return dir ? dir.replace(/\\/g, '/') : undefined
}

async function log($: EngineInterface, row: Record<string, unknown>): Promise<void> {
  try {
    if (logDir === undefined) {
      const dir = await home($)
      if (dir === undefined) return
      logDir = `${dir}/.claude/you-should-know-mobile`
    }
    const file = `${logDir}/events.jsonl`
    const before = (await $.fs.exists(file)) ? await $.fs.read(file) : ''
    const line = JSON.stringify({ at: new Date().toISOString(), ...row })
    await $.fs.write(file, `${before}${line}\n`)
  } catch {
    // logging must never stop the mod
  }
}

function compose(tag: string | undefined, view: View): string | undefined {
  const title = `You should know · ${tag && tag.trim() !== '' ? tag : 'note'}`
  if (view.kind === 'explained' && view.text) return `${title}\n\n${view.text}`
  if (view.kind === 'offer' && view.line) {
    const explanation = view.explanation?.trim()
    return explanation ? `${title}\n\n${view.line}\n\n${explanation}` : `${title}\n\n${view.line}`
  }
  return undefined
}

/**
 * Wraps the text in a markdown code block, which the mobile app shows with a
 * copy button. The fence is longer than any backtick run in the text, so a
 * ``` inside the note does not close the block.
 */
function fence(text: string): string {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map(m => m[0].length))
  const ticks = '`'.repeat(Math.max(3, longest + 1))
  return `${ticks}\n${text}\n${ticks}`
}

/** The text of a text block; undefined for any other block. */
function textOf(b: { type: string; text?: unknown }): string | undefined {
  return b.type === 'text' && typeof b.text === 'string' ? b.text : undefined
}

/** Title outside the code block, body of the note inside. */
function format(note: string): string {
  const [head = '', ...rest] = note.split('\n')
  const body = rest.join('\n').trim()
  return body === '' ? fence(head) : `${head}\n\n${fence(body)}`
}

function idOf(view: View): string {
  const kind = view.kind === 'explained' ? 'e' : 'o'
  return `${view.shownAt ?? 0}-${kind}${view.iteration ?? 0}`
}

/** The latest note of each session, in $.store: it outlives a reload. */
async function latest($: EngineInterface): Promise<Record<string, string>> {
  const all = await $.store.get('latest').catch(() => undefined)
  const out: Record<string, string> = {}
  if (all && typeof all === 'object') {
    for (const [sid, note] of Object.entries(all as Record<string, unknown>)) {
      if (typeof note === 'string') out[sid] = note
    }
  }
  return out
}

/**
 * Stores the session's note and runs /side-note, which prints it: command
 * output is what the mobile app shows. The command runs from a timer, outside
 * any hook, because $.command.run refuses a call inside a hook the turn waits
 * on; the engine queues it until the session is idle.
 */
async function deliver($: EngineInterface, note: string, source: string): Promise<void> {
  const sid = await $.session.id()
  const others = Object.entries(await latest($)).filter(([key]) => key !== sid)
  await $.store.set('latest', Object.fromEntries([...others, [sid, note]].slice(-MAX_SESSIONS)))
  $.clock.after(500, () => {
    $.command.run({ command: COMMAND }).then(
      () => log($, { event: 'command', source, result: 'ran' }),
      err => log($, { event: 'command', source, result: `error: ${String(err)}` }),
    )
  })
}

async function storeFile($: EngineInterface): Promise<string | undefined> {
  const dir = await home($)
  if (dir === undefined) return undefined
  const storeDir = `${dir}/.claude/plugins/store`
  const entries = await $.fs.list(storeDir).catch(() => [])
  const entry = entries.find(v => v.name.startsWith(STORE_PREFIX) && v.name.endsWith('.json'))
  return entry ? `${storeDir}/${entry.name}` : undefined
}

async function check($: EngineInterface): Promise<void> {
  if (isChecking) return
  isChecking = true
  try {
    const file = await storeFile($)
    if (file === undefined) return
    const data = JSON.parse(await $.fs.read(file)) as { sessions?: BuiltinSession[] }
    const sid = await $.session.id()
    const session = data.sessions?.find(s => s.id === sid)
    const view = session?.view
    if (view === undefined) return
    const note = compose(session?.tag, view)
    if (note === undefined) return
    const id = idOf(view)
    const stored = await $.store.get('delivered').catch(() => undefined)
    const delivered = Array.isArray(stored) ? (stored as string[]) : []
    if (delivered.includes(id)) return
    await $.store.set('delivered', [...delivered, id].slice(-200))
    await deliver($, note, 'you-should-know')
  } catch (err) {
    const error = String(err)
    if (error !== lastError) {
      lastError = error
      await log($, { event: 'read-error', error })
    }
  } finally {
    isChecking = false
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'Show the latest "You should know" note of this session, to read or copy on your phone too',
    })
    await $.command.register({
      name: TEST_COMMAND,
      description: 'Test you-should-know-mobile: store a dummy note and deliver it with /side-note',
    })
    $.clock.every(EVERY_MS, () => {
      void check($)
    })
    return next(e)
  })

  // Answers only /side-note typed by hand: the engine does not let a mod answer
  // a command the mod itself ran, and prints its fallback message instead,
  // which the session.append hook below replaces.
  on('command.run', { command: COMMAND }, async $ => {
    try {
      const note = (await latest($))[await $.session.id()]
      if (note === undefined) return { text: NO_NOTE }
      return { text: `${MANUAL}\n\n${format(note)}` }
    } catch (err) {
      return { text: `Note not read: ${String(err)}` }
    }
  })

  // The row the engine writes to the transcript for /side-note run by the mod:
  // the note in place of the fallback message. This is the row the phone shows.
  on('session.append', async ($, e, next) => {
    if (e.message.type !== 'system') return next(e)
    const blocks = e.message.content
    if (!blocks.some(b => textOf(b)?.includes(FALLBACK))) return next(e)
    let note: string | undefined
    try {
      note = (await latest($))[await $.session.id()]
    } catch {
      note = undefined
    }
    if (note === undefined) return next(e)
    const text = format(note)
    const content = blocks.map(b => {
      const old = textOf(b)
      return old?.includes(FALLBACK) ? { ...b, text: old.replace(FALLBACK_WHOLE, () => text) } : b
    })
    return next({ ...e, message: { ...e.message, content } })
  })

  // On the computer (terminal, desktop app, VS Code) the note is already in the
  // band above the prompt, so the automatic output becomes one line. The mobile
  // app is not a mod surface: this hook does not reach it and the note stays whole.
  on('ui.render', { component: 'CommandOutput' }, ($, e, next) => {
    const p = e.props
    if (p.command !== COMMAND || p.isErrored || p.text.includes(MANUAL) || p.text.includes(NO_NOTE)) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>Side-agent note sent to the chat for your phone; here it is in the band above the prompt.</Text>
  })

  on('command.run', { command: TEST_COMMAND }, async $ => {
    try {
      await deliver(
        $,
        'You should know · test\n\nTest note from you-should-know-mobile. If you read it on your phone without typing /side-note, automatic delivery works.',
        'test',
      )
    } catch (err) {
      return { text: `Test not started: ${String(err)}` }
    }
    return { text: 'Test note stored: /side-note will run by itself in a moment and print it.' }
  })
}
