# NorthStar Compass — Complete Product Guide

> **Document Purpose:** This is the living user manual for NorthStar Compass. It explains every page, every chart, and every interactive element in plain, user-friendly language. It is maintained alongside the codebase — any UI change must be reflected here.
>
> **Last Updated:** March 2026
> **Version:** Milestone 10.21

---

## Table of Contents

1. [What is NorthStar Compass?](#1-what-is-northstar-compass)
2. [How to Navigate the App](#2-how-to-navigate-the-app)
3. [Home Page](#3-home-page)
4. [My Insights — Personalized Dashboard](#4-my-insights--personalized-dashboard)
5. [Dashboard: Visa Bulletin Trends](#5-dashboard-visa-bulletin-trends)
6. [Dashboard: Sponsor Reliability Score (SRS)](#6-dashboard-sponsor-reliability-score-srs)
7. [Dashboard: EB Category Comparison](#7-dashboard-eb-category-comparison)
8. [Dashboard: Geographic Heatmaps](#8-dashboard-geographic-heatmaps)
9. [Dashboard: Wage Competitiveness](#9-dashboard-wage-competitiveness)
10. [Dashboard: Occupation Demand](#10-dashboard-occupation-demand)
11. [Dashboard: Processing Speed](#11-dashboard-processing-speed)
12. [Dashboard: Backlog Visualization](#12-dashboard-backlog-visualization)
13. [Dashboard: Approval & Denial Trends](#13-dashboard-approval--denial-trends)
14. [About Page](#14-about-page)
15. [Privacy Policy](#15-privacy-policy)
16. [Terms of Use](#16-terms-of-use)
17. [Data Sources & Methodology](#17-data-sources--methodology)
18. [Glossary of Terms](#18-glossary-of-terms)

---

## 1. What is NorthStar Compass?

NorthStar Compass is a free, privacy-first web application built for employment-based (EB) green card applicants. It transforms raw government immigration data — sourced from the Department of Labor, USCIS, Department of State, and Bureau of Labor Statistics — into clear, actionable insights.

**Who it is for:**
- Individuals waiting in the EB1, EB2, EB3, EB4, or EB5 green card queue who want to understand their timeline
- Workers evaluating employers based on their track record of sponsoring and approving green cards
- Professionals benchmarking their salary against H-1B prevailing wage data
- Anyone who wants to understand the scale and trends of US employment-based immigration

**What it is NOT:**
- It is not legal advice. Nothing on site should replace the guidance of a qualified immigration attorney.
- It is not a government service. It is an independent analysis built on publicly available government data.
- It does not collect, store, or share any personal information. All inputs you provide stay in your browser only.

**The data behind it:** The app processes over 18.5 million data records across 40+ government datasets, pre-computed into fast-loading summaries. All calculations happen before you open the app — the site itself has no server, no database, and no backend.

---

## 2. How to Navigate the App

### The Sidebar (Left Navigation)

The sidebar is your primary navigation tool. It is present on every page. On desktop, it is always visible on the left side. On mobile, it collapses and is accessed via a hamburger icon (☰) at the top-left.

**Sidebar sections:**

| Section | Links |
|---------|-------|
| **Main** | Home |
| **Insights** | Priority Date Cortex, Sponsor Score, Approvals |
| **Dashboards** | EB Categories, Geographic, Wages, Occupations, Processing, Backlog |
| **Project** | About |
| **Personal** | My Insights |

Clicking any item navigates you to that page. The currently active page is highlighted in blue. On smaller screens, the sidebar can be toggled open/closed.

### Collapse Button
On desktop, a small arrow button on the sidebar lets you collapse it to icon-only mode (saving screen space), or expand it back to show full labels.

### Theme Toggle
In the bottom-left of the sidebar, there are three icons — Sun (light mode), Moon (dark mode), and Monitor (follow your system setting). Click any to switch. Your preference is saved locally and remembered on your next visit.

### Feedback Button
A floating button in the bottom-right corner of every page. Click it to:
- Submit feedback, a feature request, or a bug report (opens a pre-filled GitHub issue)

---

## 3. Home Page

**Route:** `/`

The home page is your entry point to the app. It introduces what Compass does and provides quick links to all 9 dashboards.

### Hero Section
A large headline with a gradient blue-to-purple treatment introduces the app: *"Navigate Your Immigration Journey with Confidence."* Below it is a short description and a call-to-action button linking to My Insights.

### Key Statistics Bar
Four animated number cards appear when the page loads, each counting up to its final value:

| Stat | What It Means |
|------|--------------|
| **18.5M+ Data Points** | The total number of individual records processed across all government datasets |
| **243K+ Employers** | The number of unique employers in the database who have filed PERM or H-1B applications |
| **15+ Years of History** | The historical depth of data — from 2009 to the present |
| **9 Dashboards** | The number of interactive analytics dashboards available |

These numbers are static indicators of data scale — they do not respond to filters.

### Dashboard Grid
Nine cards arranged in a grid, one per dashboard. Each card shows:
- A colored icon representing the dashboard topic
- The dashboard name
- A one-line description of what it analyzes
- A link that navigates to that dashboard

This grid is the quickest way to jump to any specific dashboard.

### Value Propositions
Three feature cards at the bottom of the page:

- **Real-Time Data** — Highlights that the data is regularly refreshed from government sources
- **Privacy First** — Explains that nothing you enter is ever sent to a server
- **AI-Powered** — Notes that forecasts are generated by machine learning models

---

## 4. My Insights — Personalized Dashboard

**Route:** `/insights`

This is the most personal page in the app. By entering details about your immigration situation, you unlock three smart panels — each tailored specifically to your profile. All data stays in your browser (localStorage) and is never transmitted anywhere.

### Profile Card

A collapsible card at the top of the page with seven fields:

| Field | What to Enter | Why It Matters |
|-------|--------------|----------------|
| **Priority Date** | The date on your I-140 approval notice (format: YYYY-MM-DD) | Used to calculate your place in the visa queue and estimate your wait time |
| **EB Category** | EB1, EB2, EB3, EB3-Other, EB4, or EB5 | Determines which visa bulletin cutoff line you're in |
| **Country of Chargeability** | The country listed on your birth certificate (e.g., India, China, Rest of World) | Determines which country-specific cutoff applies to you |
| **Current Employer** | Your employer's name (free text, fuzzy-matched to 243K+ employers) | Used to show your employer's sponsorship reliability score |
| **Job Title** | Your current or intended job title (e.g., "Software Engineer") | Used to find salary benchmarks matching your role |
| **Wage Offered** | Your annual salary in USD | Used to show where your salary falls in the percentile distribution |
| **Years of Experience** | A number | Context for salary benchmarks |

After filling in your details, click **Save Profile**. The three panels below will populate with personalized data.

---

### Panel A: Green Card Forecast

**Requires:** Priority Date, EB Category, Country of Chargeability

Shown only when a priority date is entered (otherwise shows a call-to-action prompting you to enter it).

**What it shows:**

**Priority Date Timeline Chart**
A combined historical + forecast line chart showing where your priority date stands relative to the visa bulletin cutoffs over time. It has:
- A solid blue line: historical Dates for Filing (DFF) cutoff
- A solid green line: historical Final Action Dates (FAD) cutoff
- A dashed blue line: forecast DFF cutoff for the next 24 months
- A dashed green line: forecast FAD cutoff for the next 24 months
- A horizontal reference line in gold: your priority date

When the cutoff lines cross your priority date line, that is your estimated green card eligibility window.

**DFF Prediction Card** — *When will you be able to file your I-485?*
Shows the estimated month and year when the Dates for Filing cutoff will reach your priority date. Includes a range showing the optimistic vs. realistic scenario.

**FAD Prediction Card** — *When will your green card be approved?*
Shows the estimated month and year when the Final Action Date cutoff will reach your priority date.

**Velocity Statistics**
Four smaller stat cards showing:
- DFF Velocity: How many days per month the DFF cutoff is advancing on average
- DFF Total Gain: How far the DFF cutoff has advanced since tracking began
- FAD Velocity: How many days per month the FAD cutoff is advancing
- FAD Total Gain: How far the FAD cutoff has advanced

Higher velocities mean the line is moving faster, which is good for applicants.

**Forecast Mode Selector**
A three-way toggle above the prediction cards. Choose the scenario that fits how you want to plan:
- **Optimistic:** Assumes the visa bulletin keeps advancing at the strongest recent pace — best-case scenario, no setbacks assumed
- **Realistic:** Applies a moderate haircut to the velocity, accounting for normal slowdowns and occasional retrogression
- **Risk-Adjusted:** Runs 2,000 simulated futures using the actual historical chance of retrogression each month — shows a realistic range that includes setback risk

---

### Panel B: Sponsor Intelligence

**Requires:** Current Employer (selected from dropdown)

Shown only when an employer has been selected.

**Sponsor Reliability Score (SRS) Gauge**
A large animated arc gauge (0–100 scale) showing how reliable your current employer is at sponsoring green cards. The gauge fills in from the determined tier:

| Score Range | Tier | Color |
|-------------|------|-------|
| 80–100 | Platinum | Blue |
| 60–79 | Gold | Emerald |
| 40–59 | Silver | Amber |
| 0–39 | Bronze | Rose |
| No data | Unrated | Gray |

Below the gauge, five sub-score bars break down the overall score into components.

**Employer Key Metrics**
A grid of six metric cards:
- **Approval Rate (24m):** What % of PERM applications were approved in the last 24 months
- **Denial Rate (24m):** What % were denied
- **Total Cases (36m):** How many cases were filed in the last 36 months (higher = more experience)
- **Wage Ratio:** Your employer's median offered wage compared to the prevailing wage (higher = better)
- **Job Category Breadth:** How many different job categories your employer has sponsored (higher = diverse sponsorship)
- **Site Breadth:** How many different work locations your employer has sponsored applicants from

---

### Panel C: Salary Compass

**Requires:** Job Title and/or Wage Offered

Shown only when a job title or wage is entered.

Displays where your salary falls in the distribution for your role:
- Your salary shown as a vertical marker on a bell curve or percentile bar
- P25 (25th percentile), P50 (median), P75 (75th percentile) reference lines
- Estimated percentile rank ("You are in the 67th percentile for Software Engineers")
- Geographic context if a location is provided

---

## 5. Dashboard: Visa Bulletin Trends

**Route:** `/dashboard/visa-bulletin`

This dashboard is the most data-rich tool for understanding the visa bulletin. It shows both historical cutoff movement and 24-month forecasts for your chosen category and country.

### Selectors (Top of Page)

**Category Pills**
Choose which EB visa category to analyze:
- EB1 · EB2 · EB3 (primary)
- EB3-Other · EB4 · EB5 (extended — shown by clicking "More")

Only one category can be selected at a time. Your selection affects all charts and prediction cards on the page.

**Country Pills**
Choose the country of chargeability:
- IND (India) · CHN (China) · ROW (Rest of World) · PHL (Philippines) · MEX (Mexico) · EL SALVADOR/GUATEMALA/HONDURAS

Each country has its own cutoff dates. India and China are separated out because their queues are far longer than the rest of the world.

**Priority Date Input**
An optional date field. When you enter your priority date, the prediction cards and reference line on the chart activate. The date you enter is saved locally and remembered next time.

---

### Main Chart: Priority Date Timeline

A large unified line chart showing the full cutoff history plus 24-month forecast. It contains:

**Solid lines (historical data):**
- **Blue solid line — DFF (Dates for Filing):** The historical monthly cutoff dates for the Adjustment of Status filing window (I-485 filing eligibility)
- **Green solid line — FAD (Final Action Dates):** The historical monthly cutoff dates for final green card approval

**Dashed lines (AI forecast):**
- **Blue dashed line — DFF Forecast:** Model projection of where the DFF cutoff will be each month for the next 24 months
- **Green dashed line — FAD Forecast:** Model projection fo the FAD cutoff for the next 24 months

**Gold horizontal reference line:** Your priority date (only shown when entered). When either cutoff line crosses this horizontal line, that is when you become eligible.

The horizontal axis shows calendar months. The vertical axis shows dates — reading upward means the cutoff is advancing (good), reading downward means retrogression (bad).

Hover over any data point to see the exact cutoff date for that month.

---

### Velocity Summary Bar

Four stat cards directly below the chart selectors:

| Card | What It Means |
|------|--------------|
| **DFF Velocity** | Average number of days per month the Dates for Filing cutoff advances. E.g., "12 days/month" means the cutoff moves about 1.5 weeks forward each month. |
| **DFF Total Gain** | How much total distance (in calendar days) the DFF cutoff has traveled since tracking began |
| **FAD Velocity** | Same as DFF Velocity but for the Final Action Date |
| **FAD Total Gain** | Same as DFF Total Gain but for the Final Action Date |

---

### Prediction Cards

These cards only appear when a priority date is entered (otherwise they show a call-to-action).

**DFF Prediction Card — "Date for Filing"**
*"When can you file your I-485 Adjustment of Status application?"*
- Shows the estimated month/year your priority date will become current for filing purposes
- Shows an estimated wait in months/years from today
- Shows a range: optimistic vs. realistic estimate

**FAD Prediction Card — "Final Action"**
*"When will your green card be approved?"*
- Shows the estimated month/year your priority date will reach the Final Action Date
- This is typically 1–3 years later than the DFF date

**Forecast Mode Selector**
Above the prediction cards. Controls which forecast model is used for the prediction cards and dashed chart lines:
- **Optimistic:** Uses the full observed historical velocity — assumes the best recent trend continues without interruption
- **Realistic:** Uses 70% of observed velocity — a built-in buffer for normal slowdowns and minor setbacks
- **Risk-Adjusted:** The most sophisticated mode. Simulates 2,000 possible futures, each shaped by the realistic monthly probability of a retrogression. The result is a range of outcomes — not just one date — so you can see the breadth of what's plausible

---

### Methodology Section

A collapsible section at the bottom explaining the forecasting model, data sources, and the difference between DFF and FAD dates.

---

## 6. Dashboard: Sponsor Reliability Score (SRS)

**Route:** `/dashboard/employer`

This dashboard lets you research any employer's track record as a green card sponsor — covering approvals, denials, wage competitiveness, and filing trends.

### Overview Bar (Always Visible)

At the top of the page, before any search, a summary bar shows:
- **Total employers in database** (243K+)
- **Employers with SRS scores** (those with enough data to score)
- **Average SRS Score** across all rated employers
- **Tier Distribution Bar** — a stacked horizontal bar showing the breakdown of Platinum / Gold / Silver / Bronze employers population

---

### Employer Search Box

A fuzzy-search input field. Type any employer name (e.g., "Google", "Infosys", "Amazon") and the dropdown will show matching employers with their tier badges. Selecting an employer loads their detailed profile below.

Results are sorted by relevance and SRS score tier.

---

### SRS Score Gauge

After selecting an employer, a large animated arc gauge appears:
- The arc spans 270° and fills proportionally to the employer's SRS score (0–100)
- The tier name and score are shown in the center
- If the employer has an ML-derived score (from a gradient-boosted model trained on employer features), a small blue "ML" badge appears

**Sub-score Breakdown Bars**
Below the gauge, five labeled horizontal bars show which factors drive the overall score:
- Approval Rate Score
- Wage Competitiveness Score
- Volume Consistency Score
- Diversity Score (SOC categories)
- Risk Score (inverse of denial rate spikes)

---

### Employer Detail Card

An 8-cell metrics grid showing PERM and H-1B signal data side-by-side:

| Metric | Definition |
|--------|-----------|
| **PERM Approval (36m)** | Percentage of green card (PERM) applications approved by the Department of Labor in the past 36 months. Higher is better. |
| **PERM Denial (36m)** | Percentage of PERM applications denied in the past 36 months. Lower is better. Watch for trends. |
| **PERM Filings (36m)** | Total number of green card (PERM) applications filed with the Department of Labor in the past 36 months. Reflects the employer's GC sponsorship volume. |
| **H-1B Filings (36m)** | Total number of H-1B (LCA) applications filed with the Department of Labor in the past 36 months. Reflects temporary visa sponsorship volume. |
| **H-1B per GC Filing** | Ratio of H-1B LCA filings to PERM (GC) filings. **≤3× = GC-committed (green)**, 3–10× = typical (amber), 10×+ = H-1B-heavy (red). A lower ratio indicates an employer that actively sponsors workers for green cards, not just extending H-1B status. |
| **Wage Ratio (Median)** | Employer's median offered wage ÷ prevailing wage for the same role; above 100% is above prevailing wage. Shows competitiveness. |
| **Job Category Breadth** | Number of distinct job categories sponsored — indicates how broadly the employer sponsors diverse roles. |
| **Site Breadth** | Number of distinct work locations (states) sponsored — indicates geographic spread of hiring. |

**Interpretation tips:**
- High PERM approval rate + low H-1B per GC ratio = employer is serious about green cards
- High denial rate = possible labor market test issues; review carefully
- High H-1B per GC ratio = employer may use H-1B as long-term strategy rather than stepping stone to GC

---

### Monthly Activity Trend Chart

An area chart showing the employer's month-by-month filing activity for the past 36 months. Three series:
- **Blue area — Total Filings:** Total number of PERM cases filed each month
- **Green area — Approvals:** Certified cases each month
- **Red/Rose area — Denials:** Denied cases each month

Hover over any month to see exact counts. A surge in denials is a red flag. A consistent approval area means a reliable sponsor.

---

## 7. Dashboard: EB Category Comparison

**Route:** `/dashboard/eb-category`

Compare how EB1, EB2, EB3, EB3-Other, EB4, and EB5 visa categories have moved historically, and which is advancing fastest.

### Country Selector Pills

Six pill buttons at the top: **IND · CHN · ROW · MEX · PHL · VIETNAM**
Select a country to see its cutoff timeline. Only one country is shown at a time.

### Chart Type Toggle

Two buttons: **Dates for Filing (DFF)** and **Final Action (FAD)**
Toggle between the two types of visa bulletin cutoffs.

---

### Category Summary Cards

Three cards for EB1, EB2, and EB3 respectively, each displaying:
- Current cutoff date (the most recent visa bulletin month)
- 12-month movement: how much the cutoff has advanced (or retreated) in the past year
- Prediction label: **Advancing** (green), **Stalled** (amber), or **Retreating** (red)

---

### Monthly Advancement Velocity Chart

An area chart where each EB category is a separate colored area stacked vertically over time. The vertical axis shows velocity in days/month — how fast the cutoff is moving for each category. Higher is faster.

Overlapping and separated trends reveal:
- Which categories are moving fastest right now
- Whether one category has slowed while others advance
- Historical patterns like fiscal-year resets in October

---

### Volatility Comparison Chart

A side-by-side bar chart comparing two metrics for each category:
- **Blue bar — Volatility Score:** How much the cutoff fluctuates month to month (higher = more unpredictable)
- **Rose bar — Retrogressions (12m):** How many times in the past 12 months the cutoff date moved backward

A low volatility score with few retrogressions = a more predictable, steadily advancing category. High volatility = risk of sudden setbacks.

---

### Methodology Section
Explains velocity calculation, volatility scoring, and data source (DOS monthly Visa Bulletin).

---

## 8. Dashboard: Geographic Heatmaps

**Route:** `/dashboard/geographic`

Explore where H-1B and PERM activity is concentrated geographically — by US state.

### Dataset Selector

A toggle at the top: **PERM** or **LCA (H-1B)**
- **PERM** shows data from green card labor certification applications
- **LCA** shows data from H-1B Labor Condition Applications

Each dataset has different characteristics — LCA has far more volume as H-1B is a temporary visa used by many more workers.

### Sort-By Metric Dropdown

Sort all states by: Total Filings, Approvals, Unique Employers, Median Wage, or Approval Rate. The chart and table re-rank automatically.

---

### National KPI Cards

Four headline summary cards across the top:
| Card | Meaning |
|------|---------|
| **Total States** | Number of US states (and territories) with at least one filing in the selected dataset |
| **Total Employers** | Number of distinct employers who filed in that dataset |
| **Avg Approval Rate** | National average approval rate across all states |
| **Median Wage** | Median offered wage across all filings nationally |

---

### Top 15 States Bar Chart

A horizontal bar chart showing the 15 states with the most activity for the selected metric. Each bar represents one state; bars are sorted by the selected "Sort By" metric.

- Hover over a bar to see the exact value for that state
- California, Texas, New York, New Jersey, and Washington typically dominate in H-1B filings
- States with high approval rates but lower volume can be interesting employer markets

---

### Data Table

A scrollable table below the chart listing all states with their full metrics:
- **State** — 2-letter abbreviation
- **Total Filings** — total applications filed
- **Approvals** — number approved
- **Unique Employers** — how many different companies filed
- **Median Wage** — median annual wage offered
- **Approval Rate** — percentage approved

Click any column header to sort the table by that column.

A "Show All" button expands the table from the top 15 to all available states.

---

## 9. Dashboard: Wage Competitiveness

**Route:** `/dashboard/wage`

The most detailed salary intelligence tool in the app. Research salaries by employer or by job role, see 5-year trends, and understand where wages fall relative to market benchmarks.

### Search Mode Selector

At the top of the page, two large toggle buttons:
- **By Employer** (default): Search for a specific company to see all the roles they hire and what they pay
- **By Role**: Search for a job title to see which employers pay the most for that role

---

### Employer Mode

**Employer Search Box**
Type an employer name; the fuzzy search matches against 460+ employers with the richest wage data. Selecting one loads the Employer Profile below.

**Empty State — Top H-1B Employers**
Before any employer is searched, the page shows a list of Top H-1B Employers as quick-pick shortcuts. Clicking any loads that employer directly.

#### Employer Profile

Once an employer is selected, a full profile panel appears:

**Growth Badges (4 across the top)**
| Badge | What It Shows |
|-------|--------------|
| **5-Year CAGR** | Compound Annual Growth Rate of median wages over 5 years — a single number capturing long-run wage growth momentum |
| **YoY Change** | Year-over-year change from last fiscal year to the current one |
| **Wage Streak** | How many consecutive years wages have increased (e.g., "3-year streak") |
| **Total Filings** | Total LCA (H-1B) filings by this employer across all years |

**5-Year Wage Trend Chart**
An area chart with fiscal year on the horizontal axis and median wage on the vertical axis. Shows the employer's overall wage trajectory. An upward slope means consistent wage growth; flat or declining is a concern.

**Top Roles Table**
A searchable table listing the top job roles this employer files for, with:
- Job title and SOC code
- Median wage for the most recent year
- Number of LCA filings
- A trend indicator (up/neutral/down) for year-over-year wage change

Click the **expand arrow (›)** on any role row to open the **Role Percentile Trend Chart** for that specific role.

---

#### Role Percentile Trend Chart

A 5-band stacked area chart showing the full wage distribution for one specific role at one employer, by year.

**The five bands (bottom to top):**
| Band | Meaning |
|------|---------|
| **P10** (darkest bottom band) | The 10th percentile — wages at this level or above for 90% of workers |
| **P25** | The 25th percentile |
| **P50 (Median)** | The middle — half earn above, half below |
| **P75** | The 75th percentile |
| **P90** (lightest top band) | The 90th percentile — only 10% earn above this |

**OEWS Reference Line** — A dashed horizontal line showing the Bureau of Labor Statistics Occupational Employment & Wage Statistics national median for this occupation. If the employer's median (P50) is above this line, they pay above the national market rate.

**Trend Summary Badges** below the chart:
- Median growth over 5 years (%)
- Salary range (P10–P90 spread)
- Total filings used in the analysis

---

### Role Mode

**Role Search Box**
Search by job title (e.g., "Data Scientist") or SOC code. The search handles aliases — searching "backend engineer" surfaces "Software Developers."

**Quick-Pick Role Chips**
Before searching, popular roles are shown as quick shortcuts.

**SOC Wage Benchmark Panel**
After selecting a role:
- National median wage (from BLS OEWS)
- P25 / P50 / P75 wage levels
- Geographic wage variation (if available)
- Top employers hiring for that SOC code with their median wages

---

## 10. Dashboard: Occupation Demand

**Route:** `/dashboard/job-demand`

Understand which occupations are in highest demand based on immigration filing volume.

### Window Pills

**1 Year · 2 Year · 3 Year** — Select the time window for aggregating demand. A longer window smooths out year-to-year noise.

### Source Pills

**PERM · LCA** — Switch between green card (PERM) and H-1B (LCA) demand data.

---

### National KPI Cards

| Card | Meaning |
|------|---------|
| **Occupations** | Number of distinct SOC occupation codes with filings in the selected window |
| **Total Filings** | Sum of all filings across all occupations |
| **Avg Median Wage** | Average of median wages across all occupations |
| **Avg Approval Rate** | Average approval rate across all occupations |

---

### Top 25 Occupations by Filing Volume Chart

A horizontal bar chart ranking the top 15 most-filed occupations by volume. Each bar represents one occupation group (e.g., "Software Developers", "Computer Occupations", "Accountants"). Longer bars = more filings = higher demand.

Hover over a bar to see the exact filing count and median wage.

---

### Major Group Summary

A compact summary table collapsing individual SOC codes into their 2-digit major group categories (e.g., "15 — Computer/Math Occupations", "13 — Business/Financial"). Each row shows total filings, number of sub-occupations, and median wage for the group.

A "Show Major Groups" button toggles this section.

---

### Occupation Detail Table

A searchable table with every occupation, listing:
- **SOC Code** — the 6-digit government occupation code
- **Occupation Title** — standardized official name
- **Total Filings** — total applications in the selected window
- **Median Wage** — median salary offered for this occupation
- **Approval Rate** — % of applications approved

Type in the search box above the table to filter by occupation title or SOC code. Results narrow instantly.

---

## 11. Dashboard: Processing Speed

**Route:** `/dashboard/processing`

Track how fast USCIS is processing employment-based immigration cases and how backlogs are trending.

### KPI Cards

| Card | Meaning |
|------|---------|
| **Latest Approval Rate** | The most recent quarterly approval rate (% of cases adjudicated that were approved) |
| **EB Pending Cases** | The current count of EB cases in the pending/backlog queue at USCIS |
| **Backlog (Months)** | At the current approval throughput, how many months of backward work is in the queue |
| **Avg Quarterly Throughput** | The average number of EB cases USCIS processes per quarter across the entire dataset |

---

### EB Pending + Approval Rate Chart

A ComposedChart (two data series on the same chart):
- **Blue area — EB Pending Cases:** The number of pending cases per quarter (left axis, in thousands). Rising = growing backlog. Falling = USCIS catching up.
- **Purple line — Approval Rate %:** The percentage of adjudicated cases that were approved each quarter (right axis). A consistent line near 90%+ is healthy. Drops indicate increased denials or policy changes.

Hover to see both values for any quarter. The two Y-axes allow comparing absolute volume (left) with a percentage rate (right).

---

### Quarterly Throughput Chart

A bar chart showing how many cases USCIS processed each quarter. Bar height = total cases adjudicated. A higher bar means higher throughput. Look for:
- Consistent bar height = steady processing
- Sudden drops = processing slowdowns (policy changes, staffing, COVID, etc.)
- Recent upticks = improving throughput

---

### USCIS Form-Level Breakdown Table

A table listing the most significant USCIS forms for employment-based cases:

| Form | What It Is |
|------|-----------|
| **I-140** | Immigrant Petition for Alien Workers — the employer's petition for the worker |
| **I-485** | Application to Register Permanent Residence (green card application) |
| **I-765** | Work Authorization (EAD) |
| **I-131** | Travel Document (Advance Parole) |

For each form: total receipts, approvals, denials, approval rate, and trend direction.

---

## 12. Dashboard: Backlog Visualization

**Route:** `/dashboard/backlog`

Visualize the scale of the EB green card backlog — how many people are waiting, for how long, and which countries and categories have the most congestion.

### Country & Chart Selectors

**Country Pills:** IND · CHN · ROW (select the country of chargeability to focus on)
**Chart Type:** Dates for Filing (DFF) or Final Action (FAD)

---

### Summary Cards

Three cards, one per major category (EB1, EB2, EB3):
- **Category name** and current backlog depth
- **Estimated wait time** — at the current velocity, how many years until the queue clears
- **Active applicants** in this category + country combination
- **Movement indicator** — is the backlog shrinking, stable, or growing?

---

### Backlog Timeline Chart

An area chart showing the size of the backlog over time. Three colored areas stacked:
- **Blue — EB1 backlog**
- **Purple — EB2 backlog**
- **Emerald — EB3 backlog**

The total height of the combined areas = total backlog. A rising chart means more people are entering the queue than are exiting. A falling chart means the system is clearing faster than new people are entering.

The horizontal axis = calendar time. The vertical axis = estimated number of applicants waiting.

---

### Queue Position Lookup

A personalized tool below the chart:
1. Enter your **priority date** (YYYY-MM-DD format)
2. Select your **EB category** (EB1, EB2, EB3)
3. Click **Look Up**

The tool returns:
- Your estimated position number in the queue
- Estimated wait time from today based on current throughput and velocity
- Where you'd rank if policy suddenly changed (best-case scenario)

---

### Methodology Section

Explains how queue depth is estimated from the combination of DOS waiting list data, USCIS adjudication throughput, and historical priority date velocity.

---

## 13. Dashboard: Approval & Denial Trends

**Route:** `/dashboard/approvals`

A deep-dive historical analysis of PERM (green card labor certification) approval and denial rates from 2006 to present.

### KPI Cards

| Card | Meaning |
|------|---------|
| **PERM Cases (10yr)** | Total PERM applications filed in the past 10 fiscal years |
| **Avg Approval Rate** | Average PERM approval rate over the entire dataset, with trend (Improving / Declining) |
| **Best Year** | The fiscal year with the highest approval rate, and that rate |
| **Total Denied** | Cumulative denied applications, with year-over-year change direction |

---

### Approval Pulse Chart

The main chart — a ComposedChart combining:
- **Stacked bars** — Each bar represents one fiscal year, stacked with color bands for each PERM track (standard, audit, supervised, etc.)
- **Line overlay — Approval Rate %** — A line chart plotted over the bars showing the approval rate trend across years

**Administration Bands toggle** — A button reveals or hides vertical shaded regions marking presidential administration eras. This lets you visually identify whether approval rates changed under different administrations.

Hover over any year's bar to see a breakdown by track: total filed, total approved, total denied, approval rate.

---

### YoY Velocity Chart

A column chart showing the **year-over-year change in approval rate** for each fiscal year. Each column can be positive (approval rate improved vs. prior year) or negative (approval rate declined). This makes it easy to spot specific years that were especially good or bad for applicants.

---

### Cross-Track Comparison Chart

A horizontal bar chart comparing the approval rates across the different PERM processing tracks side by side:
- **Standard Processing** (most applications)
- **Audit Review** (selected for additional scrutiny)
- **Supervised Recruitment** (special compliance processing)
- **NIV / USCIS comparisons** (if available)

This allows you to see whether being selected for audit materially affects your approval chances.

---

### 19-Year Approval Heatmap

A calendar-style heatmap grid where:
- **Rows** = fiscal years (2006–present)
- **Columns** = months within each fiscal year
- **Cell color** = approval rate (darker = higher; lighter = lower)

This provides an at-a-glance pattern recognition view. Hover over any cell to see: the fiscal year + month, exact approval rate, and total case count. Partial years (where data is still being collected) are marked distinctly to avoid misinterpretation.

---

## 14. About Page

**Route:** `/about`

A personal introduction to the app's creator and the guiding principles behind the project.

**Sections:**
- **The Story** — Why this app was built: a personal journey through the employment-based green card process and the desire to make the data transparent and accessible
- **Guiding Principles** — The four commitments: Privacy First, Open Source, Free Forever, Community Driven
- **Data Sources** — A summary of all government data sources used (DOL, USCIS, DOS, BLS)
- **The Pipeline** — A plain-language explanation of how data flows from government sources through processing to the charts you see on screen
- **Technology** — The tech stack powering the app

---

## 15. Privacy Policy

**Route:** `/privacy`

Explains the data practices of the app. Key points:

- **Zero server-side data collection** — The app has no backend and no database
- **No cookies** — No tracking cookies, no session cookies
- **No third-party trackers** — No Google Analytics, no Facebook pixel
- **localStorage only** — Your profile (priority date, employer, salary) is stored only in your browser, on your device
- **PostHog analytics** — Anonymous, aggregated product usage data (which dashboards are viewed, how long users stay) is collected for product improvement, but no personally identifiable information is ever captured
- **You can clear your data** at any time by clearing your browser's localStorage

---

## 16. Terms of Use

**Route:** `/terms`

Key terms:

- The app is provided for **informational and educational purposes only**
- Nothing on the site constitutes **legal advice**
- Information is derived from **publicly available government datasets** and may be incomplete, delayed, or subject to interpretation
- Users should **consult a qualified immigration attorney** for legal decisions
- The open source license (MIT) governs the codebase

---

## 17. Data Sources & Methodology

NorthStar Compass aggregates and analyzes data from the following official US government sources:

| Dataset | Source | Records | Coverage |
|---------|--------|---------|---------|
| PERM Labor Certifications | Department of Labor (DOL) | 1.7M+ | FY2006–FY2024 |
| LCA (H-1B Applications) | Department of Labor (DOL) | 9.6M+ | FY2009–FY2024 |
| Visa Bulletin Cutoffs | Department of State (DOS) | 14K+ | 2005–present |
| OEWS Wage Statistics | Bureau of Labor Statistics (BLS) | 446K+ | Annual |
| USCIS Adjudications | USCIS | 500K+ | FY2014–FY2024 |
| NIV Issuances | Department of State (DOS) | varies | FY2010–FY2024 |
| DHS Admissions | Department of Homeland Security | varies | FY2005–FY2023 |
| Waiting List | Department of State (DOS) | annual | 2000–present |

**Forecasting methodology:**
Compass tracks every Visa Bulletin since 2011 and uses this history to power three forecast modes. **Optimistic** and **Realistic** models extrapolate the recent trend forward at full and 70% velocity respectively, with adjustments for known fiscal-year patterns (cutoffs sometimes reset in October). The **Risk-Adjusted** model goes further: it runs 2,000 simulated futures per series, each one shaped by the actual month-by-month retrograde probability observed over the past 10 years — so the output is a realistic range of outcomes rather than a single date. All three forecasts project 24 months forward. They are probabilistic estimates, not legal guarantees.

**SRS Scoring methodology:**
The Sponsor Reliability Score combines 5 sub-scores: approval rate trend, wage competitiveness (vs. prevailing wage), filing volume consistency, occupational diversity, and risk indicators. A machine learning model (gradient-boosted regressor) supplements the rules-based score with pattern recognition on employer filing behavior.

---

## 18. Glossary of Terms

| Term | Definition |
|------|-----------|
| **Priority Date** | The date your I-140 (or I-130) immigrant petition was filed with USCIS. This is your "place in line" date. The earlier the date, the closer you are to the front of the queue. |
| **Visa Bulletin** | A monthly publication by the Department of State listing the "cutoff dates" for each EB category and country. If your priority date is earlier than the cutoff, you may be eligible to proceed. |
| **DFF — Dates for Filing** | The earlier of the two monthly visa bulletin cutoffs. When your priority date is before the DFF, you can file Form I-485 (Adjustment of Status) with USCIS, even though final approval isn't yet guaranteed. |
| **FAD — Final Action Dates** | The stricter visa bulletin cutoff. When your priority date is before the FAD, USCIS can actually approve and issue your green card. |
| **I-140** | USCIS Form: Immigrant Petition for Alien Workers. Your employer files this to establish your eligibility category. Approval establishes your Priority Date. |
| **I-485** | USCIS Form: Application to Register Permanent Residence (Adjustment of Status). Filing this is the green card application step. |
| **PERM** | Program Electronic Review Management. The DOL process for certifying that a US employer could not find a qualified US worker for the position being offered to a foreign national. Required for most EB2 and EB3 cases. |
| **LCA** | Labor Condition Application. The DOL form employers file when applying for H-1B visas. Contains wage level, job title, and worksite information. |
| **H-1B** | A non-immigrant temporary visa for specialty occupation workers. Many EB green card applicants are on H-1B status during their wait. |
| **SOC Code** | Standard Occupational Classification code. A 6-digit US government code identifying a specific occupation (e.g., 15-1252 = Software Developers). |
| **EB1 / EB2 / EB3** | Employment-Based first, second, and third preference categories. EB1 is for extraordinary ability, multinational managers, and outstanding professors/researchers. EB2 is for advanced degrees or exceptional ability. EB3 is for skilled workers and professionals. |
| **Retrogression** | When a visa bulletin cutoff date moves backward — meaning applicants who were previously eligible are no longer eligible and must wait longer. |
| **SRS** | Sponsor Reliability Score — a NorthStar-proprietary score (0–100) measuring how reliable an employer is at successfully sponsoring green cards. |
| **Prevailing Wage** | The minimum wage an employer must pay an H-1B or PERM worker, as determined by the DOL for that specific job title and location. |
| **OEWS** | Occupational Employment and Wage Statistics — an annual BLS survey providing median wages by occupation and geography. Used as the market wage benchmark in the Wage Competitiveness dashboard. |
| **Adjustment of Status (AOS)** | The process of applying for a green card while already in the United States (as opposed to Consular Processing, which happens abroad). |
| **Velocity** | In NorthStar context, the speed at which a visa bulletin cutoff date is advancing — typically measured in days per month. |
| **CAGR** | Compound Annual Growth Rate — a smoothed annualized growth rate useful for comparing multi-year salary trends across employers. |

---

*This document is maintained alongside the NorthStar Compass codebase. Any new features, dashboard changes, or UI updates must be reflected here. See `.github/copilot-instructions.md` for the update rules.*
