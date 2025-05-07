import { Bot, InlineKeyboard, Context, SessionFlavor } from 'grammy';
import * as dotenv from 'dotenv';
import { session } from 'grammy';
import * as sheetsService from './src/services/sheets';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Read service account email from credentials file if available
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credentialsFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const credentialsContent = fs.readFileSync(credentialsFile, 'utf8');
    const credentials = JSON.parse(credentialsContent);
    if (credentials.client_email) {
      process.env.SERVICE_ACCOUNT_EMAIL = credentials.client_email;
      console.log(`Service account email: ${credentials.client_email}`);
    }
  }
} catch (error) {
  console.error('Error reading service account email:', error);
}

// Define session interface
interface SessionData {
  state?: 'adding' | 'completing' | 'deleting';
}

// Define context type with session
type MyContext = Context & SessionFlavor<SessionData>;

// Callback data constants
const CALLBACK = {
  LIST: 'list',
  ADD: 'add',
  COMPLETE: 'complete',
  DELETE: 'delete',
};

// Keyboard constants
const KEYBOARDS = {
  START: new InlineKeyboard()
    .text('📋 List', CALLBACK.LIST)
    .text('➕ Add', CALLBACK.ADD),

  TODO_ACTIONS: new InlineKeyboard()
    .text('➕ Add', CALLBACK.ADD)
    .text('✅ Complete', CALLBACK.COMPLETE)
    .text('🗑️ Delete', CALLBACK.DELETE),

  EMPTY_LIST: new InlineKeyboard().text('➕ Add Todo', CALLBACK.ADD),

  BACK_TO_LIST: new InlineKeyboard().text('🔙 Back to List', CALLBACK.LIST),

  VIEW_LIST: new InlineKeyboard().text('📋 View Todo List', CALLBACK.LIST),

  OPEN_LIST: new InlineKeyboard().text('📋 Open Todo List', CALLBACK.LIST),
};

/* 
  Create a new bot
*/
if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required');
}
const bot = new Bot<MyContext>(process.env.BOT_TOKEN);

// Set up session middleware
bot.use(
  session({
    initial(): SessionData {
      return { state: undefined };
    },
  })
);

// Initialize the Google Sheet
(async () => {
  try {
    await sheetsService.initializeSheet();
    console.log('Google Sheets integration initialized successfully');

    // Start the bot only after successful initialization
    bot.start();
    console.log('Bot started successfully');
  } catch (error) {
    // The sheets service already logged detailed error information
    console.error('Failed to initialize application. Exiting...');
    process.exit(1);
  }
})();

const startMessage =
  '🤖 *Welcome to Todo Bot\\!* 📝\n\n' +
  'I can help you manage your tasks efficiently\\.\n\n' +
  '*Use the buttons below to:*\n' +
  '📋 View your todo list\n' +
  '➕ Add new tasks\n' +
  '✅ Mark tasks as complete/incomplete\n' +
  '🗑️ Delete tasks\n\n' +
  "Let's get organized\\! Tap a button below to begin\\.";

// Handle the start command
bot.command('start', async ctx => {
  await ctx.reply(startMessage, {
    parse_mode: 'MarkdownV2',
    reply_markup: KEYBOARDS.START,
  });
});

// Handle the list button in inline keyboard
bot.callbackQuery('list', async ctx => {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Always answer the callback query immediately
  await ctx.answerCallbackQuery();

  // Reset any active states
  if (ctx.session?.state) {
    ctx.session.state = undefined;
  }

  // Get todos from Google Sheets
  const userTodos = await sheetsService.getUserTodos(userId);

  if (userTodos.length === 0) {
    // Show empty state message with an add button
    const emptyMessage =
      '📋 *Your Todo List is Empty*\n\nYou have no todos yet. Add your first task!';

    await ctx.editMessageText(emptyMessage, {
      parse_mode: 'Markdown',
      reply_markup: KEYBOARDS.EMPTY_LIST,
    });
    return;
  }

  let message = '📋 *Your Todo List:*\n\n';
  userTodos.forEach(todo => {
    const status = todo.completed ? '✅' : '⬜️';
    message += `${status} *${todo.id}*: ${todo.text}\n`;
  });

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: KEYBOARDS.TODO_ACTIONS,
  });
});

