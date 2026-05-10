# Lilien Retention Leak Profile

Generated: 2026-04-10, Claude Code session
Data source: `mcp__tchop-lilien__*` (production)
Design doc: `~/.gstack/projects/HeikoScherer-claude-config/heiko_scherer-main-design-20260409-220945.md`

---

## Question 1: Is the day-0 leak stable?

### Cohort

180-day window: 2025-10-12 to 2026-04-10.
74 registrations pulled via `list_users` ordered by `REGISTERED DESC`, paginated (pages 1-3).
Excluded: 1 API account (471243 "Lilien News").
Deduplicated: 2 duplicate registration pairs identified (Brigitte Texroth x2, BENNY BVB / isak lidberg 7 x2).

**Unique users: 72.**

### Leak classification

`authorizedAt` is the only session proxy available. It reflects the user's **last** login timestamp.

- **LEAKED:** `authorizedAt` is null (never authenticated) OR gap between `registeredAt` and `authorizedAt` < 6 hours (only the initial session, never returned).
- **RETAINED:** gap >= 6 hours (came back at least once after the first session window).

Note: this measures "ever returned," which is more lenient than strict D1 (returned within 24-36h). Users who return on D30 but not D1 are classified RETAINED here.

### Results

| Metric | This study (180d, n=72) | Previous study (6mo, n=74) |
|---|---|---|
| Leak rate (never returned) | **31.9%** (23/72) | 35.1% (26/74) |
| "D1 retention" proxy | **68.1%** (49/72) | 64.9% (48/74) |

Delta: **3.2 percentage points.** Within expected range. The slight difference is explained by this study's more lenient "ever returned" definition vs. the strict D1 window.

**Verdict: The leak is stable.** The ~32-35% day-0 loss rate is a consistent structural feature of Lilien, not a cohort anomaly.

### Critical math correction

The design doc states "~74 new users/month on Lilien." **This is wrong.** The actual data shows:

- 72 unique users over 180 days = **~12 users/month**
- The "74" was the 6-month cohort total, not a monthly rate

This cascades through every downstream calculation:

| Metric | Design doc (wrong) | Actual |
|---|---|---|
| New users/month | ~74 | **~12** |
| Eligible for rescue/month | ~26 | **~4** |
| Treatment arm (90%) over 90 days | ~70 | **~11** |
| Holdout arm (10%) over 90 days | ~8 | **~1** |

**With N=1 in the holdout after 90 days, even the doc's already-pessimistic measurement framing was 8x too optimistic.** The pipe-shipping argument ("v1 is for operational learnings, not lift measurement") still holds, but pooled fleet readout at N>=30 holdout would require ~7.5 years on Lilien alone, or simultaneous operation on 10+ orgs of similar size.

---

## Question 2: Do push-denied users churn more than push-granted?

### Answer: CANNOT COMPUTE. Instrumentation gap.

The tchop MCP exposes **no push-related fields** at the user level. Checked:

- `list_users`: returns id, screenName, email, status, roleId, registeredAt, authorizedAt, position, department. **No push_token, no push_permission, no device platform.**
- `get_user`: identical fields.
- `get_channel_users`: identical fields minus authorizedAt.
- `list_push_notifications`: returns 400 error.

**Proxy attempt (Apple Private Relay = iOS):** Only 6 users in the cohort used Apple Sign-In (`@privaterelay.appleid.com`). 4 leaked, 2 retained. N=6 is meaningless.

**This is the load-bearing premise of the entire design and it is unverifiable with current instrumentation.**

The design doc decision matrix:
> "Can't compute push permission split -> Fix instrumentation first. Not a reason to skip this step."

---

## Question 3: Content dogfood (23 leaked users)

For each leaked user, I pulled the top-engagement content from Lilien during their first 7 days. Rating scale 1-10: "If I'd sent this user an email with the top 3 cards from this period, would they plausibly have come back?"

### Ratings

