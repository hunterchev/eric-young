# GROK.md: how to run Eric's board

## What this is

Eric's R&D project board for Rearden Research. Seven sheets, one per project. Each sheet shows where its project is, in plain text:

- A **stage** only: Idea, Research, Design, Prototype, Test, Done (ids `idea`, `research`, `design`, `prototype`, `test`, `done`).
- Never a percentage. No progress bars, no "70% done".
- Summary, parts, open questions, next steps, drawings, decisions and a running log.

The board is a log of where each project is. It does not plan or schedule anything.

## Your job

You run this board from here on. When Eric works with you on a project, you keep its sheet true:

- Append a **log entry**: what was done, in his words.
- Set the project's **stage** when it moves (in the project and in that log entry's `status`).
- Record a **decision** when one is made (`decided` on the log entry).
- Add the question's exact text to `answered` when he settles an open question.
- Update `next` (the next steps) and `updatedAt`.
- Add a **new project** when he starts one.
- **Attach drawings** he gives you (see "Adding files").

Then validate and serve (below). All of this is edits to one file, `data/board.json`.

## The data file: `data/board.json`

One JSON object, schema `eric-board/1`:

| Key | What it is |
|---|---|
| `schema` | The string `"eric-board/1"`. Do not change it. |
| `exportedAt` | Date the file was last written, `YYYY-MM-DD`. Update it when you save. |
| `settings` | `{ "title": "Eric Young", "owner": "" }`. Title is required, 60 characters at most. Owner is optional, 80 at most. |
| `projects` | Object keyed by project slug. |
| `log` | Object keyed by log entry id. |
| `assets` | Object: file id mapped to a path, for example `"d6673b…": "images/1.png"`. |

### A project (key = slug)

The key is a lowercase slug and is the project's id, for example `gas-monitor`. Never rename it: log entries point at it.

```json
"gas-monitor": {
  "name": "4-Gas Monitor",
  "tagline": "One line under the name.",
  "status": "design",
  "order": 3,
  "summary": "A few sentences on what the project is.",
  "components": ["Parts and sensors, one per line"],
  "questions": ["Do the alarm relays also need to stop the laydown machine, or only alarm?"],
  "answered": ["Exact text of a question from `questions` that Eric has settled"],
  "next": ["The next concrete step", "Another step"],
  "images": [
    { "id": "5b8612443d398f2f846d6d8242e517d4", "caption": "Fixed four-gas monitor reference", "kind": "image" }
  ],
  "brief": "You are the engineering assistant for the 4-GAS MONITOR project. ... (see below)",
  "updatedAt": "2026-10-12T15:14:54Z",
  "archived": true
}
```

Field by field:

- `name` (required): the sheet's title.
- `status` (required): exactly one stage id from the list above.
- `tagline`, `summary`: plain text.
- `order`: whole number; the sheet is shown as `PRJ-03` for 3. Give a new project the next unused number.
- `components`, `questions`, `next`: arrays of plain strings.
- `answered`: the **exact text** of questions that are settled. A question stays in `questions`; it shows as answered because its text is in `answered`. If you edit a question's wording, its answered mark is lost, so move the text in both. Leave `answered` out when there is none.
- `images`: attachments `{ "id", "caption", "kind" }`. `id` must be a key of `assets`. `kind` is `"image"` (the default when absent) or `"pdf"` for a document. The first image is the sheet's cover.
- `brief`: the project's system prompt (see "Per-project briefs").
- `updatedAt`: ISO 8601 UTC time of the latest change to the sheet.
- `archived`: `true` hides the sheet on the Archived page. Leave the key out when the project is active.

### A log entry (key = id)

The id is `<slug>-<ts>`, for example `gas-monitor-2026-10-12T19:40:00Z`.

```json
"gas-monitor-2026-10-12T19:40:00Z": {
  "project": "gas-monitor",
  "ts": "2026-10-12T19:40:00Z",
  "source": "Grok",
  "status": "design",
  "text": "Worked out the relay wiring: two 4-20 mA heads into the controls, siren and beacon on the alarm relay.",
  "decided": "Use 4-20 mA heads, not relay-only heads"
}
```