// Handle the Complete button
bot.callbackQuery('complete', async ctx => {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Always answer the callback query immediately
  await ctx.answerCallbackQuery();

  // Get todos from Google Sheets
  const userTodos = await sheetsService.getUserTodos(userId);

  if (userTodos.length === 0) {
    await ctx.answerCallbackQuery('You have no todos to complete!');
    ctx.callbackQuery.data = 'list';
    await bot.handleUpdate({
      ...ctx.update,
      callback_query: {
        ...ctx.callbackQuery,
        data: 'list',
      },
    });
    return;
  }

  // Show prompt to enter todo number
  let message =
    '✅ *Enter Todo Number to Toggle*\n\n' +
    'Type the number of the todo you want to mark as complete/incomplete.\n\n' +
    '*Your Todos:*\n';

  userTodos.forEach(todo => {
    const status = todo.completed ? '✅' : '⬜️';
    message += `${status} *${todo.id}*: ${todo.text}\n`;
  });

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: KEYBOARDS.BACK_TO_LIST,
  });

  // Set state to "completing"
  ctx.session = { state: 'completing' };
});

// Handle the Delete button
bot.callbackQuery('delete', async ctx => {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Always answer the callback query immediately
  await ctx.answerCallbackQuery();

  // Get todos from Google Sheets
  const userTodos = await sheetsService.getUserTodos(userId);

  if (userTodos.length === 0) {
    await ctx.answerCallbackQuery('You have no todos to delete!');
    ctx.callbackQuery.data = 'list';
    await bot.handleUpdate({
      ...ctx.update,
      callback_query: {
        ...ctx.callbackQuery,
        data: 'list',
      },
    });
    return;
  }

  // Show prompt to enter todo number
  let message =
    '🗑️ *Enter Todo Number to Delete*\n\n' +
    'Type the number of the todo you want to delete.\n\n' +
    '*Your Todos:*\n';

  userTodos.forEach(todo => {
    const status = todo.completed ? '✅' : '⬜️';
    message += `${status} *${todo.id}*: ${todo.text}\n`;
  });

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: KEYBOARDS.BACK_TO_LIST,
  });

  // Set state to "deleting"
  ctx.session = { state: 'deleting' };
});

// Handle the add button in inline keyboard
bot.callbackQuery('add', async ctx => {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Always answer the callback query immediately
  await ctx.answerCallbackQuery();

  const message =
    'Please send me the task you want to add.\n\nJust type your todo text as a reply to this message.';

  await ctx.editMessageText(message, {
    reply_markup: KEYBOARDS.BACK_TO_LIST,
  });

  // Set user state to "adding"
  ctx.session = { state: 'adding' };
});

