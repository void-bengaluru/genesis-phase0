**Welcome Page Hosting & Gate Rule**

- **Files of interest:** `welcome.html` (the Phase 1 page), `terminal.html`, `terminal.js`.

- **Goal:** Host `welcome.html` at a public URL, choose a filename (for example `yibiveru.html`) and remove one character from that filename in the gate link shown inside the terminal (for example show `yibi_eru.html` where `_` is the missing character). Students must recover the missing character (or its ASCII) and submit it via the terminal to unlock the gate.

How this repo is wired
- `terminal.js` defines two constants you should set after publishing your welcome page:
  - `GATE_FULL` — the real published URL (e.g. `https://<username>.github.io/<repo>/yibiveru.html`).
  - `GATE_INCOMPLETE` — the incomplete URL to show inside the terminal (same as `GATE_FULL` but replace the missing character with an underscore `_`, e.g. `https://<username>.github.io/<repo>/yibi_eru.html`).
  - `GATE_MISSING` — the single missing character (e.g. `'v'`). The script computes `GATE_MISSING_ASCII` automatically.

- `cat key.bin` prints the incomplete gate URL.
- `cat clue.txt` prints the ASCII code of the missing character (so students can use that value to unlock the gate).
- `open key` will prompt the student for the missing character (or its ASCII). If correct, the terminal opens the full URL in a new tab.

Quick steps to publish on GitHub Pages
1. Create a repository (e.g., `void-genesis`) on GitHub and push this project to it (root of the repo should contain `index.html`, `terminal.html`, `welcome.html`, etc.).
2. In the repo on GitHub: Settings → Pages (or Code and Pages) → select branch `main` (or `gh-pages`) and root `/` as source. Save.
3. GitHub Pages will publish your site at: `https://<username>.github.io/<repo>/`.
4. Your welcome page URL will be: `https://<username>.github.io/<repo>/yibiveru.html` (replace with your filename).

How to set the missing character
- Choose the filename and which single character to remove. For example:
  - Full filename: `yibiveru.html`
  - Incomplete shown in terminal: `yibi_eru.html` (missing `v`)
  - `GATE_MISSING = 'v'` and `GATE_MISSING_ASCII = '118'`.

Update `terminal.js`
- Open `terminal.js`, find the `GATE_FULL`, `GATE_INCOMPLETE`, and `GATE_MISSING` constants near the top and set them to your published URL and chosen missing character.

Logging (optional)
- `terminal.js` contains a `sendLog()` helper and a `LOG_ENDPOINT` placeholder. If you want to collect usage logs (timestamp, uname, device, command, passcode), deploy the Google Apps Script endpoint and paste its URL into `LOG_ENDPOINT`.

If you want, I can (A) provide the Google Apps Script code and deployment steps, and (B) update the constants in `terminal.js` for you after you paste the published `GATE_FULL`.
