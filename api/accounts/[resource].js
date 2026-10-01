export const maxDuration = 30;

export default async function handler(req, res) {
  const resource = new URL(req.url || '/', 'http://localhost').pathname.split('/').at(-1);
  // Vercel adds the dynamic path parameter to req.query. It is not an API filter.
  if (req.query) {
    req.query = { ...req.query };
    delete req.query.resource;
  }

  if (resource === 'users') {
    const { default: adminUsersHandler } = await import('../../server/adminUsersHandler.js');
    return adminUsersHandler(req, res);
  }
  if (resource === 'data') {
    const { default: userDataHandler } = await import('../../server/userDataHandler.js');
    return userDataHandler(req, res);
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ error: 'Account resource not found.' }));
}
