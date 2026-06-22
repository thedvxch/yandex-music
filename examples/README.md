# Examples

Runnable usage examples for `@dvxch/yandex-music`. They import from the source
(`../src/index.js`) so they can be run straight from the repo; in your own
project import from the package name instead:

```ts
import { Client } from '@dvxch/yandex-music';
```

Most examples need an OAuth token in `YM_TOKEN`. The exception is the device-auth
flow, which obtains one for you.

```bash
YM_TOKEN=... npx tsx examples/01-quickstart.ts
YM_TOKEN=... npx tsx examples/02-search.ts "daft punk"
npx tsx examples/03-device-auth.ts
YM_TOKEN=... npx tsx examples/04-realtime.ts          # needs: npm install ws
YM_TOKEN=... npx tsx examples/05-likes-library.ts
YM_TOKEN=... npx tsx examples/06-playlists.ts
YM_TOKEN=... npx tsx examples/07-radio.ts
YM_TOKEN=... npx tsx examples/08-charts-and-new.ts
YM_TOKEN=... npx tsx examples/09-lyrics.ts            # optional: trackId arg
YM_TOKEN=... npx tsx examples/10-download-quality.ts  # optional: trackId arg
YM_TOKEN=... npx tsx examples/11-artist.ts            # optional: artistId arg
YM_TOKEN=... npx tsx examples/12-custom-fetch.ts      # needs: npm install node-wreq
```

| File | Shows |
| ---- | ----- |
| `01-quickstart.ts`        | token init, fetch a track, download it, read lyrics |
| `02-search.ts`            | catalog search, typed result blocks, suggest/typo-fix |
| `03-device-auth.ts`       | device-code login (no password handling) |
| `04-realtime.ts`          | realtime "now playing" events over Ynison |
| `05-likes-library.ts`     | browse the library, like/unlike round-trip |
| `06-playlists.ts`         | full playlist lifecycle (create → edit → delete) |
| `07-radio.ts`             | "My Wave" stations, track batches, feedback |
| `08-charts-and-new.ts`    | chart, new releases, genres |
| `09-lyrics.ts`            | time-synced (LRC) lyrics |
| `10-download-quality.ts`  | quality/codec selection incl. lossless (FLAC) |
| `11-artist.ts`            | artist brief info, tracks, discography, similar |
| `12-custom-fetch.ts`      | inject a custom `fetch` (node-wreq browser TLS impersonation) |

All examples are run against the live API as part of release verification.
