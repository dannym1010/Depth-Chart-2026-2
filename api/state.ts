export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      hasData: false,
      version: 1,
      updatedAt: Date.now(),
      state: null,
    });
  }

  if (req.method === 'POST') {
    return res.status(200).json({
      success: true,
      version: 1,
      updatedAt: Date.now(),
      message: 'State endpoint acknowledged',
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
