import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { promises as fs, existsSync } from "fs";
import fetch from "node-fetch";
import axios from "axios";
import { createWriteStream } from "fs";
import voice from "elevenlabs-node";
import { getOrderStatus, runGeminiWithOrderContext } from "./geminiOrderHelper.js";
import { extractOrderId } from "./extractOrderId.js";
dotenv.config();

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const voiceID = "cgSgspJ2msm6clMCkdW9";

const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

// Create audios folder if missing
if (!existsSync("audios")) {
  console.log("📁 audios folder not found, creating...");
  fs.mkdir("audios").catch(console.error);
}

app.get("/", (req, res) => {
  res.send("🛒 Hello from your Walmart Shopping Assistant!");
});

app.get("/voices", async (req, res) => {
  res.send(await voice.getVoices(elevenLabsApiKey));
});


const execCommand = (command) =>
  new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });

  
const generateTTS = async (text, fileName) => {
  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceID}`,
    {
      text,
      voice_settings: { stability: 0, similarity_boost: 0 },
    },
    {
      headers: {
        "xi-api-key": elevenLabsApiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      responseType: "stream",
    }
  );

  const writer = createWriteStream(fileName);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};



const lipSyncMessage = async (message) => {
  const time = new Date().getTime();
  console.log(`Starting conversion for message ${message}`);
  await execCommand(
    `ffmpeg -y -i audios/message_${message}.mp3 audios/message_${message}.wav`
  );
  console.log(`Conversion done in ${new Date().getTime() - time}ms`);
  // await execCommand(
  //   `./bin/rhubarb -f json -o audios/message_${message}.json audios/message_${message}.wav -r phonetic`
  // );
  await execCommand(
  `"bin\\rhubarb.exe" -f json -o audios\\message_${message}.json audios\\message_${message}.wav -r phonetic`
);

  // -r phonetic is faster but less accurate
  console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
};




app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  
  
  
  const orderId = extractOrderId(userMessage); // define this logic as needed
  let orderInfo = {};
  if (orderId) orderInfo = await getOrderStatus(orderId);

  if (orderId) {
  console.log("Detected Order ID:", orderId);
  }



  if (!userMessage) {
    return res.send({
      messages: [
        {
          text: "Hi! I'm Wally your sweet Walmart shopping assistant 😊. Ask me anything!",
          audio: await audioFileToBase64("audios/wally_hello.wav"),
          lipsync: await readJsonTranscript("audios/wally_hello.json"),
          facialExpression: "smile",
          animation: "Talking_1",
        },
      ],
    });
  }

  if (!elevenLabsApiKey || !geminiApiKey) {
    return res.send({
      messages: [
        {
          text: "Oops! API keys are missing. Please check your .env file.",
          audio: "",
          lipsync: [],
          facialExpression: "angry",
          animation: "Angry",
        },
      ],
    });
  }

//const promptText = `
// Respond ONLY with a JSON array like this (no explanation):

// [
//   {
//     "text": "Sure! You can check out HP or ASUS laptops under $800 at Walmart.",
//     "facialExpression": "smile",
//     "animation": "Talking_1"
//   }
// ]

// User: ${userMessage}
// `;


// const promptText = `
// You are Wally, Walmart/Flipkart's friendly shopping & support assistant.
// Answer the user's question in a helpful, concise tone.
// Return ONLY a JSON array (max 3) of objects with:
//  - text: your reply
//  - facialExpression: one of [smile,sad,angry,surprised,funnyFace,default]
//  - animation: one of [Talking_0,Talking_1,Talking_2,Crying,Laughing,Rumba,Idle,Terrified,Angry]
// User: ${userMessage}
// `;

const promptText = `
You are Wally, Walmart/Flipkart's friendly shopping & support assistant.
You already know that the user has the following active order:

Order ID: ORD870898  
Product: Realme Narzo 60  
Status: Out for delivery  
Carrier: BlueDart  
Tracking URL: https://track.example.com/ORD870898  
Expected Delivery: July 25, 2025  

Your job is to assist the user in a helpful, concise tone, based on this order information.

You must ALWAYS return a JSON array (max 3 items). Each item is an object with:
 - text: your reply
 - facialExpression: one of [smile, sad, angry, surprised, funnyFace, default]
 - animation: one of [Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, Angry]

User: ${userMessage}
`;



  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
        }),
      }
    );

    const geminiData = await geminiRes.json();
    let rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    // Clean markdown formatting from Gemini
    rawText = rawText.trim();
    if (rawText.startsWith("```json")) {
      rawText = rawText.replace(/^```json/, "").replace(/```$/, "").trim();
    }

    let messages;
    try {
      messages = JSON.parse(rawText);
    } catch (err) {
      console.error("❌ Gemini parse failed:", err);
      return res.send({
        messages: [
          {
            text: "Oops! I couldn't understand that. Please ask again.",
            facialExpression: "surprised",
            animation: "Idle",
          },
        ],
      });
    }

    // Generate audio and lipsync
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const fileName = `audios/message_${i}.mp3`;

      try {
        console.log(`🎤 Generating audio for message ${i}...`);
        await generateTTS(message.text, fileName);
        console.log(`✅ Audio saved: ${fileName}`);
      } catch (e) {
        console.error("❌ TTS failed:", e);
        return res.send({
          messages: [
            {
              text: "Failed to generate audio. Please try again.",
              facialExpression: "sad",
              animation: "Idle",
            },
          ],
        });
      }

      try {
        await lipSyncMessage(i);
      } catch (err) {
        console.error("❌ Lip sync failed:", err);
      }

      message.audio = await audioFileToBase64(fileName);
      try {
        message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
      } catch {
        message.lipsync = [];
      }
    }

    res.send({ messages });
  } catch (err) {
    console.error("❌ Chat endpoint error:", err);
    res.status(500).send({
      messages: [
        {
          text: "Something went wrong. Please try again later.",
          facialExpression: "sad",
          animation: "Idle",
        },
      ],
    });
  }
});

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

app.listen(port, () => {
  console.log(`🛒 Walmart Assistant running on http://localhost:${port}`);
});
