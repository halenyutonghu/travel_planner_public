# Light Trip Planner

[中文](README.md) | English

Light Trip Planner is a local demo web app for building travel itineraries. It does not connect to AI services, backend servers, databases, or live maps. Instead, it uses built-in sample data for Beijing, Shanghai, Guangzhou, Kunming, and Nanjing, then generates 1- to 7-day itineraries with deterministic planning rules.

Current status: early-stage prototype.

The README is available in English, but the web app itself currently supports Chinese only.

Plans are stored only in the browser you use on your own computer. If you clear browser data, switch browsers, or use another computer, saved plans will not automatically follow you. Prices, travel times, distances, and place details are demo data and should not be used as real travel advice.

## What's in this project

- `src`: The web app, including pages, planning logic, sample data for five cities, and styles.
- `tests`: Automated checks for calculations, pages, and responsive behavior.
- `scripts`: Small validation tools for checking the built-in city data.
- `data-pipeline`: Offline data preparation tools for turning structured facts from public sources into app-ready data. It does not include local databases, virtual environments, or generated collection output.
- `package.json`: Project tools, dependencies, and available commands.

Most users do not need to edit these files manually.

## First-time setup

These steps are written for macOS.

### 1. Open Terminal

Press `Command + Space`, type `Terminal`, and press Enter. A window will open where you can type commands.

### 2. Install Node.js

Node.js is required to run the project tools.

If Node.js is not installed, open `https://nodejs.org/` in your browser, download the **LTS** version, and install it. After installation, close Terminal and open it again.

Run:

```bash
node --version
```

A normal result looks like `v22.x.x`. If you see `command not found`, Node.js is not installed correctly.

### 3. Install pnpm

pnpm is the package manager used by this project. Run:

```bash
npm install --global pnpm@11.9.0
```

Then check it:

```bash
pnpm --version
```

A normal result is `11.9.0` or another version in the same major release.

### 4. Go to the project folder

Each time you open a new Terminal window, run:

```bash
cd "/path/to/travel_planner_public"
```

No output means the command worked. Keep the quotation marks around the path, especially if the folder name contains spaces.

### 5. Install project tools

Run this the first time you use the project, or whenever `package.json` changes:

```bash
pnpm install
```

A normal result includes `Done` and creates a `node_modules` folder. Download speed depends on your network.

## Start the website

Make sure Terminal is in the project folder, then run:

```bash
pnpm dev
```

A normal result includes something like:

```text
Local: http://localhost:5173/
```

Keep that Terminal window open. Open your browser and visit:

```text
http://localhost:5173/
```

If you see the new trip plan page, the app is running.

### Stop the website

Go back to the Terminal window running the project and press:

```text
Control + C
```

When Terminal shows a command prompt again, the website has stopped.

### Start it again

Open Terminal and run:

```bash
cd "/path/to/travel_planner_public"
pnpm dev
```

Then open `http://localhost:5173/` again.

## Suggested demo flow

1. On the new plan page, enter an origin, destination, start date, and end date.
2. Expand lodging, transportation, food, and other sections as needed. Empty fields use defaults.
3. Click generate itinerary and review the daily timeline, transport, budget, risks, and sample data notice.
4. Try replacing, moving, locking, or deleting an attraction.
5. Regenerate the plan and confirm that manual edits and locked items are preserved.
6. Open saved plans and try editing, renaming, duplicating, or deleting a plan.
7. On the itinerary detail page, click print and choose save as PDF in the browser print window.

## Check the project

Regular use does not require these checks. After changing code, use them to confirm the project still works.

Validate the sample data for all five cities:

```bash
pnpm validate:data
```

A normal result says the Beijing, Shanghai, Guangzhou, Kunming, and Nanjing static sample data passed validation.

Run calculation and page component tests:

```bash
pnpm test
```

A normal result shows all test files and test cases as `passed`.

Before running real browser tests for the first time, install the test browser:

```bash
pnpm exec playwright install chromium
```

Then run:

```bash
pnpm test:e2e
```

A normal result shows `6 passed`. This browser is only used for automated checks.

Build static files for release:

```bash
pnpm build
```

A normal result shows `built` and creates a `dist` folder. This first public version does not include a hosted deployment link.

## Common issues

### Terminal shows `command not found: node`

Node.js is not installed correctly. Install the LTS version again, then close and reopen Terminal.

### Terminal shows `command not found: pnpm`

Run:

```bash
npm install --global pnpm@11.9.0
```

### Terminal shows `No such file or directory`

The project path is usually wrong. Copy the `cd` command from this README and keep the quotation marks.

### The browser cannot open `localhost:5173`

Make sure the Terminal window running `pnpm dev` is still open and that you have not pressed `Control + C`. If Terminal shows another port, such as `5174`, open the address shown in Terminal.

### Port `5173` is already in use

Another local project is probably still running. Find the older Terminal window and press `Control + C`, then run `pnpm dev` again. You can also use the new address shown by Terminal.

### Dependency installation fails

Leave the project files as they are. When the network is available again, run `pnpm install` again. Re-running it will not delete completed project files.

### A saved plan is missing

Plans are saved only in the browser that created them. Check that you are using the same browser, have not cleared site data, and are not using private browsing.

### The page shows a sample data notice

This is expected. The first version intentionally does not connect to a live database, map, or AI service. Anything that could affect real travel decisions must be clearly marked as sample or estimated data.
