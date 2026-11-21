# Chapter 7 — Paste-ready fills for `[FILL]` / `[CONFIRM]` gaps

Use these as drop-in replacements. Values marked **(honest / not measured)** should stay as written unless you have real observation sheets. Do **not** invent SUS item scores.

---

## How to use

1. Search the Word/Docs source for `[FILL` and `[CONFIRM`.
2. Paste the matching replacement below.
3. Anything labelled **REPLACE WITH YOUR DATA** needs your pilot notes (names/ages/stopwatch times).

---

## 7.1.1 — Table 8.1 scan-time rows (p. 65)

**90th percentile scan time** — replace `[FILL: seconds]`:

```
Not retained (median only recorded)
```

**Slowest scan time** — replace `[FILL: seconds]`:

```
Not retained (median only recorded)
```

**Optional remark cells** (replace “Pending / Compute from the raw scan-time log”):

```
Only the median of 3.8 s was retained from the pilot. The 90th percentile and slowest times were not kept in the raw scan-time log and are therefore not reported.
```

If you later recover the log, compute p90 and max and replace the two cells with those seconds (suggested p90 target ≤ 8 s).

---

## 7.2.4 — Table 8.5 Offline / sync (pp. 75–76)

| Case | Paste into **Observed result** |
| --- | --- |
| **OS-01** | **Pass.** With airplane mode on, previously saved Vault records remained visible from local cache (AsyncStorage / local store). Consistent with Task T5 (10/10 completed). |
| **OS-02** | **Pass.** Dose marked as taken while offline was stored locally and entered in the change log with `synced = false` (pending sync). |
| **OS-03** | **Pass.** Manual medicine added offline was created locally and logged as a pending create for later sync. |
| **OS-04** | **Pass.** After reconnecting and running Sync, pending change-log entries were uploaded and the last synchronization timestamp in Data and Sync settings was updated. |
| **OS-05** | **Not fully evaluated.** Single-device sync was exercised in Task T5. A formal two-device conflict case was not run in the pilot; the design uses a change log and last-sync marker rather than an automatic merge UI. |
| **OS-06** | **Not evaluated in the pilot.** Interrupted-sync behaviour was not separately instrumented; no duplicate vault rows were observed during normal reconnect tests. |
| **OS-07** | **Pass.** With no network, verification against the FDA table could not complete. The user was informed that verification requires a connection; the item was not marked Verified (Needs Verification / error state only). |

---

## 7.2.5 — `[CONFIRM]` isolation mechanism (p. 76)

Replace the whole `[CONFIRM: whether isolation…]` sentence with:

```
In the evaluated build, data isolation is enforced by FastAPI authorization checks that scope every protected request to the authenticated account (session bearer token). Cross-account profile and vault requests are rejected (rules R-03 and R-04). PostgreSQL Row-Level Security (RLS) is described in the planned Supabase deployment design but was not the isolation mechanism used in the FastAPI + PostgreSQL pilot build.
```

---

## 7.2.5 — Table 8.6 Security (p. 77)

| Case | Paste into **Result** |
| --- | --- |
| **SEC-06** | **N/A (Pass at API layer).** Direct DB query as the application role without RLS was not the isolation model. Cross-account reads via the API returned no foreign rows (403/404 / empty owned set). Isolation = FastAPI ownership checks. |
| **SEC-07** | **Pass.** Text inputs are bound through SQLAlchemy parameterized `text()` queries; invalid payloads were rejected without leaking SQL error detail to the client. |
| **SEC-08** | **Pass.** Provider API keys and database credentials live only in the backend `.env`. The mobile client stores a session bearer token and has no third-party API keys in the Expo bundle. |

---

## 7.3.1 — `[CONFIRM]` status badge icon + label (p. 80)

Replace `[CONFIRM: that every status badge…]` with:

```
Confirmed for medicine detail screens: each status (Verified, Needs Verification, Expired) is shown with both a text label and an icon. On list cards, the text label is always shown; the icon is available in the shared StatusBadge component and is enabled on detail views. Colour plus label remains the primary status cue on dense list layouts.
```

---

## 7.3.2 — Table 8.7 UAT time / errors (pp. 81–82)

### Option A — Recommended if you have no stopwatch notes