| # | User | Reg date | Leak type | Top 3 cards available | Rating | Notes |
|---|------|----------|-----------|----------------------|--------|-------|
| 1 | Pinschi1985 | Apr 7 | bounce (2min) | "Reise-Fluch bringt Aufstieg in Gefahr" (95), "Geist von Bielefeld" (93), "PK nach Bielefeld" (76) | **7** | Promotion race anxiety = peak engagement period. Strong pull. |
| 2 | Marc Sinnecker | Apr 4 | bounce (10sec) | same as above | **7** | Same window. 10-sec bounce suggests accidental open or immediate disinterest, but content is compelling. |
| 3 | Talha | Mar 23 | bounce (4min) | "Kohfeldts Arger: DFB klart auf" (106), "Saison-Aus Marseiler" (82), "Schlagerei vor Fanprojekt" (54) | **2** | Gmail, non-German name — likely not a Darmstadt fan. Content irrelevant to this user. |
| 4 | Claudia Baumer | Mar 21 | bounce (2h) | same as above | **6** | Drama-heavy content (referee controversy, injury, violence) has emotional pull. 2h session shows some initial interest. |
| 5 | Brigitte Texroth | Mar 7 | never activated (null x2) | same as above | **3** | Registered twice, never authenticated either time. Email may be invalid or user abandoned signup. Unlikely to open rescue email. |
| 6 | Rasheed Khan | Mar 5 | bounce (0sec) | same as above | **2** | Non-target audience pattern. |
| 7 | Sandra Bock | Mar 4 | bounce (0sec) | same as above | **6** | German name, plausible fan. Referee drama + Marseiler injury = strong hooks. |
| 8 | Thomas Haag | Feb 23 | bounce (0sec) | "Auf geht's" (172), "Eure Meinung dazu?" (126), "Sollen die Lilien aufsteigen?" (81) | **7** | Best content period in the dataset. Promotion debate is high-participation content. Plausible rescue. |
| 9 | McCallum | Feb 19 | never activated (null) | same as above | **3** | Never authenticated. Same pattern as Texroth. |
| 10 | Flex | Feb 11 | bounce (2min) | same as above | **7** | Strong promotion content. Quick bounce suggests UI/UX friction, not content disinterest. |
| 11 | Sebastian W. | Feb 10 | bounce (0sec) | same as above | **7** | Same window. Excellent content available. |
| 12 | Katharina Ganz | Feb 7 | never activated (null) | same as above | **3** | Never authenticated. |
| 13 | Nico Windhorn | Feb 1 | bounce (2h) | same as above | **7** | 2h initial session shows interest. Promotion content is peak pull. |
| 14 | Jens Hofmann | Feb 1 | bounce (0sec) | same as above | **5** | Apple Sign-In, immediate bounce. Content is strong but zero engagement signal. |
| 15 | Klaus Samson | Jan 23 | bounce (0sec) | "image" (114), "Was soll man zum Spiel sagen" (64), "Marseiler ist Lilien-Spieler" (54) | **5** | Standard match content. Decent but not a slam dunk. |
| 16 | Danis2201 | Jan 23 | bounce (0sec) | same as above | **5** | Same window, same assessment. |
| 17 | heyn | Jan 18 | never activated (null) | same as above | **3** | Never authenticated. |
| 18 | Dominik Bruckner | Jan 8 | bounce (0sec) | same as above | **4** | Apple Sign-In, instant bounce. Content is mid-season, less dramatic. |
| 19 | Benedikt | Nov 29 | never activated (null) | "DFB Pokal: Freiburg vs Darmstadt" (88), "So jetzt reicht's mir!" (81), "image" (81) | **3** | Never activated. Cup match content is strong, but this user never finished signup. |
| 20 | Heiko (thiem) | Nov 19 | bounce (2min) | same as above | **6** | DFB Pokal is a tentpole event. Emotional content ("So jetzt reicht's mir!") has pull. |
| 21 | Celine Weps | Oct 31 | bounce (4sec) | "Hab keine Lust auf Mittwoch" (110), "Isac Lidberg offen fur Winterwechsel" (78), "Pokal-Auslosung" (70) | **5** | Transfer rumor + cup draw. Apple Sign-In, instant bounce. |
| 22 | Lars Mauersberger | Oct 28 | bounce (4sec) | same as above | **5** | Same window. Content is good (transfer, cup), but the user gave zero engagement signal. |
| 23 | Konrad Konrad | Oct 14 | bounce (3sec) | same as above | **5** | Same assessment. |

