const SERVICE_FEE = 30;
const MAX_RECENT_ORDERS = 10;
const CART_STORAGE_KEY = "rines-bean-cafe-cart";
const ORDERS_STORAGE_KEY = "rines-bean-cafe-orders";

const productCards = Array.from(
  document.querySelectorAll(".product-card[data-product-id]"),
);
const addToCartButtons = Array.from(
  document.querySelectorAll("[data-add-to-cart]"),
);

const cartItemsContainer = document.querySelector("[data-cart-items]");
const cartCountBadge = document.querySelector("[data-cart-count]");
const cartTotalValue = document.querySelector("[data-cart-total]");
const serviceRow = document.querySelector("[data-service-row]");
const checkoutLink = document.querySelector("[data-checkout-link]");
const cartCard = document.querySelector(".cart-card");

const thanksMessage = document.querySelector("[data-thanks-message]");
const thanksOrder = document.querySelector("[data-thanks-order]");
const thanksOrderId = document.querySelector("[data-thanks-order-id]");
const thanksOrderTotal = document.querySelector("[data-thanks-order-total]");

const ordersList = document.querySelector("[data-orders-list]");

const catalog = new Map(
  productCards.map((card) => [
    card.dataset.productId,
    {
      id: card.dataset.productId,
      name: card.dataset.productName,
      price: Number(card.dataset.productPrice),
    },
  ]),
);

let orders = loadOrders();

if (orders.length > MAX_RECENT_ORDERS) {
  orders = orders.slice(0, MAX_RECENT_ORDERS);
  saveOrders(orders);
}

renderOrderList(orders);
renderThankYou(orders[0] ?? null);
initializeCartPage();

