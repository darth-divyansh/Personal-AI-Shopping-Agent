# """
# A Telegram bot that answers with Google Gemini (via LangChain).

# Run:
#     python bot.py
# """

# import os
# import logging
# from dotenv import load_dotenv
# from telegram import Update
# from telegram.ext import (
#     ApplicationBuilder,
#     CommandHandler,
#     MessageHandler,
#     ContextTypes,
#     filters,
# )

# from langchain.prompts import PromptTemplate
# from langchain_google_genai import ChatGoogleGenerativeAI

# # ─────────────────── env & logging ───────────────────────────────────────
# load_dotenv()  # pulls GOOGLE_API_KEY and TELEGRAM_BOT_TOKEN from .env

# logging.basicConfig(
#     format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
# )
# logger = logging.getLogger(__name__)

# # ─────────────────── LangChain: prompt | llm ─────────────────────────────
# prompt = PromptTemplate.from_template("""
# You are Wallmart's AI Assistant — a smart, friendly, and professional virtual assistant helping users with queries about shopping, orders, product details, and more.

# Always reply in a helpful and brand-consistent way. Be concise, warm, and helpful. If the message is casual (e.g. "hi", "how are you"), respond like a customer support AI assistant with a friendly greeting.

# User message: {question}

# Your response:
# """)

# llm = ChatGoogleGenerativeAI(
#     model="gemini-2.0-flash",
#     temperature=0.7,
# )

# # RunnableSequence (Prompt → LLM)
# chain = prompt | llm  # use chain.ainvoke(...) later

# # ─────────────────── Telegram callbacks ──────────────────────────────────
# async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
#     user = update.effective_user
#     await update.message.reply_markdown_v2(
#         fr"Hi {user.mention_markdown_v2()}\! I'm a bot powered by **Google Gemini**\. "
#         r"Ask me anything\."
#     )


# async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
#     await update.message.reply_text("Send me a question and I'll answer with AI!")


# async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
#     user_msg = update.message.text
#     try:
#         # async invocation of the chain
#         response_text = await chain.ainvoke({"question": user_msg})
#         await update.message.reply_text(str(response_text))
#     except Exception as exc:
#         logger.exception(exc)
#         await update.message.reply_text(
#             "Sorry, I couldn't process your request right now."
#         )


# # ─────────────────── main ────────────────────────────────────────────────
# def main() -> None:
#     bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
#     if not bot_token:
#         raise RuntimeError("Set TELEGRAM_BOT_TOKEN in your .env file")

#     app = ApplicationBuilder().token(bot_token).build()

#     app.add_handler(CommandHandler("start", start))
#     app.add_handler(CommandHandler("help", help_command))
#     app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

#     logger.info("🤖 Bot is up … Press Ctrl‑C to stop.")
#     app.run_polling()


# if __name__ == "__main__":
#     main()

"""
A Telegram bot that answers with Google Gemini (via LangChain).

Run:
    python bot.py
"""

import os
import logging
from dotenv import load_dotenv
from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from langchain.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

# ─────────────────── env & logging ───────────────────────────────────────
load_dotenv()  # pulls GOOGLE_API_KEY and TELEGRAM_BOT_TOKEN from .env

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# ─────────────────── LangChain: prompt | llm ─────────────────────────────
prompt = PromptTemplate.from_template("""
You are Wallmart's AI Assistant — a smart, friendly, and professional virtual assistant helping users with queries about shopping, orders, product details, and more.

Always reply in a helpful and brand-consistent way. Be concise, warm, and helpful. If the message is casual (e.g. "hi", "how are you"), respond like a customer support AI assistant with a friendly greeting.

User message: {question}

Your response:
""")

llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.7,
)

# Chain: prompt → LLM
chain = prompt | llm

# ─────────────────── Telegram callbacks ──────────────────────────────────
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    await update.message.reply_markdown_v2(
        fr"Hi {user.mention_markdown_v2()}\! I'm Wallmart's 🤖 AI Assistant powered by **Google Gemini**\. "
        r"Ask me anything\!"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    await update.message.reply_text(
        "Just send me a message — I'm here to assist with shopping, orders, and product questions!"
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_msg = update.message.text.lower().strip()
    user_first_name = update.effective_user.first_name or "there"

    casual_triggers = [
        "hi", "hello", "hey", "how are you", "who are you", "what can you do",
        "what is this", "help", "start", "yo", "hola"
    ]

    try:
        # 🟡 Show typing
        await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)

        # 🧠 Run Gemini prompt
        response = await chain.ainvoke({"question": user_msg})
        response_text = getattr(response, "content", str(response))

        # 👋 Personal greeting if casual message
        if any(trigger in user_msg for trigger in casual_triggers):
            intro = f"👋 Hi {user_first_name}! I'm Wallmart's AI Assistant — here to help you with shopping, orders, product info, and more.\n\n"
            final_response = intro + response_text
        else:
            final_response = response_text

        # 📝 Reply to user
        await update.message.reply_text(final_response)

    except Exception as exc:
        logger.exception("Error handling message:")
        await update.message.reply_text(
            "Sorry, I couldn't process your request right now. Please try again shortly."
        )

# ─────────────────── main ────────────────────────────────────────────────
def main() -> None:
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not bot_token:
        raise RuntimeError("Set TELEGRAM_BOT_TOKEN in your .env file")

    app = ApplicationBuilder().token(bot_token).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("🤖 Bot is running… Press Ctrl+C to stop.")
    app.run_polling()


if __name__ == "__main__":
    main()