### Summary

**Average dogfood score: 4.9 / 10**

Distribution:
- Score 7 (strong rescue case): 7 users (30%)
- Score 5-6 (marginal): 9 users (39%)
- Score 2-3 (not rescuable): 7 users (30%)

The 7 strong-rescue users share two traits: (a) plausible Darmstadt fan profile, (b) registered during a high-drama content period (promotion race, cup matches). The 7 not-rescuable users split into: never-activated accounts (5) and likely non-target-audience signups (2).

**The content itself is not the problem.** Lilien's top content is genuinely engaging — match reactions, Mittwochsfrage opinion polls, transfer rumors, referee drama. The problem is that ~30% of the leaked cohort are users who would never respond to any email (never activated, or not the target audience), and another ~40% show zero engagement signal (0-second bounce), making rescue plausibility uncertain regardless of content quality.

---

## Applying the decision matrix

The design doc defined four outcomes:

| Finding | Action |
|---|---|
| Ratio >= 1.3 AND avg dogfood >= 6 | Build Approach A |
| Ratio >= 1.3 AND avg dogfood 4-5 | Build A but revisit template/content |
| Ratio < 1.3 AND avg dogfood >= 6 | Do not build A — problem is content/onboarding |
| Ratio < 1.3 AND avg dogfood < 6 | Do not build anything |
| **Can't compute push split** | **Fix instrumentation first** |

**We hit row 5: "Can't compute push permission split."**

The push-granted vs push-denied churn ratio — the load-bearing premise — is not answerable from tchop's current MCP or API surface. Without this data, the entire design rests on the **assertion** that push-denied users churn more, not on evidence.

The dogfood average of 4.9 falls in the "marginal" zone (4-5), which means even if the push split were favorable (>= 1.3), the recommendation would be "build but revisit content selection" — not a clean green light.

---

## Additional findings

### Leaked user taxonomy

The 23 leaked users are not a uniform group. Three distinct profiles:

1. **Never-activated (5 users, 22%):** Registered, never authenticated. `authorizedAt` = null, status INACTIVE. Email rescue is unlikely to work — these users didn't complete the basic signup flow. May indicate signup friction, accidental downloads, or invalid emails.

2. **Non-target-audience (2 users, 9%):** Registration patterns (generic gmail, non-German names) inconsistent with a Darmstadt 98 fan community. These are noise, not signal.

3. **Bounced fans (16 users, 70%):** Plausible Darmstadt fans who opened the app once and left. This is the actual rescue-eligible population. 16 out of 72 total = **22% of all new users**, or **~2.7 users/month**.

At 2.7 rescue-eligible users/month, the 90-day treatment arm would have **~7 users**. Even without a holdout, this is too small to learn anything from a single org.

### Monthly registration rate

| Month | Registrations |
|---|---|
| Oct 2025 (12th onward) | 3 |
| Nov 2025 | 8 |
| Dec 2025 | 5 |
| Jan 2026 | 10 |
| Feb 2026 | 16 |
| Mar 2026 | 12 |
| Apr 2026 (to 10th) | 4 |

February spike (16) correlates with Lilien's promotion push — more media coverage, more downloads. Monthly rate is volatile, not steady.

---

## Recommendation

**Do not build Approach A yet. Fix the instrumentation gap first.**

The premise gate was designed to prevent building infrastructure to answer a question that data can answer. The data answered Question 1 (leak is stable: yes) and Question 3 (content quality: marginal). But the load-bearing Question 2 (push-denied users churn more) is unanswerable without push permission data in the API.

### Concrete next steps

1. **Ask the backend team (Ron) one question:** "Can we expose `push_permission` or `push_token_exists` as a boolean field on the user object in the admin API?" This is an information question, not a dev project. If the data exists in the DB (it almost certainly does — the Retention Push feature needs it), exposing it is a small query change.

