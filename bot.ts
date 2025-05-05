import { Bot, InlineKeyboard, Context, SessionFlavor } from 'grammy';
import * as dotenv from 'dotenv';
import { session } from 'grammy';

dotenv.config();

// Define Todo interface
interface Todo {
  id: number;
  text: string;
  completed: boolean;
  userId: number; // To support multiple users
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

// Store todos
const todos: Todo[] = [];
// Keep track of the next todo ID
let nextTodoId = 1;

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

  const userTodos = todos.filter(todo => todo.userId === userId);

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

  const userTodos = todos.filter(todo => todo.userId === userId);
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

  const userTodos = todos.filter(todo => todo.userId === userId);
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

  // Set user state to "adding" - in a real app, you'd store this in a database
  // For simplicity, we'll use the in-memory approach, but this won't persist across bot restarts
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
        const newTodo: Todo = {
          id: nextTodoId++,
          text: ctx.message.text,
          completed: false,
          userId,
        };

        todos.push(newTodo);

        // Reset the user's state
        ctx.session.state = undefined;

        // Provide confirmation and button to view the list
        await ctx.reply(`✅ Added new todo: ${ctx.message.text}`, {
          reply_markup: KEYBOARDS.VIEW_LIST,
        });
        break;

      case 'completing':
        // Process completing/uncompleting a todo
        const completeId = parseInt(ctx.message.text.trim());

        if (isNaN(completeId)) {
          await ctx.reply('❌ Please enter a valid number.', {
            reply_markup: KEYBOARDS.BACK_TO_LIST,
          });
          break;
        }

        const todoToCompleteIndex = todos.findIndex(
          todo => todo.id === completeId && todo.userId === userId
        );

        if (todoToCompleteIndex === -1) {
          await ctx.reply(`❌ Todo with ID ${completeId} not found.`, {
            reply_markup: KEYBOARDS.BACK_TO_LIST,
          });
          break;
        }

        // Toggle completion status
        todos[todoToCompleteIndex].completed =
          !todos[todoToCompleteIndex].completed;
        const status = todos[todoToCompleteIndex].completed
          ? 'completed'
          : 'marked as pending';

        // Reset state
        ctx.session.state = undefined;

        await ctx.reply(`✅ Todo ${completeId} ${status}.`, {
          reply_markup: KEYBOARDS.VIEW_LIST,
        });
        break;

      case 'deleting':
        // Process deleting a todo
        const deleteId = parseInt(ctx.message.text.trim());

        if (isNaN(deleteId)) {
          await ctx.reply('❌ Please enter a valid number.', {
            reply_markup: KEYBOARDS.BACK_TO_LIST,
          });
          break;
        }

        const todoToDeleteIndex = todos.findIndex(
          todo => todo.id === deleteId && todo.userId === userId
        );

        if (todoToDeleteIndex === -1) {
          await ctx.reply(`❌ Todo with ID ${deleteId} not found.`, {
            reply_markup: KEYBOARDS.BACK_TO_LIST,
          });
          break;
        }

        // Delete the todo
        const deletedTodo = todos.splice(todoToDeleteIndex, 1)[0];

        // Reset state
        ctx.session.state = undefined;

        await ctx.reply(`🗑️ Deleted todo: ${deletedTodo.text}`, {
          reply_markup: KEYBOARDS.VIEW_LIST,
        });
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

//Start the Bot
bot.start();

// Add error handler
bot.catch(err => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  console.error(err.error);
});
