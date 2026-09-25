import type { Express } from 'express';

export function registerTeamSnapRoutes(app: Express) {
  // TeamSnap iCal proxy fetch to avoid CORS blocks
  app.all(['/api/teamsnap/fetch-ical'], async (req, res) => {
    try {
      let url = req.method === 'POST' ? req.body?.url : req.query?.url;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing calendar feed URL.' });
      }

      // Clean & normalize URL
      url = url.trim().replace(/^["']|["']$/g, '');
      
      let targetUrl = url;
      if (targetUrl.startsWith('webcal://')) {
        targetUrl = 'https://' + targetUrl.substring(9);
      }

      // Candidate URLs to try (in order of preference)
      const baseUrls: string[] = [];
      if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
        baseUrls.push(targetUrl);
        if (targetUrl.startsWith('https://')) {
          baseUrls.push('http://' + targetUrl.substring(8));
        } else if (targetUrl.startsWith('http://')) {
          baseUrls.push('https://' + targetUrl.substring(7));
        }
      } else {
        baseUrls.push('https://' + targetUrl);
        baseUrls.push('http://' + targetUrl);
      }

      // Add cache-busting timestamp query parameter to bypass Cloudflare CDN 4-hour edge cache
      const appendCacheBuster = (u: string) => {
        const sep = u.includes('?') ? '&' : '?';
        return `${u}${sep}_t=${Date.now()}`;
      };

      const urlsToTry = baseUrls.map(appendCacheBuster);

      let icsContent = '';
      let lastError: any = null;

      for (const tryUrl of urlsToTry) {
        try {
          const response = await fetch(tryUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'text/calendar, text/plain, */*',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache',
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

      return res.json({ success: true, icsContent, fetchedAt: Date.now() });
    } catch (err: any) {
      console.error('Error fetching TeamSnap calendar:', err);
      return res.status(500).json({ error: err?.message || 'Server failed to retrieve calendar feed.' });
    }
  });
}
