# Voice tasks — design

Add a task by talking. Speech becomes text on the phone, a small on-device model (Gemma 3 270M)
pulls the task out of the text, and the New task sheet opens pre-filled for review. Nothing
leaves the phone.

## What the user said

- Dictate a task on the Tasks screen; it gets parsed and put into the task form.
- Dictation is relaxed: a short pause must not end the recording.
- Parsing by a small local model, Whisper Flow style; ~300 MB is fine.
- Dates and times are spoken; if the model is weak at dates it may skip them, but everything
  else (title, course, note) should be filled.

## Assumptions (correct me)

- Speech engine: Android's built-in `SpeechRecognizer` (Google, works offline with the offline
  English pack). Chosen by default; Whisper was the alternative.
- Nothing is saved automatically. Parsing only pre-fills the existing New task sheet; the user
  taps Save as today.
- English speech, course names/codes as they appear in the timetable.

## Success criteria

1. Tap the mic on Tasks, talk with pauses of several seconds, tap Done: the full transcript
   is kept.
2. "uh the UX lab report, due friday night, actually make it 11pm" opens New task with title
   "Lab report", course BIIT 2301, due this Friday 23:00.
3. With the model missing or failing, the same flow still opens a pre-filled sheet (rule-based).
4. Parsing a sentence takes under ~3 s once the model is warm.

## Flow

1. Tasks screen gets a mic button beside the + FAB.
2. Tap → Dictation sheet: pulsing mic, live transcript, **Done** and **Cancel**. First use asks
   for the microphone permission.
3. Done → "Reading your task…" → New task sheet opens pre-filled. Fields the parser could not
   fill keep today's defaults (date tomorrow, 23:59); an unresolved date shows the hint
   "Check the date".

## Relaxed dictation (native)

Android's recogniser ends a session after ~1–2 s of silence and usually ignores the "wait
longer" extras. The plugin hides that:

- `startDictation()` starts a session with partial results and `PREFER_OFFLINE`.
- When a session ends (results, `NO_MATCH`, `SPEECH_TIMEOUT`), its final text is appended and a
  new session starts immediately — until `stopDictation()` or a 3-minute cap.
- Events to JS: `partial` (current session text), `final` (appended text). JS shows
  `committed + partial`.
- Real errors (no permission, recogniser busy, network-only recogniser with no network) stop
  and report.
- New permission: `RECORD_AUDIO`.

## Parsing

### Model (native, LiteRT-LM)

- Runtime: LiteRT-LM Android (`com.google.ai.edge.litertlm:litertlm-android`), CPU backend.
  MediaPipe LLM Inference is maintenance-only, so not used.
- Model: `gemma3-270m-it-q8.litertlm` (304 MB) from `litert-community/gemma-3-270m-it`.
- **Delivery:** the Hugging Face repo is gated (licence acceptance + login), so the app cannot
  download it without a token. One-time setup instead: the user accepts the Gemma licence and
  downloads the file on the laptop; it is copied with adb to
  `/sdcard/Android/data/com.awk.hadir/files/models/`. That folder survives app updates.
- Plugin: `parseModelStatus()` → `{installed}`; `generate({prompt})` → `{text}`. Engine loads
  in the background when dictation starts (init can take up to ~10 s, overlapping the talking),
  stays loaded while the app runs, and is closed after 2 minutes idle to free memory.
- Kotlin is added to the Android module for this one class (the API is Kotlin-first).

### Prompt and extraction (TypeScript, unit-tested)

- Prompt = short instruction + the user's active courses (code + name) + 2–3 examples +
  transcript. Asks for JSON only:
  `{"title": "...", "course": "<code or empty>", "date": "<words said, or empty>",
  "time": "<words said, or empty>", "note": "..."}`.
- The model only **copies** the date/time words; it never computes a date.
- Output is validated: JSON parsed leniently (first `{…}` block); title required and trimmed;
  course accepted only if it matches a course (code, or fuzzy name/nickname match), else empty.
- Invalid output → rule-based fallback.

### Date and time resolver (TypeScript, deterministic)

Resolves the copied phrases against "now":

- Dates: today, tonight, tomorrow, day after tomorrow, weekday names ("friday" = next
  occurrence, today counts only if still ahead), "this/next <weekday>", "in N days", "next
  week", ordinals and dates ("15th", "15 Oct", "Oct 15", "15/10").
- Times: "5pm", "5:30 pm", "17:00", "noon", "midnight" (23:59 same day), "morning" 09:00,
  "night"/"tonight" 23:59, "end of day" 23:59.
- Anything it cannot resolve → field left at default and flagged "Check the date".

### Rule-based fallback

Used when the model is not installed, fails, times out (5 s) or returns invalid output:

- Course: first course whose code or name words appear in the transcript.
- Date/time: resolver run over the whole transcript.
- Title: transcript with filler ("uh", "um", "like"), the matched course words and date/time
  phrases removed, then capitalised.

## Settings

A "Voice tasks" row: model installed / not installed (with the setup hint) and the offline
speech pack hint.

## Testing

- TS unit tests: resolver (each phrase family, week wrap, month wrap), output validation,
  course matching, fallback parser, prompt contains courses.
- Tasks UI test: dictation result opens a pre-filled sheet (native plugin mocked).
- Native: manual on the phone — long pauses keep recording, cancel, permission denial, model
  missing → fallback, model present → parse quality on ~10 real sentences.

## First step: quality spike

Before building the Android side, run the prompt through the same `.litertlm` model on the
laptop (LiteRT-LM desktop CLI) on ~15 example sentences. If Gemma 3 270M gets title/course
wrong too often, the options are a 1B model (~550 MB) or rule-based only. Results reported to
the user before the native work.

## Out of scope

- Editing existing tasks by voice; languages other than English; in-app model download.