/* 
  Dispatcher for messages coming from the Bot API 
*/
bot.on('message', async ctx => {
  //Print to console
  console.log(
    `${ctx.from.first_name} wrote ${
      'text' in ctx.message ? ctx.message.text : ''
    }`
  );

  const userId = ctx.from?.id;
  if (!userId) return;

  // Handle different states based on what the user is doing
  if (ctx.message.text && ctx.session?.state) {
    switch (ctx.session.state) {
      case 'adding':
        // Process adding a new todo
        try {
          const nextId = await sheetsService.getNextId();
          const newTodo: sheetsService.Todo = {
            id: nextId,
            text: ctx.message.text,
            completed: false,
            userId,
          };

          await sheetsService.addTodo(newTodo);

          // Reset the user's state
          ctx.session.state = undefined;

          // Provide confirmation and button to view the list
          await ctx.reply(`✅ Added new todo: ${ctx.message.text}`, {
            reply_markup: KEYBOARDS.VIEW_LIST,
          });
        } catch (error) {
          console.error('Error adding todo:', error);
          await ctx.reply(
            '❌ Sorry, there was an error adding your todo. Please try again.',
            {
              reply_markup: KEYBOARDS.BACK_TO_LIST,
            }
          );
        }
        break;

      case 'completing':
        // Process completing/uncompleting a todo
        try {
          const completeId = parseInt(ctx.message.text.trim());

          if (isNaN(completeId)) {
            await ctx.reply('❌ Please enter a valid number.', {
              reply_markup: KEYBOARDS.BACK_TO_LIST,
            });
            break;
          }

          // Get the current todos to check status
          const userTodos = await sheetsService.getUserTodos(userId);
          const todoToComplete = userTodos.find(t => t.id === completeId);

          if (!todoToComplete) {
            await ctx.reply(`❌ Todo with ID ${completeId} not found.`, {
              reply_markup: KEYBOARDS.BACK_TO_LIST,
            });
            break;
          }

          // Toggle completion status
          const newStatus = !todoToComplete.completed;
          const success = await sheetsService.updateTodoStatus(
            completeId,
            userId,
            newStatus
          );

          if (!success) {
            await ctx.reply(`❌ Failed to update todo ${completeId}.`, {
              reply_markup: KEYBOARDS.BACK_TO_LIST,
            });
            break;
          }

          // Reset state
          ctx.session.state = undefined;

          const status = newStatus ? 'completed' : 'marked as pending';
          await ctx.reply(`✅ Todo ${completeId} ${status}.`, {
            reply_markup: KEYBOARDS.VIEW_LIST,
          });
        } catch (error) {
          console.error('Error completing todo:', error);
          await ctx.reply(
            '❌ Sorry, there was an error updating your todo. Please try again.',
            {
              reply_markup: KEYBOARDS.BACK_TO_LIST,
            }
          );
        }
        break;

      case 'deleting':
        // Process deleting a todo
        try {
          const deleteId = parseInt(ctx.message.text.trim());

          if (isNaN(deleteId)) {
            await ctx.reply('❌ Please enter a valid number.', {
              reply_markup: KEYBOARDS.BACK_TO_LIST,
            });
            break;
          }

          // Get the current todos to check if it exists
          const userTodos = await sheetsService.getUserTodos(userId);
          const todoToDelete = userTodos.find(t => t.id === deleteId);

          if (!todoToDelete) {
            await ctx.reply(`❌ Todo with ID ${deleteId} not found.`, {
              reply_markup: KEYBOARDS.BACK_TO_LIST,
            });
            break;
          }

          const success = await sheetsService.deleteTodo(deleteId, userId);

          if (!success) {
            await ctx.reply(`❌ Failed to delete todo ${deleteId}.`, {
              reply_markup: KEYBOARDS.BACK_TO_LIST,
            });
            break;
          }

          // Reset state
          ctx.session.state = undefined;

          await ctx.reply(`🗑️ Deleted todo: ${todoToDelete.text}`, {
            reply_markup: KEYBOARDS.VIEW_LIST,
          });
        } catch (error) {
          console.error('Error deleting todo:', error);
          await ctx.reply(
            '❌ Sorry, there was an error deleting your todo. Please try again.',
            {
              reply_markup: KEYBOARDS.BACK_TO_LIST,
            }
          );
        }
        break;
    }

    return;
  }

  // For other text messages, guide users to use the buttons
  if (ctx.message.text) {
    // For command messages, explain we're using buttons
    if (ctx.message.text.startsWith('/')) {
      if (ctx.message.text === '/start') {
        // Let the /start command work normally
        return;
      }

      await ctx.reply(
        '✨ I now work with buttons instead of commands! ✨\n\nTap the button below to access your todo list.',
        {
          reply_markup: KEYBOARDS.OPEN_LIST,
        }
      );
    } else {
      // For regular text messages when not in a specific state, guide them
      await ctx.reply(
        'To manage your todos, please use the buttons provided. Tap below to get started:',
        {
          reply_markup: KEYBOARDS.OPEN_LIST,
        }
      );
    }
  }
});

// Add error handler
bot.catch(err => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  console.error(err.error);
});
