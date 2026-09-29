// Vercel Serverless Function: Get Client Public IP and Local Network Room Hash
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rawIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim();
  const cleanIp = rawIp.replace('::ffff:', '');

  let hash = 0;
  for (let i = 0; i < cleanIp.length; i++) {
    hash = (hash << 5) - hash + cleanIp.charCodeAt(i);
    hash |= 0;
  }
  const roomHash = 'room-' + Math.abs(hash).toString(36).slice(0, 8);

  return res.status(200).json({
    success: true,
    ip: cleanIp,
    roomHash
  });
}
