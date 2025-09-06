require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

async function getNewRefreshToken(rlExternal) {
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

  console.log('\n==============================');
  console.log('Google OAuth Refresh Token Flow');
  console.log('==============================');
  console.log('\n1. Open the following URL in your browser:');
  console.log(url);
  console.log('\n2. Authorize the app and copy the code you receive.');

  return new Promise((resolve, reject) => {
    const rl = rlExternal || readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('\n3. Paste the code here: ', (code) => {
      if (!rlExternal) rl.close();
      oauth2Client.getToken(code, (err, tokens) => {
        if (err) {
          console.error('\nError retrieving tokens:', err);
          return reject(err);
        }
        const refreshToken = tokens.refresh_token;
        console.log('\n==============================');
        console.log('Your new Google Refresh Token:');
        console.log('==============================');
        console.log(refreshToken);
        // Read and update the .env file
        let envContent = '';
        try {
          envContent = fs.readFileSync(ENV_PATH, 'utf8');
        } catch (readErr) {
          console.error('Failed to read .env file:', readErr);
          return reject(readErr);
        }
        const updatedContent = envContent.includes('REFRESH_TOKEN=')
          ? envContent.replace(/REFRESH_TOKEN=.*/g, `REFRESH_TOKEN=${refreshToken}`)
          : `${envContent.trim()}\nREFRESH_TOKEN=${refreshToken}\n`;
        try {
          fs.writeFileSync(ENV_PATH, updatedContent, 'utf8');
          console.log('\n.env file updated with new REFRESH_TOKEN\n');
        } catch (writeErr) {
          console.error('Failed to write to .env file:', writeErr);
          return reject(writeErr);
        }
        resolve(refreshToken);
      });
    });
  });
}

module.exports = { getNewRefreshToken };

// CLI usage
if (require.main === module) {
  getNewRefreshToken().catch(() => process.exit(1));
}
