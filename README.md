# You should know mobile

A Claude Code mod that brings the notes of the built-in "You should know" side agent to the Claude mobile app. It is an independent community mod, not made by Anthropic.

"You should know" (`cc-plugin-you-should-know@builtin`) watches longer tasks and points out things you might miss. It shows its notes only in the band above the prompt. If you follow a session from your phone through Remote Control, you never see them. This mod puts each one in the conversation, in a code block you can copy.

## How it works

1. Every 4 seconds the mod reads the built-in plugin's data file and looks for a new note in the current session.
2. When it finds one, it runs `/side-note` by itself, once per note: the short line and its later explanation count as one. Claude Code queues the command until the session is idle, so the note arrives at the end of the turn, in its latest version.
3. The command prints the title of the note, then its text in a code block, which the mobile app shows with a copy button.
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
- Keeps the latest note of each of the last 50 sessions in its own plugin store, along with a key for each note it has already delivered and a mark while a `/side-note` waits in the queue.
- Logs its last 100 events in the same store: each command it runs, and each read error that differs from the previous one. It writes no file.
- Runs one slash command by itself, `/side-note`, at most once per note and never while one is already queued. Claude Code starts it when the session is idle.
- Hooks the `session.append` event to change a single kind of row: the one where `/side-note` holds Claude Code's fallback message, which gets the note instead. Every other row passes as it is.
- Sends nothing over the network.
- Each delivered note becomes part of the conversation and adds a few hundred tokens. Claude Code hands command output to the model as context, not as a request, so Claude does not act on a note by itself: to have one taken into account, say so in your next message (for example, "consider the note above").

## Requirements

- Claude Code with mods (2.1.287 or later). Tested on 2.1.322 in the VS Code extension, with the Claude app on Android over Remote Control.
- "You should know" available and turned on (Claude Code does not offer it in every organization).

## Limits

- The mod depends on two things Claude Code does not document: the format of the built-in plugin's data file, and the text of the fallback message. A Claude Code update can break either one without warning; `/side-note-test` checks the second.
- A note arrives at the end of the turn, not when the side agent writes it.
- On the phone you get the text only, without the band's buttons. An explanation is included only when the side agent has already written it.
- In a session started from the phone, with no terminal or editor attached, the built-in plugin does not launch its side agent, so there are no notes to bring.
- In the VS Code extension you see each note twice: above the prompt and in the chat.
- If the side agent writes a second note before the queued `/side-note` runs, only the newer one reaches the chat.

## Development

`claude plugin validate .` checks the manifest and the hooks module, and `claude plugin test .` runs the tests in `tests/`.

## License

MIT. See `LICENSE`.
