import os, logging, tempfile, asyncio
from datetime import datetime

from dotenv import load_dotenv
from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup, InputFile
)
from telegram.ext import (
    ApplicationBuilder, CommandHandler, MessageHandler,
    ContextTypes, filters
)

import motor.motor_asyncio
from serpapi import GoogleSearch
import whisper, requests
from pydub import AudioSegment

# ---------- Env & logging ----------
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------- MongoDB ----------
mongo = motor.motor_asyncio.AsyncIOMotorClient(os.getenv("MONGODB_URI"))
order_col = mongo["wallmart_bot"]["order_queries"]

# ---------- Whisper model ----------
whisper_model = whisper.load_model("base")

def transcribe_voice(file_path: str) -> str:
    """Transcribe audio file to text with Whisper."""
    # Whisper wants WAV/MP3; convert OGG if needed
    if file_path.endswith(".oga") or file_path.endswith(".ogg"):
        wav_path = file_path + ".wav"
        AudioSegment.from_file(file_path).export(wav_path, format="wav")
        file_path = wav_path
    result = whisper_model.transcribe(file_path, fp16=False)
    return result["text"].strip()

# ---------- Gemini via LangChain ----------
from langchain.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.memory import ConversationBufferMemory
from langchain_core.runnables import RunnableSequence

prompt = PromptTemplate.from_template("""
You are Wallmart's friendly AI assistant (Flipkart style). 
Be concise, helpful and professional.

{question}
""")
memory = ConversationBufferMemory(return_messages=True, memory_key="history")
llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.7)
chain = RunnableSequence(prompt | llm).with_config({"memory": memory})

# ---------- SerpAPI product search ----------
SERP_KEY = os.getenv("SERPAPI_KEY")

def serp_products(query: str, num=3):
    params = {
        "engine": "google",
        "q": query + " site:flipkart.com",
        "api_key": SERP_KEY,
        "num": num,
        "tbm": "shop"  # Google Shopping
    }
    res = GoogleSearch(params).get_dict()
    items = res.get("shopping_results") or []
    products = []
    for i, item in enumerate(items[:num], start=1):
        products.append({
            "name": item.get("title"),
            "price": item.get("price"),
            "url": item.get("link")
        })
    return products

# ---------- Order logging ----------
async def log_order(user_id, text):
    await order_col.insert_one({
        "user_id": user_id,
        "query": text,
        "timestamp": datetime.utcnow(),
        "status": "pending"
    })

# ---------- Telegram handlers ----------
async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 Hi, I'm Wallmart's AI Assistant.\n"
        "Ask me for product suggestions or order help!"
    )

async def help_cmd(update: Update, ctx):
    await update.message.reply_text(
        "Examples:\n"
        "• Send a voice note: \"Need a phone under ten thousand\"\n"
        "• Text: Suggest a laptop under ₹50000\n"
        "• Where is my order #WALL12345\n"
        "• /buy <url>  # (demo)"
    )

# --- voice handler ---
async def voice(update: Update, ctx):
    voice_file = await ctx.bot.get_file(update.message.voice.file_id)
    with tempfile.NamedTemporaryFile(suffix=".oga", delete=False) as tmp:
        await voice_file.download_to_drive(tmp.name)
        text = await asyncio.to_thread(transcribe_voice, tmp.name)
    logger.info(f"Voice -> '{text}'")
    # Inject transcribed text and reuse message handler
    update.message.text = text
    await handle(update, ctx)

