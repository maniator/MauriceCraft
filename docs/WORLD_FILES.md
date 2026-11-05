# World saves and binary transfer

MauriceCraft autosaves every **15 seconds** during normal play, and saves on
pause/menu, world changes, page hide and app close (subject to browser shutdown
limits). A visible **Save World** button confirms that IndexedDB has committed
the current world's metadata and dirty chunks. If saving fails, the UI warns
you and keeps the world in memory; do not close the tab until the issue is fixed.

Use the **Menu** button at the top center of the screen on desktop or mobile
to return to the main menu. On desktop, **Esc** releases captured mouse
input and opens the menu; the on-screen Menu control is clickable when
mouse capture is not active.

## Export a world

Open the menu and choose **Export** beside a saved world. The download is a
`.mcraft` binary file. Exporting your current world triggers a verified save
first, then reads its complete metadata and every stored changed chunk
(including Nether and End chunks) from Dexie/IndexedDB.

## Import a world

Open the menu, choose **Import World**, and select a `.mcraft` file. The game
verifies its signature, format version, lengths, chunk coordinates, dimensions,
checksum and metadata. Malformed, truncated, corrupted and unsupported future
versions are rejected without touching existing worlds.

An import **never overwrites** an existing world, even if the same file is
imported repeatedly. Each import gets a fresh UUID for the world and remapped
chunk keys; duplicate names get an `(imported)` suffix. After import, select
it from **Worlds**. The original full 64-bit seed (on v5 worlds), generation version, game state, portal
metadata, inventory and existing chunk data are retained. The first import
does not automatically replace the currently selected world.

The current maximum archive size is 256 MB; the file uses native binary chunk
data without base64 expansion or extra third-party libraries. Browser
permissions/storage limits still apply. World files can be shared between
devices and browser origins, including a future custom domain.

## File format (v1)

All numeric values are little-endian. All offsets are in bytes.

| Offset | Data |
| --- | --- |
| 0 | ASCII `MCWORLD1` (8 bytes) |
| 8 | Format version, `uint16` (currently 1) |
| 10 | Reserved flags, `uint16` (must be zero) |
| 12 | Metadata UTF-8 byte length, `uint32` |
| 16 | Number of stored chunk records, `uint32` |
| 20 | JSON world metadata, length specified above |
| After metadata | Each chunk: dimension `uint8` (0 Overworld, 1 Nether, 2 End); `int32` x; `int32` z; `uint32` payload length; raw chunk payload bytes |
| Last 4 bytes | `uint32` CRC32 of all preceding bytes |

Limits: 256 MiB file, 2 MiB metadata, 25,000 chunks, 12,288 bytes per chunk (16 × 16 × 48 blocks). Imports reject chunks with
other payload sizes to prevent missing-block reads and silent block-loss.
The container is versioned separately from the terrain generator: older worlds
can be moved without regenerating or upgrading their terrain.

**Do not** treat the browser's Cache Storage/PWA files as world backups. World
saves live in IndexedDB until explicitly exported, and clearing all website
storage may remove them.