function initializeCartPage() {
  if (
    productCards.length === 0 ||
    !cartItemsContainer ||
    !cartCountBadge ||
    !cartTotalValue ||
    !serviceRow ||
    !checkoutLink ||
    !cartCard
  ) {
    return;
  }

  const buttonTimers = new WeakMap();
  let cart = loadCart(catalog);
  let highlightTimer;

  renderCart();

  addToCartButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const productCard = button.closest(".product-card");

      if (!productCard?.dataset.productId) {
        return;
      }

      addToCart(productCard.dataset.productId);
      flashButton(button);
      pulseCart();
    });
  });

  cartItemsContainer.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.cartAction;
    const productId = target.dataset.productId;

    if (!action || !productId) {
      return;
    }

    if (action === "increase") {
      changeQuantity(productId, 1);
    }

    if (action === "decrease") {
      changeQuantity(productId, -1);
    }

    if (action === "remove") {
      removeFromCart(productId);
    }

    pulseCart();
  });

  checkoutLink.addEventListener("click", (event) => {
    event.preventDefault();

    if (cart.length === 0) {
      document.querySelector("#products")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    checkoutCart();
  });

  function addToCart(productId) {
    const existingItem = cart.find((item) => item.id === productId);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      const product = catalog.get(productId);

      if (!product) {
        return;
      }

      cart.push({
        ...product,
        quantity: 1,
      });
    }

    saveCart(cart);
    renderCart();
  }

  function changeQuantity(productId, delta) {
    const item = cart.find((cartItem) => cartItem.id === productId);

    if (!item) {
      return;
    }

    item.quantity += delta;

    if (item.quantity <= 0) {
      cart = cart.filter((cartItem) => cartItem.id !== productId);
    }

    saveCart(cart);
    renderCart();
  }

  function removeFromCart(productId) {
    cart = cart.filter((item) => item.id !== productId);
    saveCart(cart);
    renderCart();
  }

  function checkoutCart() {
    const order = createOrderFromCart(cart);

    orders = [order, ...orders].slice(0, MAX_RECENT_ORDERS);
    saveOrders(orders);

    cart = [];
    saveCart(cart);

    renderCart();
    renderOrderList(orders);
    renderThankYou(order);
    pulseCart();

    document.querySelector("#thanks")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function renderCart() {
    if (cart.length === 0) {
      cartItemsContainer.innerHTML = `
        <p class="cart-empty">
          Your cart is empty. Add a drink or pastry to get started.
        </p>
      `;
      serviceRow.hidden = true;
      cartCountBadge.textContent = "0 items";
      cartTotalValue.textContent = formatPrice(0);
      checkoutLink.textContent = "Add items to continue";
      checkoutLink.href = "#products";
      checkoutLink.setAttribute("aria-disabled", "true");
      checkoutLink.classList.add("is-disabled");
      return;
    }

    cartItemsContainer.innerHTML = cart
      .map(
        (item) => `
          <div class="cart-item">
            <div class="cart-item-main">
              <div class="cart-item-copy">
                <span class="cart-item-name">${escapeHtml(item.name)}</span>
                <span class="cart-item-meta">${formatPrice(item.price)} each</span>
              </div>

              <div class="cart-item-controls">
                <div class="qty-controls" aria-label="Quantity controls for ${escapeHtml(item.name)}">
                  <button
                    class="qty-button"
                    type="button"
                    data-cart-action="decrease"
                    data-product-id="${escapeHtml(item.id)}"
                    aria-label="Decrease quantity of ${escapeHtml(item.name)}"
                  >
                    -
                  </button>
                  <span class="qty-count">${item.quantity}</span>
                  <button
                    class="qty-button"
                    type="button"
                    data-cart-action="increase"
                    data-product-id="${escapeHtml(item.id)}"
                    aria-label="Increase quantity of ${escapeHtml(item.name)}"
                  >
                    +
                  </button>
                </div>

                <button
                  class="remove-button"
                  type="button"
                  data-cart-action="remove"
                  data-product-id="${escapeHtml(item.id)}"
                >
                  Remove
                </button>
              </div>
            </div>

            <strong class="cart-item-total">${formatPrice(item.price * item.quantity)}</strong>
          </div>
        `,
      )
      .join("");

    serviceRow.hidden = false;
    cartCountBadge.textContent = formatItemCount(getItemCount(cart));
    cartTotalValue.textContent = formatPrice(getSubtotal(cart) + SERVICE_FEE);
    checkoutLink.textContent = "Check Out Order";
    checkoutLink.href = "#thanks";
    checkoutLink.setAttribute("aria-disabled", "false");
    checkoutLink.classList.remove("is-disabled");
  }

  function flashButton(button) {
    const resetTimer = buttonTimers.get(button);

    if (resetTimer) {
      window.clearTimeout(resetTimer);
    }

    button.textContent = "Added";
    button.classList.add("is-added");

    const timerId = window.setTimeout(() => {
      button.textContent = "Add to cart";
      button.classList.remove("is-added");
    }, 1200);

    buttonTimers.set(button, timerId);
  }

  function pulseCart() {
    cartCard.classList.remove("is-updated");
    window.requestAnimationFrame(() => {
      cartCard.classList.add("is-updated");
    });

    window.clearTimeout(highlightTimer);
    highlightTimer = window.setTimeout(() => {
      cartCard.classList.remove("is-updated");
    }, 450);
  }
}

function renderOrderList(orderHistory) {
  if (!ordersList) {
    return;
  }

  const visibleOrders = orderHistory.slice(0, MAX_RECENT_ORDERS);

  if (visibleOrders.length === 0) {
    ordersList.innerHTML = `
      <p class="orders-empty">
        No checked out orders yet. Add items to your cart and complete
        checkout.
      </p>
    `;
    return;
  }

  ordersList.innerHTML = visibleOrders
    .map(
      (order) => `
        <article class="order-card">
          <div class="order-card-header">
            <div class="order-card-title">
              <span class="order-id">${escapeHtml(order.id)}</span>
              <span class="order-date">${formatDate(order.createdAt)}</span>
            </div>
            <span class="order-total-pill">${formatPrice(order.total)}</span>
          </div>

          <div class="order-lines">
            ${order.items
              .map(
                (item) => `
                  <div class="order-line">
                    <div class="order-item-details">
                      <span class="order-item-name">${escapeHtml(item.name)}</span>
                      <span class="order-item-qty">
                        ${item.quantity} x ${formatPrice(item.price)}
                      </span>
                    </div>
                    <strong>${formatPrice(item.quantity * item.price)}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>

          <div class="order-card-summary">
            <span>${formatItemCount(order.itemCount)} + Service Prep</span>
            <strong>${formatPrice(order.total)}</strong>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderThankYou(latestOrder) {
  if (!thanksMessage || !thanksOrder || !thanksOrderId || !thanksOrderTotal) {
    return;
  }

  if (!latestOrder) {
    thanksMessage.textContent =
      "Complete your checkout to save the order and see it in your order list.";
    thanksOrder.hidden = true;
    thanksOrderId.textContent = "No recent order yet";
    thanksOrderTotal.textContent = formatPrice(0);
    return;
  }

  thanksMessage.textContent =
    "Your order has been checked out successfully and added to your order list.";
  thanksOrder.hidden = false;
  thanksOrderId.textContent = `${latestOrder.id} | ${formatDate(latestOrder.createdAt)}`;
  thanksOrderTotal.textContent = formatPrice(latestOrder.total);
}

function createOrderFromCart(cart) {
  const items = cart.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
  }));
  const subtotal = getSubtotal(cart);

  return {
    id: buildOrderId(),
    createdAt: new Date().toISOString(),
    items,
    itemCount: getItemCount(cart),
    subtotal,
    serviceFee: SERVICE_FEE,
    total: subtotal + SERVICE_FEE,
  };
}

