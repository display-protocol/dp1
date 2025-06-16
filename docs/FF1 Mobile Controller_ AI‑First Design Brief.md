# FF1 Mobile Controller: AI‑First Design Brief

Updated: 12 Jun 2025

---

## 0\. Why we’re doing this

1. **Future users will *talk to*, not tap at, their tools.** Widgets an LLM can’t see or drive become tomorrow’s tech‑debt.  
2. **DP‑1 already speaks JSON** and contains the full state of an artwork or playlist—prime LLM fuel.  
3. **Openness is FF1’s moat.** “Runs on FF1” only matters if *anyone* (humans *and* AIs) can script, automate and remix the experience.

---

## 1\. North‑star experience

**“Hey FF1, find me a 2‑hour generative art mix that feels like Bauhaus colours, then push it to the kitchen display at 6 pm.”**

One sentence →  
• DP‑1 playlist draft • scheduled `PUT /device/{id}/playlist` • brief confirmation.  
If the GUI vanished, the flow would still work from a shell script—or ChatGPT.

---

## 2\. Five design principles

| \# | Principle | Concrete guidance |
| :---- | :---- | :---- |
| **P1** | **Everything is addressable text** | All state in versioned JSON/GraphQL: devices, playlists, prefs, layouts. No hidden SQLite or binary blobs. |
| **P2** | **GUI \= optional skin** | The four‑panel mock‑ups are a *reference client*. They read/write the same API an LLM does. |
| **P3** | **Command‑palette first, taps second** | Global ⌘K / long‑press Prompt Bar turns NL into typed commands (`list feeds`, `display id=xyz`). Expose parser as public endpoint. |
| **P4** | **Idempotent, script‑friendly endpoints** | `PUT /device/{id}/playlist`, `PATCH /playlist/{id}`, `GET /search?...` deterministic; side‑effects gated behind explicit `POST /action`. |
| **P5** | **State diffs over dumps** | Return JSON‑patches so LLMs reason over *what changed* instead of re‑parsing blobs. |

---

## 3\. Starter backlog & ownership

| Week | Deliverable | Owner | Notes |
| :---- | :---- | :---- | :---- |
| **W1** | Public API sketch (REST/GraphQL, JSON‑Schema, auth & rate‑limits) | **Anh** | Locks ground truth early. |
| **W2** | Prompt Bar prototype (text → JSON preview) | **Anh** / Todd+Lucian | Prove parser before fancy UI. |
| **W3** | DP‑1 playlist editor (load‑edit‑save JSON, 1‑click revert) | **Anh** | Validates text round‑trip. |
| **W4** | “Explain this artwork” GPT endpoint | **Anh** | First in‑app AI wow. |
| **W5** | Scripting playground (Monaco / VS Code Web, read‑only) | **Anh** | Seeds plug‑in ecosystem. |
| **W6** | QA \+ accessibility sprint | Team | Full sprint, no squeezing. |

*Add one week buffer for integration & bug‑burn.*

---

## 4\. Cross‑cutting pillars

* **Safety & provenance** – every mutating command carries `caller`; server signs DP‑1 change‑sets.  
* **Offline resilience** – mobile queues patches and replays when online; UI shows pending count.  
* **AI cost guard‑rails** – per‑device daily budget; throttle & alert on overage.

---

## 5\. Governance & versioning

* **DP‑1** uses SemVer; major bump \= breaking. Migration guide \+ backwards‑compat test suite run in CI. :contentReference\[oaicite:1\]{index=1}  
* **Mobile API** mirrors DP‑1 version (`/v1/`, `/v2/`).  
* OpenAPI spec lives in repo root; GitHub Action regenerates typed clients and publishes Swagger UI.

---

## 6\. Timeline reality‑check

Five weeks (plus buffer) is aggressive if Todd & Lucian are also polishing visuals. Suggest parallel tracks:  
*Anh → command bus / parser / API*  
*T\&L → visual skin / Prompt Bar UX.*

---

## 7\. Quick wins before kickoff

1. Publish a **mini DP‑1 sample feed** (1 device, 2 playlists).  
2. Spin up a Slack **`/ff` slash‑command** demo hitting the new API.  
3. Define success metric: *“By W6, ≥ 50 % of internal art changes happen via Prompt Bar or API.”*

---

## 8\. UI tweaks in current mock‑ups

| Screen | AI‑first tweak |
| :---- | :---- |
| Directory | “/” prompt filters live (`/moma curated last‑week`). |
| Art Blocks | Show raw `feedSignature` \+ **Copy cURL**. |
| Grid | Long‑press → **Generate ‘similar’ playlist** (GPT). |
| Artwork detail | Sticky **AI Notes** tab (provenance, style seeds). |
| Global | Press‑and‑hold anywhere → Prompt Bar. |

---

## 9\. Analogy

**DP‑1 is MIDI for art.**  
MIDI thrived because every DAW, synth and script could read a plain‑text dump of notes & controllers. Playlists and device commands must be just as hackable.

---

*None of this blocks gorgeous visual polish—the best AI‑native apps feel simpler because the heavy lifting happens under the hood.*  
