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
YM_TOKEN=... npx tsx examples/04-realtime.ts   # needs: npm install ws
```

| File | Shows |
| ---- | ----- |
| `01-quickstart.ts`  | token init, fetch a track, download it, read lyrics |
| `02-search.ts`      | catalog search, typed result blocks, suggest/typo-fix |
| `03-device-auth.ts` | device-code login (no password handling) |
| `04-realtime.ts`    | realtime "now playing" events over Ynison |
