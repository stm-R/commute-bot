# Modularize `src/index.js`

## Objective

`src/index.js` (491 lines) has grown into a catch-all: Discord client setup, cron
scheduling, timezone math, debug logging, embed/button builders, and every slash
command handler. Break it apart into focused modules that follow the patterns
already established elsewhere in `src/` (`config.js`, `storage.js`, `report.js`,
`command-handlers/vacation.js`). `vacation.js` has already been extracted — use it
as a style reference, but note the issues called out below before copying its
storage pattern verbatim.

This is a **structural refactor only**. Do not change bot behavior, add
dependencies, add TypeScript, or introduce a build step. Keep CommonJS
(`require`/`module.exports`), keep the existing `[Bot]` / `[Debug]` console.log
prefixes, and keep the `// ─── Section ───` banner-comment style used throughout
the codebase.

## Target structure

```
src/
  index.js                     entrypoint only: create client, register the
                                interactionCreate listener, start the scheduler,
                                login. Should end up well under 50 lines.
  config.js                    (unchanged)
  storage.js                   (unchanged) — commute entry persistence
  vacation-storage.js          NEW — file I/O for vacation end dates, extracted
                                out of command-handlers/vacation.js
  report.js                    (unchanged)
  register-commands.js         (unchanged)

  scheduler.js                 NEW — sendDailyPrompt() + cron.schedule() wiring.
                                Export startScheduler(client) so index.js passes
                                the client in explicitly (avoids a circular
                                require on a shared client singleton).

  utils/
    time.js                    NEW — getNowInTimezoneParts(), the weekday
                                name→index map
    logging.js                 NEW — logInteractionDebug()

  messages/
    commute-prompt.js          NEW — buildCommuteMessage() (embed + buttons for
                                both the real daily prompt and /test)
    report-embed.js            NEW — buildReportEmbed(), buildReportMonthMenu()

  interactions/
    router.js                  NEW — the interactionCreate handler body: dispatch
                                by interaction type (chat command / select menu /
                                button / modal) to the modules below. Keep the
                                top-level try/catch and the ephemeral error reply.
    buttons.js                 NEW — commute button click handling (the
                                confirm-and-remove-buttons logic)
    selects.js                 NEW — report month select-menu handling, delegates
                                into command-handlers/report.js

  command-handlers/
    vacation.js                (existing) — trim to handleVacation only, using
                                vacation-storage.js for persistence
    report.js                  NEW — handleReport, handleReportMonthSelect
    log.js                     NEW — handleManualLog
    help.js                    NEW — handleHelp
    test.js                    NEW — handleTestPrompt
```

One command = one file under `command-handlers/`, matching `vacation.js`
already. `register-commands.js` stays the source of truth for slash command
*definitions*; the files above are just the runtime handlers.

## Migration steps

Do this incrementally, one module at a time, committing after each step so it's
easy to bisect if something breaks. After each step, restart the bot and confirm
it still logs in and `client.once('clientReady', ...)` fires.

1. `utils/time.js` — move `getNowInTimezoneParts` and the weekday map out first;
   it's a pure function with no dependencies, lowest risk.
2. `utils/logging.js` — move `logInteractionDebug` out next, same reasoning.
3. `messages/commute-prompt.js` — move `buildCommuteMessage`.
4. `messages/report-embed.js` — move `buildReportEmbed` and `buildReportMonthMenu`.
5. `command-handlers/help.js`, `command-handlers/log.js`,
   `command-handlers/test.js` — move `handleHelp`, `handleManualLog`,
   `handleTestPrompt` respectively. These only need `storage`, `config`, and the
   message builders from steps 3-4.
6. `command-handlers/report.js` — move `handleReport` and
   `handleReportMonthSelect`, using `messages/report-embed.js`.
7. `vacation-storage.js` — extract `getVacationFile`, `getVacationEndDate`,
   `saveVacationEndDate`, `isUserOnVacation` out of `command-handlers/vacation.js`
   into their own module, mirroring `storage.js`'s shape. `vacation.js` then
   requires it the same way `report.js` requires `storage.js`.
8. `interactions/buttons.js` and `interactions/selects.js` — move the button and
   select-menu branches out of the `interactionCreate` handler.
9. `interactions/router.js` — move what's left of the `interactionCreate` handler
   body (the dispatch logic + try/catch) here. It requires the command handlers
   and the two files from step 8.
10. `scheduler.js` — move `sendDailyPrompt` and the `cron.schedule(...)` call from
    `clientReady`. Export `startScheduler(client)`.
11. `index.js` — what remains: create the `Client`, `client.on('interactionCreate', router)`,
    `client.once('clientReady', () => { ...log lines...; startScheduler(client); })`,
    `client.login(...)`. Delete everything that moved out.

## Bugs found during the audit — surface these to the user, don't silently fix

While reading through the code to plan this refactor, three pre-existing issues
turned up. Point them out and ask how to handle each before changing behavior,
since a faithful module-for-module move would otherwise either bake them in or
accidentally fix them without anyone deciding to:

1. **`index.js:107`** — `if (isUserOnVacation) {` checks the *function reference*
   from `require('./command-handlers/vacation')`, never calls it. A function
   reference is always truthy, so this branch always evaluates true — meaning
   `sendDailyPrompt` may currently be skipping the daily prompt unconditionally.
   `isUserOnVacation` is also `async` and takes a `userId`, but `sendDailyPrompt`
   has no per-user context (it posts once to a shared channel) — so it's unclear
   what the intended check even was.
2. **`index.js:226-246`** — the `interaction.isModalSubmit()` / `'vacationModal'`
   handling block is nested *inside* the button-click branch, after
   `if (prefix !== 'commute' && prefix !== 'commute_test') return;`. A modal
   submit's `customId` won't match that prefix check, so this block is
   unreachable dead code. It also duplicates logic that doesn't match how
   `vacation.js` actually works today (slash command options, not a modal).
   Likely safe to delete, but confirm first.
3. **`command-handlers/vacation.js:4`** — `const DATA_DIR = process.env.DATA_DIR;`
   has no fallback, unlike `storage.js:4`
   (`process.env.DATA_DIR || path.join(__dirname, '..', 'data')`). If
   `DATA_DIR` is unset, `path.join(DATA_DIR, ...)` throws. Align it with
   `storage.js`'s default when extracting `vacation-storage.js` in step 7.

## Verification checklist

- `node -e "require('./src/index.js')"` doesn't throw on require (won't fully
  boot without a Discord token, but catches missing-module/circular-require
  errors immediately).
- Bot logs in and prints the same `[Bot] Logged in as...` / `[Bot] Scheduling
  daily prompt...` / `[Bot] Ready!` lines as before.
- `/help`, `/test`, `/log`, `/report` (with and without the `month` option),
  `/report` month-picker select, `/vacation status|set|off`, and clicking a
  commute button all still work end to end.
- No file ends up requiring something that (directly or transitively) requires
  it back — watch this especially around `scheduler.js` and `interactions/router.js`,
  which both need the `client` instance created in `index.js`; pass it as a
  function argument rather than importing a shared singleton.
