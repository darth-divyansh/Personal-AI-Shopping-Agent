import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

/* ---------- Mongo connection ---------- */
await mongoose.connect(process.env.MONGODB_URI, {
  dbName: "wallmart_assistant",
});

/* ---------- Order schema ---------- */
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  email: String,
  product: String,
  status: String,
  trackingUrl: String,
  carrier: String,
  expectedDelivery: Date,
  lastUpdate: Date,
});
const Order = mongoose.model("Order", orderSchema);

/* ---------- Helpers ---------- */
const SAME_EMAIL = "bansaldivyansh002@example.com";
const carriers = ["Ekart", "FedEx", "BlueDart", "UPS", "USPS", "Delhivery"];
const statuses = [
  "Processing",
  "Shipped",
  "Out for delivery",
  "Delivered",
  "Cancelled",
  "Returned",
];
const products = [
  "Samsung Galaxy M14",
  "Nike Air Max 90",
  "Boat Airdopes 141",
  "Mi Smart Band 6",
  "Sony WH-1000XM4",
  "Apple iPad 9th Gen",
  "Adidas Running Shoes",
  "Logitech MX Master 3",
  "Realme Narzo 60",
  "Fire-Boltt Smartwatch",
];

function generateOrderId() {
  return "ORD" + Math.floor(100000 + Math.random() * 900000);
}

/* ---------- Build 10 orders ---------- */
const sampleOrders = Array.from({ length: 10 }, (_, i) => {
  const id = generateOrderId();
  const status = statuses[i % statuses.length];
  const carrier = status === "Processing" || status === "Cancelled" ? "" : carriers[i % carriers.length];
  const trackingUrl = carrier ? `https://track.example.com/${id}` : "";
  const expectedDelivery =
    ["Delivered", "Cancelled", "Returned"].includes(status)
      ? null
      : new Date(Date.now() + (3 + i) * 24 * 60 * 60 * 1000); // 3–12 days ahead

  return {
    orderId: id,
    email: SAME_EMAIL,
    product: products[i % products.length],
    status,
    carrier,
    trackingUrl,
    expectedDelivery,
    lastUpdate: new Date(),
  };
});

/* ---------- Insert & quit ---------- */
await Order.insertMany(sampleOrders);
console.log("✅ Seeded 10 orders for", SAME_EMAIL);
process.exit();
