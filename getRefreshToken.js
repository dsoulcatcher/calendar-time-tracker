require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.resolve(__dirname, '.env');

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar.readonly']
});

console.log('Authorize this app by visiting this URL:', url);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter the code from that page here: ', (code) => {
  rl.close();
  oauth2Client.getToken(code, (err, tokens) => {
    if (err) {
      console.error('Error retrieving tokens:', err);
      return;
    }

    const refreshToken = tokens.refresh_token;
    console.log('Refresh token:', refreshToken);

    // Read and update the .env file
    let envContent = '';
    try {
      envContent = fs.readFileSync(ENV_PATH, 'utf8');
    } catch (readErr) {
      console.error('Failed to read .env file:', readErr);
      return;
    }

    const updatedContent = envContent.includes('REFRESH_TOKEN=')
      ? envContent.replace(/REFRESH_TOKEN=.*/g, `REFRESH_TOKEN=${refreshToken}`)
      : `${envContent.trim()}\nREFRESH_TOKEN=${refreshToken}\n`;

    try {
      fs.writeFileSync(ENV_PATH, updatedContent, 'utf8');
      console.log('.env file updated with new REFRESH_TOKEN');
    } catch (writeErr) {
      console.error('Failed to write to .env file:', writeErr);
    }
  });
});
