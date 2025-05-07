# Telegram Todo Bot with Google Sheets

A Telegram bot that helps you manage your tasks with Google Sheets as the backend storage.

## Features

- View your list of todos
- Add new todos
- Mark todos as complete/incomplete
- Delete todos
- Data persisted in Google Sheets

## Setup

### Prerequisites

- Node.js and npm installed
- A Telegram bot token (from [BotFather](https://t.me/botfather))
- A Google Cloud Platform account

### Google Sheets API Setup

1. Create a new Google Cloud Platform project
2. Enable the Google Sheets API
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Sheets API" and enable it
3. Create Service Account credentials
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Fill in the service account details and click "Create"
   - Grant the service account the "Editor" role
   - Create a new JSON key for the service account
   - Download the JSON key file and save it in your project directory
4. Create a new Google Spreadsheet
   - Create a new spreadsheet in Google Sheets
   - Share the spreadsheet with the email address of your service account (with Editor permission)
   - Copy the spreadsheet ID from the URL (the long string between /d/ and /edit in the URL)

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Bot Token from BotFather
BOT_TOKEN=your_telegram_bot_token

# Google Sheets Integration
GOOGLE_APPLICATION_CREDENTIALS=./path/to/credentials.json
SPREADSHEET_ID=your_google_spreadsheet_id
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up your environment variables as described above
4. Start the bot:
   ```
   npm start
   ```

## Usage

1. Start a chat with your bot on Telegram
2. Send the `/start` command
3. Use the buttons to manage your todo list

## License

MIT