2. **Once push data is available, re-run this analysis.** The script is ~3 tool calls. The content dogfood is already done and doesn't change.

3. **If push data confirms ratio >= 1.3:** Build Approach A, but with the corrected volume math (12 users/month, not 74). Adjust the measurement plan: pooled fleet readout across 4+ orgs is mandatory from day 1, not a "nice to have for v2."

4. **If push data shows ratio < 1.3:** The email rescue project is the wrong solution. The real problem is onboarding quality or content discovery, not channel reach. Redirect effort there.

5. **Regardless of outcome:** The ~22% never-activated and non-target signups deserve investigation on their own. Why do 5 out of 72 users register but never authenticate? Is there a signup flow bug, an email confirmation step that loses people, or a discoverability problem that attracts non-fans?

---

## Raw data

### All 23 leaked users

| ID | Name | Registered | authorizedAt | Gap | Type |
|---|---|---|---|---|---|
| 471756 | Pinschi1985 | 2026-04-07 11:23 | 2026-04-07 11:25 | 2min | bounce |
| 471563 | Marc Sinnecker | 2026-04-04 09:53 | 2026-04-04 09:53 | 10sec | bounce |
| 470831 | Talha | 2026-03-23 14:43 | 2026-03-23 14:47 | 4min | bounce |
| 470715 | Claudia Baumer | 2026-03-21 19:26 | 2026-03-21 21:25 | 2h | bounce |
| 469072 | Brigitte Texroth | 2026-03-07 12:12 | null | - | never activated |
| 468921 | Rasheed Khan | 2026-03-05 09:39 | 2026-03-05 09:39 | 0sec | bounce |
| 468873 | Sandra Bock | 2026-03-04 15:38 | 2026-03-04 15:38 | 0sec | bounce |
| 468305 | Thomas Haag | 2026-02-23 03:51 | 2026-02-23 03:51 | 0sec | bounce |
| 467708 | McCallum | 2026-02-19 19:20 | null | - | never activated |
| 467271 | Flex | 2026-02-11 12:33 | 2026-02-11 12:35 | 2min | bounce |
| 467246 | Sebastian W. | 2026-02-10 22:49 | 2026-02-10 22:49 | 0sec | bounce |
| 466960 | Katharina Ganz | 2026-02-07 10:56 | null | - | never activated |
| 466483 | Nico Windhorn | 2026-02-01 17:11 | 2026-02-01 19:01 | 2h | bounce |
| 466474 | Jens Hofmann | 2026-02-01 14:34 | 2026-02-01 14:34 | 0sec | bounce |
| 465706 | Klaus Samson | 2026-01-23 15:41 | 2026-01-23 15:41 | 0sec | bounce |
| 465699 | Danis2201 | 2026-01-23 13:46 | 2026-01-23 13:46 | 0sec | bounce |
| 465027 | heyn | 2026-01-18 13:28 | null | - | never activated |
| 462313 | Dominik Bruckner | 2026-01-08 20:09 | 2026-01-08 20:09 | 0sec | bounce |
| 459987 | Benedikt | 2025-11-29 15:24 | null | - | never activated |
| 459506 | Heiko (thiem) | 2025-11-19 16:10 | 2025-11-19 16:12 | 2min | bounce |
| 458513 | Celine Weps | 2025-10-31 11:43 | 2025-10-31 11:43 | 4sec | bounce |
| 458406 | Lars Mauersberger | 2025-10-28 15:39 | 2025-10-28 15:40 | 4sec | bounce |
| 458129 | Konrad Konrad | 2025-10-14 14:48 | 2025-10-14 14:48 | 3sec | bounce |

### Duplicate registrations (merged)

- **469072 + 469071:** Brigitte Texroth / "Brigizte Texroth" — same day, similar typo'd emails (`britte.tex@` / `britte.rex@`), both INACTIVE. Counted as 1 leaked user.
- **459588 + 459587:** "isak lidberg 7" / "BENNY BVB" — same day, similar emails (`bennys2901@` / `bennys29.01@`). isak lidberg returned next day (RETAINED). BENNY BVB never activated. Counted as 1 retained user.