# --- main text handler ---
async def handle(update: Update, ctx):
    msg = update.message.text
    user_id = update.effective_user.id
    low = msg.lower()

    try:
        # Product intent (very naive check)
        if any(word in low for word in ["suggest", "buy", "phone", "laptop", "under", "₹", "rs"]):
            prods = serp_products(msg, num=3)
            if not prods:
                await update.message.reply_text("Sorry, couldn't find matching products.")
                return
            buttons = [[InlineKeyboardButton(p["name"], url=p["url"])] for p in prods]
            reply = "🛒 Top matches:\n" + "\n".join(
                f"{i+1}. {p['name']} – {p['price']}" for i, p in enumerate(prods)
            )
            await update.message.reply_text(
                reply, reply_markup=InlineKeyboardMarkup(buttons), disable_web_page_preview=True
            )

        # Order intent
        elif "order" in low and ("#" in low or "status" in low):
            await log_order(user_id, msg)
            await update.message.reply_text(
                "📦 Got it! I've logged your order query. Our team will follow up shortly."
            )

        # Fallback to Gemini
        else:
            response = await chain.ainvoke({"question": msg})
            await update.message.reply_text(str(response))

    except Exception as e:
        logger.exception(e)
        await update.message.reply_text("Sorry, something went wrong.")

# ---------- /buy demo command ----------
async def buy_cmd(update: Update, ctx):
    """Demo: start a headless Selenium checkout (user already logged‑in)."""
    url = ctx.args[0] if ctx.args else None
    if not url:
        await update.message.reply_text("Usage: /buy <flipkart-product-url>")
        return
    await update.message.reply_text(
        "🚧 Auto‑checkout demo starting …\n(This will only work on a machine "
        "where a Selenium driver is configured and you’re logged‑in.)"
    )
    # Lazy import Selenium to avoid heavy dep if not used
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options

    opts = Options()
    opts.add_argument("--headless=new")
    driver = webdriver.Chrome(options=opts)
    try:
        driver.get(url)
        # TODO: adapt selectors; Flipkart changes often!
        add_btn = driver.find_element("xpath", "//button[contains(.,'Add to cart')]")
        add_btn.click()
        await update.message.reply_text("Item added to cart ✅ (demo).")
        # driver.find_element(...).click() -> proceed to checkout
    except Exception as e:
        await update.message.reply_text(f"Automation failed: {e}")
    finally:
        driver.quit()

# ---------- main ----------
def main():
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token or not SERP_KEY:
        raise RuntimeError("Check TELEGRAM_BOT_TOKEN and SERPAPI_KEY in .env")

    app = ApplicationBuilder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CommandHandler("buy", buy_cmd))
    app.add_handler(MessageHandler(filters.VOICE, voice))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle))

    logger.info("🤖 Wallmart AI Assistant running …")
    app.run_polling()

if __name__ == "__main__":
    main()

import os, logging, tempfile, asyncio
from datetime import datetime

from dotenv import load_dotenv
from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup
)
from telegram.ext import (
    ApplicationBuilder, CommandHandler, MessageHandler,
    ContextTypes, filters
)

import motor.motor_asyncio
from serpapi import GoogleSearch
import whisper
from pydub import AudioSegment

# ---------- Env & logging ----------
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------- MongoDB ----------
mongo = motor.motor_asyncio.AsyncIOMotorClient(os.getenv("MONGODB_URI"))
order_col = mongo["wallmart_bot"]["order_queries"]

# ---------- Whisper model ----------
whisper_model = whisper.load_model("base")

def transcribe_voice(file_path: str) -> str:
    """Transcribe audio file to text with Whisper."""
    if file_path.endswith(".oga") or file_path.endswith(".ogg"):
        wav_path = file_path + ".wav"
        AudioSegment.from_file(file_path).export(wav_path, format="wav")
        file_path = wav_path
    result = whisper_model.transcribe(file_path, fp16=False)
    return result["text"].strip()

# ---------- Gemini via LangChain ----------
from langchain.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.memory import ConversationBufferMemory
from langchain_core.runnables import RunnableSequence

prompt = PromptTemplate.from_template("""
You are Wallmart's friendly AI assistant (Flipkart style). 
Be concise, helpful and professional.

{question}
""")
memory = ConversationBufferMemory(return_messages=True, memory_key="history")
llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.7)
chain = RunnableSequence(prompt | llm).with_config({"memory": memory})

# ---------- SerpAPI product search ----------
SERP_KEY = os.getenv("SERPAPI_KEY")

