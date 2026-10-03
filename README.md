# NovaMerge

A polished, local-first 2048-style merge puzzle. Slide matching tiles together, build toward 2048, and keep going after the milestone.

**Play:** https://nova-merge.vercel.app

## Play

- Use the arrow keys or **W A S D**, or swipe on the board.
- Matching tiles merge once per move; a move that changes nothing does not spawn a tile.
- The next tile is previewed before it enters the board.
- **U** or **Undo move** reverses the last move. One undo is available at a time.
- **R** opens the new-run confirmation.
- Progress and your personal best are saved in this browser. No account is required.
- **Share score** uses the device share sheet where available, with a copy-to-clipboard fallback.

## Run locally

Open `index.html` in a modern browser, or serve the repository as a static site. The game has no build step or backend. `style.css` provides the interface and `app.js` contains the game logic.

The game loads its display fonts from Google Fonts. Game progress is stored only in browser `localStorage`.
