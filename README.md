# Calendar Time Tracker

A Node.js script to sync Google Calendar events to the Watcher time tracker API, logging events as time entries for a specified project.

## Features
- Fetches events from your primary Google Calendar for a single day or date range.
- Logs only `accepted` or `tentative` events (or events you created) to avoid duplicates.
- Rounds event durations to 30-minute intervals (minimum 30 minutes, maximum 480 minutes).
- Supports `Asia/Almaty` timezone (UTC+05:00).
- Uses OAuth 2.0 for Google Calendar authentication and Watcher API for time tracking.

## Prerequisites
- **Node.js**: Version 16 or later (`node -v` to check).
- **Git**: To clone the repository (`git --version`).
- **Google Cloud Project**: For Google Calendar API credentials.
- **Watcher Account**: With access to `project_id: 1554`.

## Installation

### Step 1: Install Node.js
Node.js is required to run the script. Follow these steps to download and install it:

#### On macOS
1. **Using Homebrew** (recommended):
   - Install Homebrew if not present:
     ```bash
     /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
     ```
   - Install Node.js:
     ```bash
     brew install node
     ```
2. **Using the Official Installer**:
   - Visit [nodejs.org](https://nodejs.org/).
   - Download the **LTS** version (e.g., 16.x or later) for macOS.
   - Run the installer and follow the prompts.
3. **Verify Installation**:
   ```bash
   node -v  # Should output v16.x.x or higher
   npm -v   # Should output a version (e.g., 8.x.x)
   ```

#### On Windows
1. Visit [nodejs.org](https://nodejs.org/).
2. Download the **LTS** version for Windows.
3. Run the installer, accepting defaults.
4. Verify:
   ```bash
   node -v
   npm -v
   ```

#### On Linux (Ubuntu/Debian)
1. Update package manager:
   ```bash
   sudo apt update
   ```
2. Install Node.js:
   ```bash
   sudo apt install nodejs npm
   ```
3. Verify:
   ```bash
   node -v
   npm -v
   ```

**Note**: If the Node.js version is below 16, use [nvm](https://github.com/nvm-sh/nvm) to install a newer version:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 16
nvm use 16
```

### Step 2: Clone the Repository
```bash
git clone https://github.com/dsoulcatcher/calendar-time-tracker.git
cd calendar-time-tracker
```

### Step 3: Install Dependencies
The project requires several Node.js packages. Install them with:
```bash
npm install
```
This installs:
- `googleapis`: For Google Calendar API access.
- `axios`: For HTTP requests to Watcher API.
- `dotenv`: For environment variable management.
- `tough-cookie`: For handling cookies in Watcher authentication.
- `chalk`: For styled console output.
- `moment-timezone`: For timezone-aware date handling.

### Step 4: Set Up Google Cloud Credentials
- Go to [Google Cloud Console](https://console.cloud.google.com/).
- Create a new project (e.g., `calendar-time-tracker`).
- Enable the Google Calendar API:
  - Navigate to “APIs & Services” > “Library” > Search for “Google Calendar API” > Enable.
- Configure OAuth consent screen:
  - Go to “APIs & Services” > “OAuth consent screen” > Select “External” > Fill in app details.
  - Add scope: `https://www.googleapis.com/auth/calendar.readonly`.
  - Add your Google account as a test user (or publish for broader access).
- Create OAuth 2.0 credentials:
  - Go to “APIs & Services” > “Credentials” > “Create Credentials” > “OAuth client ID.”
  - Application type: “Desktop app.”
  - Note the `CLIENT_ID` and `CLIENT_SECRET`.

### Step 5: Configure Environment Variables
- Copy the sample `.env` file:
  ```bash
  cp .env.sample .env
  ```
- Edit `.env` with your credentials:
  ```plaintext
  CLIENT_ID=your_client_id_here
  CLIENT_SECRET=your_client_secret_here
  REFRESH_TOKEN=your_refresh_token_here
  WATCHER_EMAIL=your_watcher_email_here
  WATCHER_PASSWORD=your_watcher_password_here
  ```
- To get a `REFRESH_TOKEN`:
  - Run:
    ```bash
    node getRefreshToken.js
    ```
  - Visit the provided URL, sign in with your Google account, grant permission, copy the code, and paste it in the terminal.
  - Copy the `refresh_token` to your `.env` file.

## Usage
1. Run the script:
   ```bash
   node calendarToTimeTracker.js
   ```
2. Choose an option:
   - **1) day**: Log events for a single day (e.g., `2025-04-12`).
   - **2) period**: Log events for a date range (e.g., `2025-04-12` to `2025-04-13`).
3. Enter dates in `YYYY-MM-DD` format when prompted.
4. The script logs events to Watcher with `project_id: 1554`.

## Example Output
```plaintext
Do you want to log for a specific day or a period? Choose from:
1) day
2) period
2
Enter the start date (YYYY-MM-DD): 2025-04-12
Enter the end date (YYYY-MM-DD): 2025-04-13

Processing events for 2025-04-12...
No events found for 2025-04-12

Processing events for 2025-04-13...
Successfully logged: [Zaman] Daily Platform (60 minutes on 2025-04-13)
```

## Notes
- **Event Filtering**: Only logs events you’ve accepted, marked as tentative, or created.
- **Rounding**: Events <15 minutes are logged as 30 minutes; durations round to 30-minute steps (down if ≤9 minutes above).
- **Timezone**: Fixed to `Asia/Almaty` (UTC+05:00).
- **Duplicates**: Warns about potential duplicates within a run. Check Watcher for duplicates from multiple runs.
- **Security**: Keep `.env` private and do not commit it to Git.

## Troubleshooting
- **Node.js Issues**: Ensure Node.js is installed (`node -v`). Reinstall if needed.
- **Dependency Errors**: Run `npm install` again or check `package.json`.
- **Google Calendar Errors**: Ensure `REFRESH_TOKEN` is valid. Regenerate using `getRefreshToken.js`.
- **Watcher Errors**: Verify `WATCHER_EMAIL` and `WATCHER_PASSWORD`.
- **Date Mismatch**: Check system timezone (`date` in terminal) or contact the maintainer.
- **Issues**: Open a GitHub issue or contact the maintainer.

## Contributing
- Fork the repository and submit pull requests for improvements.
- Report bugs or suggest features via GitHub Issues.

## License
MIT License (see `LICENSE` file, if included).

## Maintainer
Aibek Raushanov (https://github.com/dsoulcatcher).