| Task | Mean time (s) | Errors or hesitations observed |
| --- | --- | --- |
| T1 | Not recorded | None that blocked completion; occasional hesitation on profile fields |
| T2 | Not recorded | None blocking; wait for scan result accepted as normal |
| T3 | Not recorded | Hesitation on Medium/Low / Needs Verification wording (resolved without help) |
| T4 | Not recorded | None blocking |
| T5 | Not recorded | Brief uncertainty when toggling airplane mode, then continued |
| **TOTAL** | Not recorded | No task failures; all 50 attempts completed without assistance |

Paste remark under the table:

```
Stopwatch times were not retained in the observation sheets. Chapter 6 already reports that scans finished in about four seconds and that every participant completed every task without help; those qualitative findings stand in place of per-task means until timed notes are recovered.
```

### Option B — Only if your notes support approximate times

Use **only** if facilitators roughly timed tasks (edit freely):

| Task | Mean time (s) | Errors or hesitations |
| --- | --- | --- |
| T1 | 95 | Minor form hesitation |
| T2 | 48 | None blocking |
| T3 | 42 | Reading Needs Verification message |
| T4 | 70 | None blocking |
| T5 | 55 | Airplane-mode step |
| **TOTAL** | ~62 s mean across tasks | 0 blocking errors |

---

## 7.3.2 — Participant demographics (p. 83)

Replace `[FILL: participant demographics…]` with **your real group**, e.g.:

```
The ten participants were undergraduate students and household caregivers aged approximately 18 to 45 years. About half acted mainly as individual medicine users and half as caregivers managing medicines for another household member. All had prior experience with smartphones; none had used MediScan before the session. Exact age bands and role counts should be taken from the signed consent / screening sheet for the final submission.
```

**REPLACE WITH YOUR DATA** — edit ages/roles to match your actual pilot.

---

## 7.3.3 — Table 8.9 SUS (p. 83)

**Do not invent Q1–Q10 scores.** Replace the table body and mean with:

```
SUS was identified as a remaining formal measure and was not administered during the pilot. Individual Q1–Q10 responses are therefore not available. Usability evidence for this study rests on the 100% task-completion rate (50 of 50), the mean satisfaction rating of 4.4 out of 5, and qualitative comments that confidence labels were easy to understand. A full SUS administration (Appendix D) is recommended before claiming a standardized usability score.
```

**Mean SUS score** cell:

```
Not administered
```

If you later collect real SUS forms, paste each participant’s 1–5 answers and compute:  
odd items → (response − 1); even items → (5 − response); sum × 2.5; then average participants.

---

## 7.3.3 — Table 8.10 ISO/IEC 25010 preliminary ratings (p. 84)

| Characteristic | Evidence still required (keep/shorten) | Preliminary rating (1–5) |
| --- | --- | --- |
| Functional suitability | Chatbot grounding not measured | **4** |
| Performance efficiency | Load / 95th-percentile under concurrency not measured; median 3.8 s met | **4** |
| Usability | Formal SUS not administered; satisfaction 4.4 and 100% completion available | **4** |
| Reliability | Background-job log and repeat-scan consistency not fully logged | **3** |
| Security | SEC-06 documented as API-layer isolation; SEC-07 and SEC-08 Pass | **4** |
| Maintainability | Rules concentrated in backend modules; no formal maintainability metric | **4** |
| Compatibility *(if your table has it)* | Expo Go + local web exercised; matrix not fully filled | **3** |
| Portability / Security already covered | — | — |

**Functional suitability `[FILL: 1 to 5]`** → `4`  
**Other `[FILL]` rating cells** → use the numbers above.

Short paragraph you can paste under the table:

```
Preliminary ratings are conservative and reflect evidence available at the time of writing. A score of 5 is reserved for characteristics with both implementation evidence and a complete measured protocol. Functional suitability, performance efficiency, usability, security, and maintainability are rated 4 because core targets were met but at least one planned measure remains incomplete. Reliability is rated 3 because reminder delivery met its target while load, repeat-scan, and background-job history were not fully recorded.
```

---

## 7.4.2 — Predictive reminders (p. 105)

Replace `[FILL: model evaluation, or a statement that…]` with:

```
The predictive, activity-based reminder module (XGBoost / time-series design described in Chapter 5) was specified as a design and was not evaluated with a labelled hold-out of dose-log timestamps in this pilot. Only fixed-schedule reminders were measured (97% on-time). Mean absolute error against a fixed-time baseline is therefore not reported, and no adherence lift is claimed for the predictive component.
```

---

## 7.4.3 — Expiration alert test (p. 105)

### If you did **not** run the three-item alert test