def serp_products(query: str, num=3):
    params = {
        "engine": "google",
        "q": query + " site:flipkart.com",
        "api_key": SERP_KEY,
        "num": num,
        "tbm": "shop"
    }
    res = GoogleSearch(params).get_dict()
    items = res.get("shopping_results") or []
    products = []
    for item in items[:num]:
        products.append({
            "name": item.get("title"),
            "price": item.get("price"),
            "url": item.get("link")
        })
    return products

# ---------- Order logging ----------
async def log_order(user_id, text):
    await order_col.insert_one({
        "user_id": user_id,
        "query": text,
        "timestamp": datetime.utcnow(),
        "status": "pending"
    })

# ---------- Telegram handlers ----------
async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 Hi, I'm Wallmart's AI Assistant WALL-E 🤖💙.\n"
        "Ask me for product suggestions or order help!"
    )

async def help_cmd(update: Update, ctx):
    await update.message.reply_text(
        "Examples:\n"
        "• Send a voice note: \"Need a phone under ten thousand\"\n"
        "• Text: Suggest a laptop under ₹50000\n"
        "• Where is my order #WALL12345\n"
        "• /buy <url>  # (demo)"
    )

# --- voice handler ---
async def voice(update: Update, ctx):
    voice_file = await ctx.bot.get_file(update.message.voice.file_id)
    with tempfile.NamedTemporaryFile(suffix=".oga", delete=False) as tmp:
        await voice_file.download_to_drive(tmp.name)
        text = await asyncio.to_thread(transcribe_voice, tmp.name)
    logger.info(f"Voice -> '{text}'")
    update.message.text = text
    await handle(update, ctx)

# --- main text handler ---
async def handle(update: Update, ctx):
    msg = update.message.text
    user_id = update.effective_user.id
    low = msg.lower()

    try:
        # Show typing status
        await ctx.bot.send_chat_action(chat_id=update.effective_chat.id, action="typing")

        if any(word in low for word in ["suggest", "buy", "phone", "laptop", "under", "₹", "rs"]):
            prods = serp_products(msg, num=3)
            if not prods:
                await update.message.reply_text("Sorry, couldn't find matching products.")
                return
            buttons = [[InlineKeyboardButton(p["name"], url=p["url"])] for p in prods]
            reply = "🛒 Top matches:\n" + "\n".join(
                f"{i+1}. {p['name']} – {p['price']}" for i, p in enumerate(prods)
            )
            await update.message.reply_text(
                reply, reply_markup=InlineKeyboardMarkup(buttons), disable_web_page_preview=True
            )

        elif "order" in low and ("#" in low or "status" in low):
            await log_order(user_id, msg)
            await update.message.reply_text(
                "📦 Got it! I've logged your order query. Our team will follow up shortly."
            )

        else:
            response = await chain.ainvoke({"question": msg})
            text = response.content if hasattr(response, "content") else str(response)
            await update.message.reply_text(text)

    except Exception as e:
        logger.exception(e)
        await update.message.reply_text("Sorry, something went wrong.")

# ---------- /buy demo command ----------
async def buy_cmd(update: Update, ctx):
    url = ctx.args[0] if ctx.args else None
    if not url:
        await update.message.reply_text("Usage: /buy <flipkart-product-url>")
        return
    await update.message.reply_text(
        "🚧 Auto-checkout demo starting … (requires Selenium + browser profile)"
    )
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options

    opts = Options()
    opts.add_argument("--headless=new")
    driver = webdriver.Chrome(options=opts)
    try:
        driver.get(url)
        add_btn = driver.find_element("xpath", "//button[contains(.,'Add to cart')]")
        add_btn.click()
        await update.message.reply_text("Item added to cart ✅ (demo).")
    except Exception as e:
        await update.message.reply_text(f"Automation failed: {e}")
    finally:
        driver.quit()

# ---------- main ----------
def main():
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token or not SERP_KEY:
        raise RuntimeError("Check TELEGRAM_BOT_TOKEN and SERPAPI_KEY in .env")

    app = ApplicationBuilder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CommandHandler("buy", buy_cmd))
    app.add_handler(MessageHandler(filters.VOICE, voice))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle))

    logger.info("🤖 Wallmart AI Assistant running …")
    app.run_polling()

if __name__ == "__main__":
    main()




