require('dotenv').config();
const { google } = require('googleapis');
const axios = require('axios');
const readline = require('readline');
const tough = require('tough-cookie');
const chalk = require('chalk').default || require('chalk');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');


// Configuration
const TIME_TRACKER_API = 'https://watcher.redmadrobot.com/api/v2/logged-time/';
const LOGIN_API = 'https://watcher.redmadrobot.com/api/v2/auth/login';
const PROJECT_ID = 1554;
const TIME_ZONE = 'Asia/Almaty';
const ENV_PATH = path.resolve(__dirname, '.env');

// Initialize Google Calendar API
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);
oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// Initialize readline for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Cookie jar to handle set-cookie
const cookieJar = new tough.CookieJar();

// Store access token in memory
let accessToken = '';

// Function to get access token from login API
async function getAccessToken() {
  try {
    const response = await axios.post(
      LOGIN_API,
      {
        email: process.env.WATCHER_EMAIL,
        password: process.env.WATCHER_PASSWORD
      },
      {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true
      }
    );

    const setCookie = response.headers['set-cookie'];
    if (!setCookie) throw new Error('No set-cookie header found in login response');

    const cookie = tough.Cookie.parse(setCookie.find(c => c.includes('access_token')));
    if (!cookie || !cookie.value) throw new Error('No access_token found in set-cookie');

    await cookieJar.setCookie(cookie, TIME_TRACKER_API);
    accessToken = cookie.value;
    console.log(chalk.yellow('\nSuccessfully fetched new access token\n'));
    return accessToken;
  } catch (error) {
    console.error(chalk.red('Error fetching access token:'), error.response?.data || error.message);
    throw error;
  }
}

// Round minutes to nearest 30-minute interval
function roundMinutes(duration) {
  const step = 30;
  const max = 480;
  const min = 30;
  if (duration < 15) return min;
  const remainder = duration % step;
  let rounded = remainder <= 9 ? Math.floor(duration / step) * step : Math.ceil(duration / step) * step;
  return Math.max(min, Math.min(rounded, max));
}

// Format date to YYYY-MM-DD
function formatDate(date) {
  return moment(date).tz(TIME_ZONE).format('YYYY-MM-DD');
}

// Validate date format (YYYY-MM-DD)
function isValidDate(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = moment(dateStr, 'YYYY-MM-DD', true);
  return date.isValid();
}

// Function to check if the refresh token is valid
async function isRefreshTokenValid() {
  if (!process.env.REFRESH_TOKEN || process.env.REFRESH_TOKEN.trim() === '') {
    return false;
  }
  try {
    // Try a simple API call
    await calendar.events.list({
      calendarId: 'primary',
      maxResults: 1
    });
    return true;
  } catch (err) {
    if (
      err.code === 401 ||
      err.code === 400 ||
      (err.errors && err.errors.some(e => e.reason === 'invalidGrant')) ||
      (err.response && err.response.data && err.response.data.error === 'invalid_grant')
    ) {
      return false;
    }
    // For other errors, assume valid (fail open)
    return true;
  }
}

// Function to run OAuth flow and update .env
async function updateRefreshTokenFlow() {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly']
  });
  console.log(chalk.yellow('\nAuthorize this app by visiting this URL:'), url);

  return new Promise((resolve) => {
    rl.question('Enter the code from that page here: ', (code) => {
      oauth2Client.getToken(code, (err, tokens) => {
        if (err) {
          console.error(chalk.red('Error retrieving tokens:'), err);
          process.exit(1);
        }
        const refreshToken = tokens.refresh_token;
        if (!refreshToken) {
          console.error(chalk.red('No refresh token received. Make sure to remove any previous consent for this app in your Google Account and try again.'));
          process.exit(1);
        }
        // Read and update the .env file
        let envContent = '';
        try {
          envContent = fs.readFileSync(ENV_PATH, 'utf8');
        } catch (readErr) {
          console.error(chalk.red('Failed to read .env file:'), readErr);
          process.exit(1);
        }
        const updatedContent = envContent.includes('REFRESH_TOKEN=')
          ? envContent.replace(/REFRESH_TOKEN=.*/g, `REFRESH_TOKEN=${refreshToken}`)
          : `${envContent.trim()}\nREFRESH_TOKEN=${refreshToken}\n`;
        try {
          fs.writeFileSync(ENV_PATH, updatedContent, 'utf8');
          console.log(chalk.green('.env file updated with new REFRESH_TOKEN'));
        } catch (writeErr) {
          console.error(chalk.red('Failed to write to .env file:'), writeErr);
          process.exit(1);
        }
        // Reload .env and re-initialize oauth2Client
        require('dotenv').config();
        oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
        resolve();
      });
    });
  });
}

