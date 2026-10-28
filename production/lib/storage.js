import { put, get, list, del } from '@vercel/blob';
export const storage = {
  async create(path, data) {
    try {
      await put(path, JSON.stringify(data), { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json', abortSignal: AbortSignal.timeout(10000) });
      return true;
    } catch (error) {
      // Confirm an existing object after a conflict or an uncertain write outcome.
      // A timeout or provider error alone is never treated as acceptance.
      if (await storage.read(path)) return false;
      throw error;
    }
  },
  async read(path) {
    const result = await get(path, { access: 'private', useCache: false, abortSignal: AbortSignal.timeout(10000) });
    return result?.statusCode === 200 ? JSON.parse(await new Response(result.stream).text()) : null;
  },
  list: options => list(options),
  remove: paths => del(paths)
};