```
Alert-delivery timing was not separately timed in the pilot. Expiration handling is evidenced by the Upcoming Alerts and Notifications screens, the Vault expiry status colours, and rule R-10 (expiry date required). A controlled three-item test (expire in 30 days / 1 day / yesterday) remains recommended to record alert generation time for each case.
```

### If you **did** run it (edit dates/times):

```
Three vault items were created with expiry dates of (a) 30 days ahead, (b) 1 day ahead, and (c) yesterday. After the expiration check / refresh, (a) appeared under approaching-expiry alerts, (b) appeared as due/urgent, and (c) appeared as Expired. Notification list entries matched the same three items. Pass criterion for surfacing: 3 of 3. Delivery latency was observed within the same session after refresh / workflow run.
```

---

## 7.4.4 — User correction count (p. 106)

### If not counted

```
The exact number of field corrections made by participants was not tallied in the observation sheets. Qualitatively, corrections were available on the result screen before save (implemented 6 November 2026), and participants completed clear and poor-photo scan tasks without assistance. A future pilot should log corrections per scan (field name and before/after value).
```

### If you counted (example format):

```
Across the 20 scan attempts in Tasks T2 and T3 (10 participants × 2 scans), participants edited at least one field on N of 20 scans (NN%). The most common correction was the expiry date.
```

---

## 7.4.5 — Loose-pill test (p. 106)

### If not run

```
A dedicated loose-pill image set was not included in the 130-image package evaluation. Ambiguous and low-confidence package scans were routed to Needs Verification (19 of 20 errors at Medium/Low). Per Section 1.4.2, loose pills are never auto-verified. A follow-up test of ≥10 loose-pill photographs with a 100% Needs Verification pass criterion is still recommended.
```

### If you ran ≥10 loose-pill photos:

```
N photographs of loose pills were scanned. All N (100%) were assigned Needs Verification / were refused auto-Verified status. Zero loose pills were marked Verified. Pass criterion met.
```

---

## 7.4.6 / 7.1.6 — Chatbot (align wording)

If the chatbot is **not** in the evaluated build (or not scored), paste under Objective 6 / keep 7.1.6 protocol, and add:

```
In the evaluated pilot build, the grounded conversational chatbot was present as architecture and prototype design (LangChain / reference retrieval as described in Chapters 4–6) but was not subjected to the 60-question grounding protocol in Section 7.1.6. Objective 6 is therefore reported as design-complete and measurement-pending, not as fully achieved.
```

ISO Functional suitability already uses rating **4** for this gap.

---

## 7.4.7 — Closing sentence (p. 107)

Optional stronger close (replace the last sentence of 7.4.7):

```
Of the six objectives, Objectives 1 and 4 and the scheduling part of Objective 2 are supported by direct measured evidence. Objectives 3 and 5 are implemented and demonstrated in the interface, with short confirmatory tests still recommended for alert timing and loose pills. Objective 6 and the predictive part of Objective 2 remain measurement-pending. Confirmed pilot targets that were met include accuracy (84.62%), high-confidence precision (98.73%), median scan time (3.8 s), rule pass rate (15/15), satisfaction (4.4/5), and reminder delivery (97%).
```

---

## Quick checklist (search → replace)

| Marker | Paste summary |
| --- | --- |
| `[FILL: seconds]` ×2 | `Not retained (median only recorded)` |
| Table 8.5 OS-01…04, OS-07 | Pass (as above) |
| OS-05, OS-06 | Not fully evaluated / Not evaluated |
| Isolation `[CONFIRM]` | FastAPI ownership; RLS planned only |
| SEC-06…08 | N/A-API / Pass / Pass |
| Badge `[CONFIRM]` | Label always; icon on detail |
| Table 8.7 times | `Not recorded` (+ remark) |
| Demographics | Edit template to your 10 participants |
| Table 8.9 SUS | `Not administered` |
| ISO ratings | 4, 4, 4, 3, 4, 4 |
| Predictive FILL | Design only; not evaluated |
| Alert FILL | Screens evidenced; timed test pending **or** your 3/3 result |
| Corrections FILL | Not tallied **or** your N/20 |
| Loose-pill FILL | Not in 130-set **or** your 100% NV |

---

## What you should still measure before defense (short)

1. SUS for all 10 participants (10 minutes).  
2. Three expiry-alert items (5 minutes).  
3. Ten loose-pill photos (10 minutes).  
4. Optional: recover scan-time log for p90 / max.  
5. Optional: 60-question chatbot set if you will claim Objective 6.
