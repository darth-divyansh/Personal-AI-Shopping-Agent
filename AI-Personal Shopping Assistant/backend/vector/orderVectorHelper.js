import mongoose from "mongoose";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// ── MongoDB ────────────────────────────────────────────────
await mongoose.connect(process.env.MONGODB_URI, {
  dbName: "walmart_assistant",
});
console.log("✅ Connected to MongoDB");

const orderSchema = new mongoose.Schema({
  orderId:         { type: String, required: true, unique: true },
  email:           String,
  status:          String,
  carrier:         String,
  trackingUrl:     String,
  expectedDelivery: Date,
  lastUpdate:      Date,
  embedding:       { type: [Number], index: "flat" }, // Ensure this matches Atlas vector index
});

const Order = mongoose.model("Order", orderSchema);

// ── Gemini embedding model ─────────────────────────────────
export async function embed(query) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "models/embedding-001" });

  const result = await model.embedContent({
     content: {
      parts: [{ text: query }]
    } // ✅ Correct key for embedding model (not 'content' or 'parts')
  });
  return result.embedding.values;
}

// ── CRUD helpers ───────────────────────────────────────────
export async function upsertOrder(ord) {
  const textForEmbed = `Order ${ord.orderId} ${ord.status} ${ord.carrier}`;
  ord.embedding = await embed(textForEmbed);
  return Order.findOneAndUpdate({ orderId: ord.orderId }, ord, {
    upsert: true,
    new: true,
  });
}

export async function getOrderStatus(orderId) {
  const order = await Order.findOne({ orderId }).lean();
  return order
    ? {
        found: true,
        orderId: order.orderId,
        status: order.status,
        carrier: order.carrier,
        trackingUrl: order.trackingUrl,
        expectedDelivery: order.expectedDelivery?.toISOString().slice(0, 10),
      }
    : { found: false };
}

// ── Vector Search via Atlas $vectorSearch ──────────────────
export async function searchOrderByQuery(text) {
  const queryVec = await embed(text);
  const result = await Order.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",         // <- your created vector index name
        path: "embedding",              // <- must match schema field
        queryVector: queryVec,
        numCandidates: 100,
        limit: 1
      }
    },
    {
      $project: {
        orderId: 1,
        status: 1,
        carrier: 1,
        trackingUrl: 1,
        expectedDelivery: 1,
        score: { $meta: "vectorSearchScore" }
      }
    }
  ]);

  if (!result.length || result[0].score < 0.85) return { found: false };
  const o = result[0];
  return {
    found: true,
    orderId: o.orderId,
    status: o.status,
    carrier: o.carrier,
    trackingUrl: o.trackingUrl,
    expectedDelivery: o.expectedDelivery?.toISOString().slice(0, 10),
  };
}
