const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3333;

// Lafitte Greenway counter config
const COUNTER = {
  idPdc: '300036768',
  flowIds: '353403894;353403895',
  idOrganisme: '250'
};

const API_BASE = 'https://www.eco-visio.net/api/aladdin/1.0.0/pbl/publicwebpageplus';

// Helper to fetch from eco-visio API
function fetchEcoVisio(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse API response'));
        }
      });
    }).on('error', reject);
  });
}

// Format date as MM/DD/YYYY for API
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

// Get yesterday's date
function getYesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date;
}

// API endpoint to get bike counts
app.get('/api/counts', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const flowIdsEncoded = COUNTER.flowIds.replace(/;/g, '%3B');

    // Fetch all data
    const url = `${API_BASE}/data/${COUNTER.idPdc}?idOrganisme=${COUNTER.idOrganisme}&idPdc=${COUNTER.idPdc}&interval=4&flowIds=${flowIdsEncoded}`;

    const data = await fetchEcoVisio(url);

    // Data format is [["MM/DD/YYYY", "count"], ...]
    let yesterdayCount = 0;
    let yesterdayDate = '';
    let yearToDateCount = 0;

    if (data && Array.isArray(data) && data.length >= 2) {
      // Last entry is today (incomplete), second-to-last is the most recent complete day
      const lastCompleteDay = data[data.length - 2];
      if (Array.isArray(lastCompleteDay) && lastCompleteDay.length >= 2) {
        yesterdayDate = lastCompleteDay[0];
        yesterdayCount = parseInt(lastCompleteDay[1]) || 0;
      }

      // Sum up year to date (exclude today's incomplete data)
      for (let i = 0; i < data.length - 1; i++) {
        const entry = data[i];
        if (Array.isArray(entry) && entry.length >= 2) {
          const [date, count] = entry;
          const year = parseInt(date.split('/')[2]);
          if (year === currentYear) {
            yearToDateCount += parseInt(count) || 0;
          }
        }
      }
    }

    res.json({
      yesterday: yesterdayCount,
      yearToDate: yearToDateCount,
      yesterdayDate: yesterdayDate,
      year: currentYear,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching counts:', error);
    res.status(500).json({ error: 'Failed to fetch bike counts' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Bike count display running on port ${PORT}`);
});
