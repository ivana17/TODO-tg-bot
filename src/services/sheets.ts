import { google, sheets_v4 } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

// Todo interface
export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  userId: number;
}

// Initialize the sheets API
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = process.env.SPREADSHEET_ID || '';

// Sheet columns (in order)
const COLUMNS = {
  ID: 0,
  TEXT: 1,
  COMPLETED: 2,
  USER_ID: 3,
};

/**
 * Initialize the spreadsheet with headers if needed
 */
export async function initializeSheet(): Promise<void> {
  try {
    console.log('Initializing Google Sheets with:');
    console.log(`- Spreadsheet ID: ${spreadsheetId}`);
    console.log(
      `- Credentials file: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`
    );
    console.log(
      `- Service account: ${process.env.SERVICE_ACCOUNT_EMAIL || 'Unknown'}`
    );

    // First, try to access the spreadsheet metadata to verify permissions
    try {
      console.log('Attempting to access spreadsheet metadata...');
      const spreadsheetInfo = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      console.log(
        `Successfully connected to spreadsheet: "${
          spreadsheetInfo.data.properties?.title || 'Unknown'
        }"`
      );
      console.log('Sheets in this spreadsheet:');
      if (spreadsheetInfo.data.sheets) {
        spreadsheetInfo.data.sheets.forEach(sheet => {
          console.log(`- ${sheet.properties?.title || 'Unnamed sheet'}`);
        });
      }

      // Now check for the Todos sheet
      const todosSheet = spreadsheetInfo.data.sheets?.find(
        sheet => sheet.properties?.title === 'Todos'
      );

      if (!todosSheet) {
        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

        console.error('');
        console.error(
          '================================================================'
        );
        console.error('SHEET SETUP REQUIRED: "Todos" sheet is missing');
        console.error(
          '================================================================'
        );
        console.error('');
        console.error('Please create a sheet named "Todos" manually:');
        console.error('');
        console.error(`1. Open your spreadsheet: ${spreadsheetUrl}`);
        console.error('2. Click the + button at the bottom to add a new sheet');
        console.error(
          '3. Right-click on the new sheet tab, select "Rename..."'
        );
        console.error('4. Name it exactly "Todos" (case sensitive)');
        console.error('5. Restart this application after creating the sheet');
        console.error('');
        console.error(
          '================================================================'
        );

        throw new Error(
          `Sheet "Todos" not found in spreadsheet. Please open ${spreadsheetUrl} and create it manually.`
        );
      }

      console.log('Found "Todos" sheet');

      // Check if headers need to be added
      console.log('Checking for headers in Todos sheet...');
      try {
        const headerResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'Todos!A1:D1',
        });

        if (
          !headerResponse.data.values ||
          headerResponse.data.values.length === 0
        ) {
          console.log('No headers found, adding them...');
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Todos!A1:D1',
            valueInputOption: 'RAW',
            requestBody: {
              values: [['ID', 'Text', 'Completed', 'UserID']],
            },
          });
          console.log('Sheet initialized with headers');
        } else {
          console.log(
            `Headers exist: ${JSON.stringify(headerResponse.data.values[0])}`
          );
        }
      } catch (headerError: any) {
        console.error('Error accessing headers:', headerError);
        if (headerError.status === 403) {
          const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
          const serviceAccountEmail =
            process.env.SERVICE_ACCOUNT_EMAIL || 'your service account email';

          console.error('');
          console.error(
            '================================================================'
          );
          console.error('PERMISSION DENIED ACCESSING SHEET CONTENT');
          console.error(
            '================================================================'
          );
          console.error('');
          console.error(
            'Your service account does not have permission to read/write sheet data.'
          );
          console.error('');
          console.error(
            'Please share the spreadsheet with your service account and ensure it has EDITOR permission:'
          );
          console.error(`1. Open: ${spreadsheetUrl}`);
          console.error('2. Click "Share" in the top-right corner');
          console.error(`3. Add: ${serviceAccountEmail}`);
          console.error('4. Give it "Editor" permission (not just "Viewer")');
          console.error('5. Click "Share" and restart this application');
          console.error('');
          console.error(
            '================================================================'
          );

          throw new Error(
            `Permission denied accessing sheet content. Please ensure ${serviceAccountEmail} has Editor permission.`
          );
        } else {
          throw headerError;
        }
      }
    } catch (error: any) {
      // Log error details for debugging
      if (error.status === 404) {
        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

        console.error('');
        console.error(
          '================================================================'
        );
        console.error('SPREADSHEET NOT FOUND');
        console.error(
          '================================================================'
        );
        console.error('');
        console.error(`Spreadsheet ID: ${spreadsheetId}`);
        console.error(`Try opening this URL: ${spreadsheetUrl}`);
        console.error('');
        console.error(
          "If the spreadsheet doesn't exist, please create it or update your .env file"
        );
        console.error('with the correct SPREADSHEET_ID.');
        console.error('');
        console.error(
          '================================================================'
        );

        throw new Error(
          `Spreadsheet not found. Please check if ${spreadsheetUrl} exists.`
        );
      } else if (error.status === 403) {
        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
        const serviceAccountEmail =
          process.env.SERVICE_ACCOUNT_EMAIL || 'your service account email';

        console.error('');
        console.error(
          '================================================================'
        );
        console.error('PERMISSION DENIED');
        console.error(
          '================================================================'
        );
        console.error('');
        console.error(
          'Your service account does not have permission to access the spreadsheet.'
        );
        console.error('');
        console.error(
          'Please share the spreadsheet with your service account:'
        );
        console.error(`1. Open: ${spreadsheetUrl}`);
        console.error('2. Click "Share" in the top-right corner');
        console.error(`3. Add: ${serviceAccountEmail}`);
        console.error('4. Give it "Editor" permission');
        console.error('5. Click "Share" and restart this application');
        console.error('');
        console.error(
          '================================================================'
        );

        throw new Error(
          `Permission denied. Please share the spreadsheet with ${serviceAccountEmail}.`
        );
      } else {
        // Log any other error
        console.error('Google Sheets API Error:', error);
        throw error;
      }
    }
  } catch (error) {
    // We'll just re-throw the error without adding another layer of error details
    throw error;
  }
}

