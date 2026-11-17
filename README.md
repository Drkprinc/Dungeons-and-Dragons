# Emberfall Legends — first playable prototype

A browser-based, multiplayer tabletop-adventure prototype inspired by the general format of fantasy role-playing games. It uses HTML, CSS, and vanilla JavaScript in the browser, plus a small Node.js server for rooms, matchmaking, private actions, and authoritative character state.

## What is included

- A full-screen dragon-and-ruins title screen with the start controls kept to the left.
- Private rooms with five-character invite codes and shareable invite links.
- Random matchmaking: two to five players searching on the same running server are grouped together.
- A maximum of five players per room and a minimum of two to start.
- Three settings: Classic Fantasy, Sword & Steel (no magic), and Mythic Sci-Fi.
- Easy, balanced, and hard difficulty settings.
- A character draft with **two more options than the number of players** (for five players, seven options).
- A custom-character option whose class and starting stats are selected/created by the server.
- A shared story feed, individual character sheets, HP/resources, signature-move cooldowns, and learned techniques.
- Private action submission. Other players see only who has submitted, never the text of another player's action.
- A server-side d20 check and a combined Dungeon Master resolution after every player submits.
- An optional OpenAI Responses API integration. Without an API key, the built-in demo Dungeon Master lets you test the entire game loop.

## Run it in VS Code

You need Node.js 20 or newer and npm.

1. Extract the ZIP file, then open the `emberfall-legends` folder in VS Code.
2. Open the VS Code terminal in that folder.
3. Install the packages:

   ```bash
   npm install
   ```

4. Copy `.env.example` to a new file named `.env`.
5. To enable AI story generation, add your API key to `.env`:

   ```env
   OPENAI_API_KEY=your_api_key_here
   OPENAI_MODEL=gpt-5.5
   PORT=3000
   ```

   Keep `.env` private. Do not paste your API key into `app.js`, `index.html`, or any code that runs in a browser. The model name is configurable; use a model that is enabled for your API project.

6. Start the app:

   ```bash
   npm start
   ```

7. Open **http://localhost:3000** in your browser.

If you skip the API key, the game runs in demo mode with a simple built-in narrator and the same room/character/action flow.

## Test multiplayer on one computer

1. Open `http://localhost:3000` in one browser window and create a room.
2. Copy the invite link or five-character code.
3. Open a second browser window (or an Incognito window) and join the room. Use a different player name.
4. Once both players are in the lobby, the host clicks **Begin Character Draft**.
5. Each player chooses a different available hero or creates a custom one.
6. In the adventure, type an action and submit it. The first player's action remains private while the second player is still deciding. The Dungeon Master resolves only after both submit.

For testing random matchmaking, open the game in two or more separate browser sessions and click **Find Random Players** in each one.

## How the first-pass rules work

- A d20 is rolled for each submitted action. The character's small class bonus is added to the roll.
- Storybound uses DC 9, Adventurer uses DC 13, and Nightmare uses DC 16.
- A natural 20 is a critical success; a natural 1 is a critical failure.
- The Dungeon Master receives the party sheets, actions, and authoritative dice results. It narrates one combined outcome and may suggest HP/resource changes or a learned technique. Players can regain one technique charge by taking a clear breather/regroup action.
- The server clamps HP and resource changes, only allows a signature move when its cooldown is zero, and rejects obvious magical move names in Sword & Steel.
- The client never receives another player's private action text.

These are prototype rules, not a complete tabletop ruleset. The numbers and mechanics are intentionally easy to adjust in `server.js`.

## Project layout

```text
emberfall-legends/
├── public/
│   ├── assets/
│   │   └── dragon-bg.png
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## Important limitations before putting it online

This is a first prototype, not a production-ready public service:

- Rooms, matchmaking, and game state live in server memory. Restarting the server clears them.
- There is no account system, database, moderation/reporting flow, reconnect token security, anti-cheat audit, or rate limiting yet.
- Random matching only works for people connected to the same deployed server instance.
- To play with friends over the internet, deploy the **Node.js server** to a host that supports WebSockets/Socket.IO and serve it over HTTPS. A static-only host cannot run the multiplayer server.
- The AI API key must stay on the server. API use may incur charges under the account that owns the key.

On Windows, `start-windows.bat` can install dependencies (when needed) and launch the server for you.

The next sensible engineering step is persistent rooms/player identities and safe deployment, followed by richer character progression, a deeper dice/skill system, campaign saving, and moderation controls.
