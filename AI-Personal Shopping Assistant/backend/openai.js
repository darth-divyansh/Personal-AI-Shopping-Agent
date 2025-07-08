import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import voice from "elevenlabs-node";
import express from "express";
import { promises as fs } from "fs";
import OpenAI from "openai";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Your OpenAI API key here, I used "-" to avoid errors when the key is not set but you should not do that
});

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const voiceID = "cgSgspJ2msm6clMCkdW9";
// const userMemory = new Map();

const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/voices", async (req, res) => {
  res.send(await voice.getVoices(elevenLabsApiKey));
});

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const lipSyncMessage = async (message) => {
  const time = new Date().getTime();
  console.log(`Starting conversion for message ${message}`);
  await execCommand(
    `ffmpeg -y -i audios/message_${message}.mp3 audios/message_${message}.wav`
    // -y to overwrite the file
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
  const userEmail = req.body.email || "bansaldivyansh002@example.com";
  // let memory = userMemory.get(userEmail) || {};

  const userMessage = req.body.message;
  if (!userMessage) {
    res.send({
      messages: [
         {
          text: "Hi! I'm Wally your sweet Walmart shopping assistant 😊. Ask me anything!",
          audio: await audioFileToBase64("audios/wally_hello.wav"),
          lipsync: await readJsonTranscript("audios/wally_hello.json"),
          facialExpression: "smile",
          animation: "Talking_1",
        },
         {
          text: "Want to continue our last conversation?",
          audio: await audioFileToBase64("audios/wally_hello3.wav"),
          lipsync: await readJsonTranscript("audios/wally_hello3.json"),
          facialExpression: "smile",
          animation: "Talking_2",
        },
      ],
    });
    return;
  }
  if (!elevenLabsApiKey || openai.apiKey === "-") {
    res.send({
      messages: [
        {
          text: "Please my dear, don't forget to add your API keys!",
          audio: await audioFileToBase64("audios/api_0.wav"),
          lipsync: await readJsonTranscript("audios/api_0.json"),
          facialExpression: "angry",
          animation: "Angry",
        },
      ],
    });
    return;
  }


const orders = [
  {
    orderId: "ORD870898",
    product: "Realme Narzo 60",
    status: "Out for delivery",
    carrier: "BlueDart",
    trackingUrl: "https://track.example.com/ORD870898",
    expectedDelivery: "July 25, 2025",
  },
  {
    orderId: "ORD219344",
    product: "Apple iPad 9th Gen",
    status: "Processing",
    carrier: "Ekart",
    trackingUrl: "https://track.example.com/ORD219344",
    expectedDelivery: "August 2, 2025",
  }
];

const formattedOrders = orders.map(
  (o, i) => `  ${i + 1}. Order ID: ${o.orderId}\n     Product: ${o.product}\n     Status: ${o.status}\n     Carrier: ${o.carrier || "N/A"}\n     Tracking: ${o.trackingUrl || "N/A"}\n     Expected Delivery: ${o.expectedDelivery}\n`
).join("\n");


const productSuggestions = [
  {
    title: "Samsung Galaxy M14 5G",
    price: "₹12,499",
    link: "https://www.flipkart.com/samsung-galaxy-m14",
  },
  {
    title: "Redmi 13C 5G",
    price: "₹10,999",
    link: "https://www.flipkart.com/redmi-13c-5g",
  },
  {
    title: "Motorola G73 5G",
    price: "₹13,999",
    link: "https://www.flipkart.com/motorola-g73-5g",
  },
];

const formattedSuggestions = productSuggestions
  .map(
    (p, i) => `${i + 1}. ${p.title} - ${p.price}\n   Link: ${p.link}`
  )
  .join("\n");



const completion = await openai.chat.completions.create({
  model: "gpt-3.5-turbo-1106",
  max_tokens: 1000,
  temperature: 0.6,
  response_format: {
    type: "json_object",
  },
  messages: [
    {
  role: "system",
  content: `
You are a virtual Shopping Assistant for Walmart and Flipkart. You know everything about their products and services.
You will help the user with order queries and product recommendations using the data below.

You know the following active orders for the user:

${formattedOrders}


If the user doesn't clearly mention an order ID or product, kindly ask them which order they need help with.
Do not speak the tracking URL just provide the status and expected delivery date.
If they ask for a product, use the suggestions above to recommend one or more.

You will always reply with a JSON array of messages (max 3).
Each message must include:
- text: your reply
- facialExpression: one of [smile, sad, angry, surprised, funnyFace, default]
- animation: one of [Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, Angry]
  `,

    },
    {
      role: "user",
      content: userMessage || "Hello",
    },
  ],
});

  let messages = JSON.parse(completion.choices[0].message.content);
  if (messages.messages) {
    messages = messages.messages; // ChatGPT is not 100% reliable, sometimes it directly returns an array and sometimes a JSON object with a messages property
  }
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    // generate audio file
    const fileName = `audios/message_${i}.mp3`; // The name of your audio file
    const textInput = message.text; // The text you wish to convert to speech
    await voice.textToSpeech(elevenLabsApiKey, voiceID, fileName, textInput);
    // generate lipsync
    await lipSyncMessage(i);
    message.audio = await audioFileToBase64(fileName);
    message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
  }
// memory.lastMessage = userMessage;
// memory.lastUsed = new Date();
// userMemory.set(userEmail, memory);

  res.send({ messages });
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
  console.log(`Wally Virtual Assistant listening on port ${port}`);
});