- `project` (required): a slug that exists in `projects`.
- `ts` (required): ISO 8601 UTC, `YYYY-MM-DDTHH:MM:SSZ`. The newest entry of a project is the one with the latest `ts`; the key order does not matter.
- `source` (required): `"Grok"`, `"Eric"` or `"Claude"`. Use `"Grok"` for what you write.
- `text` (required): what was done, in Eric's words, plain text, 20000 characters at most.
- `status`: the project's new stage when this entry changed it, else `null`.
- `decided`: optional, a part, vendor or design choice settled in this entry, 2000 characters at most. Leave it out when nothing was decided.

The existing entries are `seed-<slug>` entries written when the board was loaded; leave them as they are.

### Rules

- Ids are slugs: lowercase letters, digits and hyphens.
- All times are ISO 8601 UTC.
- When the stage changes, change `status` on the project and set `status` on the new log entry to the same value.
- Keep the brief's `DASHBOARD UPDATE` block intact (see below).
- No `pct`, no percentages anywhere.

## Every edit

After every change run, from this folder:

```
node scripts/check-board-data.mjs
```

It exits 0 when the file is valid. Anything it prints is a problem in `data/board.json`: fix it and run it again. Never leave the file invalid, and never leave it half-edited between runs.

## Serving the board

Serve from the folder that holds `eric-board.html`, `app/`, `data/` and `images/` together: the page uses relative paths, so it only works from that root.

From this folder, either:

```
python3 -m http.server 8080
```

or, with Docker:

```
PORT=8080 docker compose -p ericboard up -d
```

then open `http://localhost:8080/eric-board.html`. In this mode the page **reads** `data/board.json` and is read-only by design: the buttons that edit are not there. You change the board by editing the file; reload the page to see it. Stop the Python server with Ctrl-C, or `docker compose -p ericboard down`.

To host it for others, copy this whole folder to any static web host.

## Adding files

1. Put the file under `data/files/`, for example `data/files/pump-sketch.png` (create the folder if needed). Do not overwrite an existing file.
2. Add an entry to `assets`: `"<id>": "data/files/pump-sketch.png"`. The id is any new unique lowercase string of letters and digits, 32 characters like the others.
3. Reference that id in the project's `images`: `{ "id": "<id>", "caption": "What it shows", "kind": "image" }` (`"pdf"` for a PDF).
4. Validate.

The existing drawings are under `images/` and are already in the map.

## Per-project briefs

Each project's `brief` field is the system prompt for working on that project. Start every session from the sheet's current state, not from memory: read its stage, decisions (the `decided` values in its log, newest first), open questions (those in `questions` not in `answered`), `next`, and its last log entries. That is the same content the board's "Copy session prompt" produces: the brief, then "CURRENT STATE OF THIS PROJECT" with stage, decisions so far, open questions, next steps and the last five log entries.

Every brief ends with this block, which you print at the end of each session:

```
DASHBOARD UPDATE
STATUS: idea | research | design | prototype | test | done
DONE: <what was worked out this session, 2-4 lines>
DECIDED: <a part, vendor or design choice settled this session, or "none">
NEXT: <the next concrete step>
OPEN: <any question Eric still needs to answer>
```

Its lines map onto the file: STATUS to `status`, DONE to the log entry's `text`, DECIDED to `decided`, NEXT to `next`, OPEN to a new item in `questions`. Do not reword or remove this block from any `brief`.

## What not to do

- No percentages and no progress numbers.
- No new fields outside the schema above, on projects, log entries or the top level.
- Do not delete history. Archive a project (`"archived": true`) instead of removing it; never remove log entries.
- No HTML or Markdown markup in text fields. Plain text only.
- Do not rename a slug or reuse one.
- Do not leave `data/board.json` invalid.
