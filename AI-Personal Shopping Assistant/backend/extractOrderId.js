export function extractOrderId(message) {
  const match = message.match(/\bORD\d{6,12}\b/i);
  return match ? match[0].toUpperCase() : null;
}