/**
 * Get the next ID for a new todo
 */
export async function getNextId(): Promise<number> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Todos!A2:A',
    });

    if (!response.data.values || response.data.values.length === 0) {
      return 1;
    }

    // Find the maximum ID and add 1
    const ids = response.data.values
      .map(row => parseInt(row[0], 10))
      .filter(id => !isNaN(id));
    return ids.length > 0 ? Math.max(...ids) + 1 : 1;
  } catch (error: any) {
    console.error('Error getting next ID:', error);
    console.error(
      'Error details:',
      error.errors
        ? JSON.stringify(error.errors, null, 2)
        : 'No detailed errors'
    );
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to get next ID: ${error.message}`);
  }
}

/**
 * Get all todos for a specific user
 */
export async function getUserTodos(userId: number): Promise<Todo[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Todos!A2:D',
    });

    if (!response.data.values) {
      return [];
    }

    return response.data.values
      .filter(
        row =>
          row[COLUMNS.USER_ID] && parseInt(row[COLUMNS.USER_ID], 10) === userId
      )
      .map(row => ({
        id: parseInt(row[COLUMNS.ID], 10),
        text: row[COLUMNS.TEXT],
        completed: row[COLUMNS.COMPLETED] === 'true',
        userId: parseInt(row[COLUMNS.USER_ID], 10),
      }));
  } catch (error: any) {
    console.error(`Error getting todos for user ${userId}:`, error);
    console.error(
      'Error details:',
      error.errors
        ? JSON.stringify(error.errors, null, 2)
        : 'No detailed errors'
    );
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to get todos for user ${userId}: ${error.message}`);
  }
}

/**
 * Add a new todo
 */
export async function addTodo(todo: Todo): Promise<void> {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Todos!A2',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [
            todo.id.toString(),
            todo.text,
            todo.completed.toString(),
            todo.userId.toString(),
          ],
        ],
      },
    });
  } catch (error: any) {
    console.error(`Error adding todo for user ${todo.userId}:`, error);
    console.error('Todo data attempted to add:', JSON.stringify(todo, null, 2));
    console.error(
      'Error details:',
      error.errors
        ? JSON.stringify(error.errors, null, 2)
        : 'No detailed errors'
    );
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to add todo: ${error.message}`);
  }
}

/**
 * Update a todo's completion status
 */
export async function updateTodoStatus(
  todoId: number,
  userId: number,
  completed: boolean
): Promise<boolean> {
  try {
    // Get all todos
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Todos!A2:D',
    });

    if (!response.data.values) {
      return false;
    }

    // Find the row index of the todo
    let rowIndex = -1;
    for (let i = 0; i < response.data.values.length; i++) {
      const row = response.data.values[i];
      if (
        row[COLUMNS.ID] &&
        parseInt(row[COLUMNS.ID], 10) === todoId &&
        row[COLUMNS.USER_ID] &&
        parseInt(row[COLUMNS.USER_ID], 10) === userId
      ) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      console.error(`Todo with ID ${todoId} not found for user ${userId}.`);
      return false;
    }

    // Update the completion status
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Todos!C${rowIndex + 2}`, // +2 because we start from row 2 and rowIndex is 0-based
      valueInputOption: 'RAW',
      requestBody: {
        values: [[completed.toString()]],
      },
    });

    return true;
  } catch (error: any) {
    console.error(`Error updating todo ${todoId} for user ${userId}:`, error);
    console.error('Operation details:', { todoId, userId, completed });
    console.error(
      'Error details:',
      error.errors
        ? JSON.stringify(error.errors, null, 2)
        : 'No detailed errors'
    );
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to update todo status: ${error.message}`);
  }
}

/**
 * Delete a todo
 */
export async function deleteTodo(
  todoId: number,
  userId: number
): Promise<boolean> {
  try {
    // Get all todos
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Todos!A2:D',
    });

    if (!response.data.values) {
      return false;
    }

    // Find the row index of the todo
    let rowIndex = -1;
    for (let i = 0; i < response.data.values.length; i++) {
      const row = response.data.values[i];
      if (
        row[COLUMNS.ID] &&
        parseInt(row[COLUMNS.ID], 10) === todoId &&
        row[COLUMNS.USER_ID] &&
        parseInt(row[COLUMNS.USER_ID], 10) === userId
      ) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      console.error(
        `Todo with ID ${todoId} not found for user ${userId} for deletion.`
      );
      return false;
    }

    // Delete the row
    // In Google Sheets API, we can't actually delete a row, but we can clear its contents
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `Todos!A${rowIndex + 2}:D${rowIndex + 2}`,
    });

    return true;
  } catch (error: any) {
    console.error(`Error deleting todo ${todoId} for user ${userId}:`, error);
    console.error('Operation details:', { todoId, userId });
    console.error(
      'Error details:',
      error.errors
        ? JSON.stringify(error.errors, null, 2)
        : 'No detailed errors'
    );
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to delete todo: ${error.message}`);
  }
}
