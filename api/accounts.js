export const maxDuration = 30;

export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathResource = url.pathname.split('/').at(-1);
  const query = req.query ? { ...req.query } : {};
  if (!req.query) {
    for (const [key, value] of url.searchParams) {
      if (Object.hasOwn(query, key)) {
        query[key] = Array.isArray(query[key]) ? [...query[key], value] : [query[key], value];
      } else query[key] = value;
    }
  }
  // Public paths work locally; Vercel's explicit rewrites supply the resource.
  const resource = ['users', 'data'].includes(pathResource) ? pathResource : query.resource;
  delete query.resource;
  req.query = query;

  if (resource === 'users') {
    const { default: adminUsersHandler } = await import('../server/adminUsersHandler.js');
    return adminUsersHandler(req, res);
  }
  if (resource === 'data') {
    const { default: userDataHandler } = await import('../server/userDataHandler.js');
    return userDataHandler(req, res);
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ error: 'Account resource not found.' }));
}