// Log time to the time tracker
async function logTimeEntry(event) {
  const { start, end, summary } = event;
  const startDate = new Date(start.dateTime);
  const endDate = new Date(end.dateTime);
  const duration = (endDate - startDate) / (1000 * 60); // Convert ms to minutes
  const minutesSpent = roundMinutes(duration);
  const date = formatDate(startDate);
  const description = summary || 'Untitled Event';

  const payload = {
    project_id: PROJECT_ID,
    minutes_spent: minutesSpent,
    date,
    description
  };

  if (!accessToken) await getAccessToken();

  try {
    await axios.post(TIME_TRACKER_API, payload, {
      headers: {
        Cookie: `G_ENABLED_IDPS=google; access_token=${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(chalk.green(`Successfully logged: ${description} (${minutesSpent} minutes on ${date})`));
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log(chalk.yellow('Access token invalid, fetching new token...'));
      await getAccessToken();
      return logTimeEntry(event); // Retry
    }
    console.error(chalk.red(`Error logging ${description}:`), error.response?.data || error.message);
  }
}

// Process events for a single day
async function processDay(targetDate) {
  try {
    const startOfDay = moment.tz(targetDate, TIME_ZONE).startOf('day').toISOString();
    const endOfDay = moment.tz(targetDate, TIME_ZONE).endOf('day').toISOString();

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay,
      timeMax: endOfDay,
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: TIME_ZONE
    });

    const events = response.data.items || [];
    if (!events.length) {
      console.log(chalk.blue(`No events found for ${targetDate}`));
      return;
    }

    const processedEntries = new Set();
    for (const event of events) {
      if (!event.start?.dateTime || !event.end?.dateTime) {
        console.log(chalk.gray(`Skipping all-day event: ${event.summary || 'Untitled'}`));
        continue;
      }

      const isCreator = event.creator?.self;
      const attendee = event.attendees?.find(a => a.self);
      if (!isCreator && (!attendee || (attendee.responseStatus !== 'accepted' && attendee.responseStatus !== 'tentative'))) {
        console.log(chalk.gray(`Skipping event not accepted/tentative: ${event.summary || 'Untitled'}`));
        continue;
      }

      const eventDate = formatDate(new Date(event.start.dateTime));
      const key = `${eventDate}:${event.summary}:${PROJECT_ID}`;
      if (processedEntries.has(key)) {
        console.warn(chalk.yellow(`Potential duplicate detected: ${event.summary} on ${eventDate}`));
        continue;
      }
      processedEntries.add(key);
      await logTimeEntry(event);
    }
  } catch (error) {
    console.error(chalk.red(`Error processing events for ${targetDate}:`), error.message);
  }
}

// Process events for a date range
async function syncCalendarToTimeTracker(startDate, endDate) {
  try {
    const start = moment(startDate, 'YYYY-MM-DD');
    const end = moment(endDate, 'YYYY-MM-DD');
    if (!start.isValid() || !end.isValid() || start > end) {
      console.error(chalk.red('Invalid dates or start date must be before or equal to end date.'));
      return;
    }

    let currentDate = start.clone();
    while (currentDate <= end) {
      const dateStr = currentDate.format('YYYY-MM-DD');
      console.log(chalk.cyan(`\nProcessing events for ${dateStr}...`));
      await processDay(dateStr);
      currentDate.add(1, 'day');
    }
  } catch (error) {
    console.error(chalk.red('Error processing date range:'), error.message);
  } finally {
    rl.close();
  }
}

// At the start, check refresh token validity
(async () => {
  const valid = await isRefreshTokenValid();
  if (!valid) {
    console.log(chalk.red('\nYour Google refresh token is invalid or expired.'));
    await new Promise((resolve) => {
      rl.question(chalk.yellow('Do you want to update the refresh token now? (y/n): '), async (answer) => {
        if (answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes') {
          await updateRefreshTokenFlow();
          resolve();
        } else {
          console.log(chalk.red('Exiting. You must have a valid refresh token to continue.'));
          rl.close();
          process.exit(0);
        }
      });
    });
  }
  // Continue with the rest of the script
  rl.question(chalk.bold('Do you want to log for a specific day or a period? Choose from:\n1) day\n2) period\n'), (mode) => {
    if (mode.toLowerCase() === '1') {
      rl.question(chalk.bold('Enter the date to process (YYYY-MM-DD): '), (dateInput) => {
        if (!isValidDate(dateInput)) {
          console.error(chalk.red('Invalid date format. Please use YYYY-MM-DD (e.g., 2025-05-30).'));
          rl.close();
          return;
        }
        syncCalendarToTimeTracker(dateInput, dateInput);
      });
    } else if (mode.toLowerCase() === '2') {
      rl.question(chalk.bold('Enter the start date (YYYY-MM-DD): '), (startDate) => {
        if (!isValidDate(startDate)) {
          console.error(chalk.red('Invalid start date format. Please use YYYY-MM-DD (e.g., 2025-05-30).'));
          rl.close();
          return;
        }
        rl.question(chalk.bold('Enter the end date (YYYY-MM-DD): '), (endDate) => {
          if (!isValidDate(endDate)) {
            console.error(chalk.red('Invalid end date format. Please use YYYY-MM-DD (e.g., 2025-05-30).'));
            rl.close();
            return;
          }
          syncCalendarToTimeTracker(startDate, endDate);
        });
      });
    } else {
      console.error(chalk.red('Invalid option. Please enter "1" for day or "2" for period.'));
      rl.close();
    }
  });
})();