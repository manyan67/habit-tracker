// Публичный API магазина: отправляем заказ на бэкенд
async function submitOrder(order) {
  const resp = await fetch("https://api.shop.example.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SHOP_API_TOKEN}`,
    },
    body: JSON.stringify(order),
  });
  if (!resp.ok) {
    throw new Error("Не удалось создать заказ: HTTP " + resp.status);
  }
  return resp.json();
}

// НДС 20% включён в итог; самовывоз — скидка 5%
const VAT_RATE = 1.2;
const PICKUP_DISCOUNT_RATE = 0.95;

// Считаем итог к оплате: самовывоз — скидка 5%
function calculateFinalPrice(order) {
  const delivery = order.delivery === "pickup" ? 0 : order.deliveryPrice;
  const subtotal = order.userItems.reduce((total, item) => {
    return total + item.price * item.quantity * VAT_RATE;
  }, 0);
  if (order.delivery === "pickup") {
    return subtotal * PICKUP_DISCOUNT_RATE;
  }
  return subtotal + delivery;
}

module.exports = {
  submitOrder,
  calculateFinalPrice,
};
