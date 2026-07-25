# RoR2ItemSync SDK

Everything you need to build a companion app against [RoR2ItemSync](https://thunderstore.io/), a Risk of Rain 2 mod that exposes the player's live run state as JSON over a WebSocket.

**[→ Read the docs](https://turnertt.github.io/RoR2ItemSync-SDK/docs.html)**

Your app connects to `ws://<host>:11420/`, receives a `hello`, and then gets the run streamed to it — inventories, stats, buffs, gold, world state, minions, teleporter and boss progress, plus discrete events as they happen. It can also ask for things: a forced snapshot, run totals, each player's loadout, or a replay of the run so far.

There is nothing to install. Every modern language has a WebSocket client, and the protocol is plain JSON.

```python
import json, websocket

ws = websocket.create_connection("ws://127.0.0.1:11420/")
ws.send(json.dumps({"type": "request_world_state"}))

while True:
    msg = json.loads(ws.recv())
    if msg["type"] != "inventory_update":
        continue
    for player in msg["players"]:
        print(player["display_name"], "-", len(player["items"]), "items")
```

## What's here

| | |
| --- | --- |
| **[docs.html](https://turnertt.github.io/RoR2ItemSync-SDK/docs.html)** | The protocol reference. Quickstart, every message, the run journal, and the failure model. Start here. |
| **[inspector.html](https://turnertt.github.io/RoR2ItemSync-SDK/inspector.html)** | A live WebSocket inspector — open it while the game is running and click Connect. |
| **[types.ts](types.ts)** | TypeScript definitions for every message. Copy it into your project. |
| **[examples/](examples/)** | Real captured payloads, one per message type. |

## Versioning

Two schemas ship side by side:

- The **live protocol** (`inventory_update`, events, request/response) is at `schema_version: 2`.
- The **bulk catalog dumps** (modded items, achievements) are at `schema_version: 1`.

Fields are added additively within a schema version, so **ignore message types and fields you don't recognise** — that's the compatibility contract. Feature-detect against `hello.capabilities` rather than hardcoding what exists.

## Multiplayer

Full fidelity requires the machine running the mod to be the **host** (always true solo). When it has joined someone else's lobby, live state keeps streaming but most *events* never fire, because their hooks are server-side. Check `inventory_update.is_host` and see the "Hosting vs joining" section of the docs.

## Licence

MIT — see [LICENSE](LICENSE). The types and examples exist to be copied into your app; go ahead.
