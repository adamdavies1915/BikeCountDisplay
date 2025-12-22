const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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
    const yesterday = getYesterday();
    const currentYear = new Date().getFullYear();
    const flowIdsEncoded = COUNTER.flowIds.replace(/;/g, '%3B');

    // Fetch all data
    const url = `${API_BASE}/data/${COUNTER.idPdc}?idOrganisme=${COUNTER.idOrganisme}&idPdc=${COUNTER.idPdc}&interval=4&flowIds=${flowIdsEncoded}`;

    const data = await fetchEcoVisio(url);

    // Data format is [["MM/DD/YYYY", "count"], ...]
    const yesterdayStr = formatDate(yesterday);

    let yesterdayCount = 0;
    let yearToDateCount = 0;

    if (data && Array.isArray(data)) {
      for (const entry of data) {
        if (Array.isArray(entry) && entry.length >= 2) {
          const [date, count] = entry;
          const countNum = parseInt(count) || 0;

          // Check if this is yesterday
          if (date === yesterdayStr) {
            yesterdayCount = countNum;
          }

          // Check if this date is in the current year
          const year = parseInt(date.split('/')[2]);
          if (year === currentYear) {
            yearToDateCount += countNum;
          }
        }
      }
    }

    res.json({
      yesterday: yesterdayCount,
      yearToDate: yearToDateCount,
      yesterdayDate: yesterdayStr,
      year: currentYear,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching counts:', error);
    res.status(500).json({ error: 'Failed to fetch bike counts' });
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Bike count display running on port ${PORT}`);
});
