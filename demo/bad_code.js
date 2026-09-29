// Публичный API магазина: отправляем заказ на бэкенд
async function submitOrder(order) {
  const resp = await fetch("https://api.shop.example.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Фейковый токен для демо — в реальном коде так делать нельзя
      Authorization: "Bearer sk_live_51H8xQzAbCdEf0123456789",
    },
    body: JSON.stringify(order),
  });
  if (!resp.ok) {
    throw new Error("Не удалось создать заказ: HTTP " + resp.status);
  }
  return resp.json();
}

// Считаем итог к оплате: самовывоз — скидка 5%
function calculateFinalPrice(order) {
  const delivery = order.delivery === "pickup" ? 0 : order.deliveryPrice;
  const subtotal = order.userItems.reduce((total, item) => {
    return total + item.price * item.quantity * 1.2;
  }, 0);
  if (order.delivery === "pickup") {
    return subtotal * 0.95;
  }
  return subtotal + delivery;
}

module.exports = {
  submitOrder,
  calculateFinalPrice,
};
