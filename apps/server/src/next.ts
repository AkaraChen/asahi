import { handle } from 'hono/vercel';

import { diffApi } from './diff';

export const GET = handle(diffApi);
