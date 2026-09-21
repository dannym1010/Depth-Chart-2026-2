export default async function handler(req: any, res: any) {
  // Enable CORS headers for client requests
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let url = req.method === 'POST' ? req.body?.url : req.query?.url;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing calendar feed URL.' });
    }

    url = url.trim().replace(/^["']|["']$/g, '');
    let targetUrl = url;
    if (targetUrl.startsWith('webcal://')) {
      targetUrl = 'https://' + targetUrl.substring(9);
    } else if (targetUrl.startsWith('http://')) {
      targetUrl = 'https://' + targetUrl.substring(7);
    }

    const urlsToTry = [
      targetUrl,
      targetUrl.startsWith('https://') ? 'http://' + targetUrl.substring(8) : 'https://' + targetUrl.substring(7),
    ];

    let icsContent = '';
    let lastError: any = null;

    for (const tryUrl of urlsToTry) {
      try {
        const response = await fetch(tryUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/calendar, text/plain, */*',
          },
          redirect: 'follow',
        });

        if (response.ok) {
          const text = await response.text();
          if (text && text.includes('BEGIN:VCALENDAR')) {
            icsContent = text;
            break;
          }
        } else {
          lastError = new Error(`HTTP ${response.status} from ${tryUrl}`);
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!icsContent || !icsContent.includes('BEGIN:VCALENDAR')) {
      return res.status(400).json({
        error: `Could not retrieve a valid iCal feed. ${lastError ? lastError.message : 'Please check URL.'}`,
      });
    }

    return res.status(200).json({ success: true, icsContent });
  } catch (err: any) {
    console.error('Error fetching calendar:', err);
    return res.status(500).json({ error: err?.message || 'Failed to fetch calendar feed.' });
  }
}
