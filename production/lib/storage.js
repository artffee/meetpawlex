import * as blob from '@vercel/blob';

export function makeStorage(sdk, namespace) {
  const prefix = `${namespace}/`;
  const scoped = {
    async create(path, data) {
      try {
        await sdk.put(prefix + path, JSON.stringify(data), { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json', abortSignal: AbortSignal.timeout(10000) });
        return true;
      } catch (error) {
        // Confirm an existing object after a conflict or an uncertain write outcome.
        // A timeout or provider error alone is never treated as acceptance.
        if (await scoped.read(path)) return false;
        throw error;
      }
    },
    async read(path) {
      const result = await sdk.get(prefix + path, { access: 'private', useCache: false, abortSignal: AbortSignal.timeout(10000) });
      return result?.statusCode === 200 ? JSON.parse(await new Response(result.stream).text()) : null;
    },
    async list(options = {}) {
      const result = await sdk.list({ ...options, prefix: prefix + (options.prefix || '') });
      return { ...result, blobs: result.blobs.map(item => ({ ...item, pathname: item.pathname.slice(prefix.length) })) };
    },
    remove: urls => sdk.del(urls)
  };
  return scoped;
}
// Preview tests cannot consume production request limits or modify its applications.
export const storage = makeStorage(blob, process.env.VERCEL_ENV === 'production' ? 'production' : 'preview');