function getSubtotal(cart) {
  return cart.reduce((total, item) => total + item.price * item.quantity, 0);
}

function getItemCount(cart) {
  return cart.reduce((total, item) => total + item.quantity, 0);
}

function formatItemCount(count) {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

function formatPrice(amount) {
  return `P${amount}`;
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateValue));
}

function buildOrderId() {
  const stamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 900 + 100);
  return `RBC-${stamp}-${random}`;
}

function saveCart(cart) {
  try {
    const storedCart = cart.map((item) => ({
      id: item.id,
      quantity: item.quantity,
    }));

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(storedCart));
  } catch (error) {
    console.warn("Cart could not be saved.", error);
  }
}

function loadCart(catalogMap) {
  try {
    const rawCart = localStorage.getItem(CART_STORAGE_KEY);

    if (!rawCart) {
      return [];
    }

    const parsedCart = JSON.parse(rawCart);

    if (!Array.isArray(parsedCart)) {
      return [];
    }

    return parsedCart
      .map((entry) => {
        const product = catalogMap.get(entry.id);
        const quantity = Number.parseInt(entry.quantity, 10);

        if (!product || !Number.isFinite(quantity) || quantity <= 0) {
          return null;
        }

        return {
          ...product,
          quantity,
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.warn("Cart could not be loaded.", error);
    return [];
  }
}

function saveOrders(orderHistory) {
  try {
    localStorage.setItem(
      ORDERS_STORAGE_KEY,
      JSON.stringify(orderHistory.slice(0, MAX_RECENT_ORDERS)),
    );
  } catch (error) {
    console.warn("Orders could not be saved.", error);
  }
}

function loadOrders() {
  try {
    const rawOrders = localStorage.getItem(ORDERS_STORAGE_KEY);

    if (!rawOrders) {
      return [];
    }

    const parsedOrders = JSON.parse(rawOrders);

    if (!Array.isArray(parsedOrders)) {
      return [];
    }

    return parsedOrders
      .map((order) => {
        if (
          !order ||
          typeof order.id !== "string" ||
          !Array.isArray(order.items) ||
          typeof order.total !== "number" ||
          typeof order.createdAt !== "string"
        ) {
          return null;
        }

        const items = order.items
          .map((item) => {
            if (
              !item ||
              typeof item.id !== "string" ||
              typeof item.name !== "string" ||
              typeof item.price !== "number" ||
              typeof item.quantity !== "number"
            ) {
              return null;
            }

            return {
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
            };
          })
          .filter(Boolean);

        if (items.length === 0) {
          return null;
        }

        return {
          id: order.id,
          createdAt: order.createdAt,
          items,
          itemCount:
            typeof order.itemCount === "number"
              ? order.itemCount
              : items.reduce((total, item) => total + item.quantity, 0),
          subtotal:
            typeof order.subtotal === "number"
              ? order.subtotal
              : items.reduce(
                  (total, item) => total + item.price * item.quantity,
                  0,
                ),
          serviceFee:
            typeof order.serviceFee === "number" ? order.serviceFee : SERVICE_FEE,
          total: order.total,
        };
      })
      .filter(Boolean)
      .slice(0, MAX_RECENT_ORDERS);
  } catch (error) {
    console.warn("Orders could not be loaded.", error);
    return [];
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
