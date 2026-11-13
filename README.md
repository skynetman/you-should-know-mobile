# You should know mobile

A Claude Code mod that brings the notes of the built-in "You should know" side agent to the Claude mobile app. It is an independent community mod, not made by Anthropic.

"You should know" (`cc-plugin-you-should-know@builtin`) watches longer tasks and points out things you might miss. It shows its notes only in the band above the prompt. If you follow a session from your phone through Remote Control, you never see them. This mod puts each one in the conversation, in a code block you can copy.

## How it works

1. Every 4 seconds the mod reads the built-in plugin's data file and looks for a new note in the current session.
2. When it finds one, it runs `/side-note` by itself, once per note: the short line and its later explanation count as one. Claude Code queues the command until the session is idle, so the note arrives at the end of the turn, in its latest version.
3. The command prints the title of the note, numbered within the session ("#3"), then its text in a code block, which the mobile app shows with a copy button.
4. On the computer the note is already above the prompt, so the mod asks Claude Code to draw the output as a single dimmed line. The VS Code extension (2.1.322) ignores that and prints the full note in the chat too.

The mod uses a command because, in a test on Android, the mobile app showed command output but not rows a mod places in the transcript (`$.ui.place`) or system notices (`$.session.append`). The app also does not draw the band above the prompt.

Claude Code does not let a mod answer a command that the same mod started: it prints a fallback message instead ("... registered /side-note but no command.run hook answered it ..."). A hook on the `session.append` event replaces that message with the note as the row enters the transcript.

## Install

At the prompt of a Claude Code session in a terminal:

```
/plugin install you-should-know-mobile --marketplace skynetman/you-should-know-mobile
```

From a shell:

```
claude plugin install you-should-know-mobile --marketplace skynetman/you-should-know-mobile
```

The "You should know" plugin must be on. It is off by default; to turn it on, add `"cc-plugin-you-should-know@builtin": true` under `enabledPlugins` in `~/.claude/settings.json`.

## Commands

- `/side-note`: typed by hand, prints the latest note of the session again, in full on every screen.
- `/side-note-test`: replaces the session's latest note with a dummy one and sends it the same way as a real one. Use it after a Claude Code update to check that delivery still works.

## What it reads, stores, and runs

- Reads `~/.claude/plugins/store/cc-plugin-you-should-know_builtin-*.json`, the built-in plugin's data file, every 4 seconds.
- Holds the session's latest note in the state that Claude Code keeps for the mod during the session (`$.state`), so that the queued `/side-note`, or one you type, can print it, even after a reload of the mod.
- Writes no files itself. Its plugin store, a JSON file that Claude Code writes for the mod in `~/.claude/plugins/store/` (the name starts with `you-should-know-mobile_`), holds no note text and contains only the following:
  - for each of the last 200 printed notes, the session ID and a 32-bit FNV-1a hash of the note's one-line summary (for a note without one, the time the built-in plugin showed it), so that no note is printed twice.
  - for each of the last 50 sessions, its ID and how many notes it has printed, for the running number (#1, #2, …) in each note's title.
  - for each session with a `/side-note` in the queue, its ID and the time the command was queued, removed when it runs, so that only one waits at a time.
  - its last 100 events, for troubleshooting: each row holds the time, the kind of event, its source and the result ("ran" or the error message, which can include a file path). A read error identical to the previous one is not logged again. A parse error in the data file is logged with a fixed text, because the parser's own message could quote part of a note.
- Runs one slash command by itself, `/side-note`, at most once per note and never while one is already queued. Claude Code starts it when the session is idle.
- Hooks the `session.append` event to change a single kind of row: the one where `/side-note` holds Claude Code's fallback message, which gets the note instead. Every other row passes as it is.
- Sends nothing over the network.
- Each delivered note becomes part of the conversation and adds a few hundred tokens. Claude Code hands command output to the model as context, not as a request, so Claude does not act on a note by itself. To have one taken into account, name it in your next message, for example "consider #3" or "consider the last side note"; you don't need to copy it. Under each note the mod adds a line telling Claude that the side agent wrote it and that you have neither asked for it nor approved it.

## Privacy

The mod runs on your computer, inside Claude Code, and makes no network calls: it sends nothing to its author or to any other service. It reads the notes of the side agent, which writes them from your session, so they can contain names or other personal details. Apart from printing a note, the mod keeps its text only in the session state; the store holds what "What it reads, stores, and runs" lists. Older entries in the store drop out as newer ones arrive, nothing expires by time, and the file stays until you delete it while Claude Code is closed.

A printed note becomes part of the conversation: Claude Code saves it in the session transcript and sends it to Claude along with your messages, under Claude Code's own data handling.

The first start after an update from 0.1.7 or earlier deletes the note texts those versions kept in the store, replaces the summaries they used as keys with hashes, and removes the parse errors they logged. For questions, open an issue on the [GitHub repository](https://github.com/skynetman/you-should-know-mobile/issues); do not paste note text there.

## Requirements

- Claude Code with mods and their session state (2.1.292 or later). Tested on 2.1.322 in the VS Code extension, with the Claude app on Android over Remote Control.
- "You should know" available and turned on (Claude Code does not offer it in every organization).

## Limits

- The mod depends on two things Claude Code does not document: the format of the built-in plugin's data file, and the text of the fallback message. A Claude Code update can break either one without warning; `/side-note-test` checks the second.
- A note arrives at the end of the turn, not when the side agent writes it.
- Claude still reads every delivered note. The line under it lowers the risk that Claude takes a note as your approval; it does not remove it.
- On the phone you get the text only, without the band's buttons. An explanation is included only when the side agent has already written it.
- In a session started from the phone, with no terminal or editor attached, the built-in plugin does not launch its side agent, so there are no notes to bring.
- In the VS Code extension you see each note twice: above the prompt and in the chat.
- If the side agent writes a second note before the queued `/side-note` runs, only the newer one reaches the chat, under the same number.

## Development

`claude plugin validate .` checks the manifest and the hooks module, and `claude plugin test .` runs the tests in `tests/`.

## License

MIT. See `LICENSE`.
