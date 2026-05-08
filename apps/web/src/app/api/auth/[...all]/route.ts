// Catch-all better-auth route. Forwards every method (GET / POST / OPTIONS)
// at /api/auth/* into the better-auth handler.

import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);
