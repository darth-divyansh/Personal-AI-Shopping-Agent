import mongoose from "mongoose";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI, {
  dbName: "walmart_assistant",
});

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  email: String,
  status: String,
  trackingUrl: String,
  carrier: String,
  expectedDelivery: Date,
  lastUpdate: Date,
});

const Order = mongoose.model("Order", orderSchema);

export async function getOrderStatus(orderId) {
  const order = await Order.findOne({ orderId }).lean();
  if (!order) return { found: false };

  return {
    found: true,
    orderId: order.orderId,
    status: order.status,
    carrier: order.carrier,
    trackingUrl: order.trackingUrl,
    expectedDelivery: order.expectedDelivery?.toISOString().slice(0, 10),
  };
}

export async function runGeminiWithOrderContext(userMessage, orderInfo, apiKey) {
  const promptText = `
You are Wally, Walmart/Flipkart's friendly shopping & support assistant.
${orderInfo?.found ? `Order status: ${JSON.stringify(orderInfo)}` : ""}
Answer the user's question in a helpful, concise tone.
Return ONLY a JSON array (max 3) of objects with:
 - text: your reply
 - facialExpression: one of [smile,sad,angry,surprised,funnyFace,default]
 - animation: one of [Talking_0,Talking_1,Talking_2,Crying,Laughing,Rumba,Idle,Terrified,Angry]
User: ${userMessage}
`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
      }),
    }
  );

  const data = await res.json();

  if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
    console.error("❌ Gemini response error", data);
    return "[]";
  }

  return data.candidates[0].content.parts[0].text.trim();
}
