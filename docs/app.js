const productsList = document.querySelector("#products-list");
const ordersList = document.querySelector("#orders-list");
const orderForm = document.querySelector("#order-form");
const productSelect = document.querySelector("#product-id");
const message = document.querySelector("#message");
const orderSearch = document.querySelector("#order-search");
const orderStatusFilter = document.querySelector("#order-status-filter");
const productDialog = document.querySelector("#product-dialog");
const productForm = document.querySelector("#product-form");
const stockDialog = document.querySelector("#stock-dialog");
const stockForm = document.querySelector("#stock-form");

const statuses = ["pending", "preparing", "ready", "picked_up"];
const statusLabels = {
  pending: "Naghihintay",
  preparing: "Inihahanda",
  ready: "Handa na",
  picked_up: "Nakuha na",
};
const lowStockLevel = 10;
const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const state = { products: [], orders: [] };

function showMessage(text = "") { message.textContent = text; }
function formatPrice(value) { return currency.format(Number(value) || 0); }
function productName(order) { return order.products?.name || "Hindi kilalang produkto"; }
function statusLabel(status) { return statusLabels[status] || status; }

// Greeting by time of day, the way Batangueños say it
function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return "Magandang gabi.";
  if (hour < 11) return "Magandang umaga.";
  if (hour < 14) return "Magandang tanghali.";
  if (hour < 18) return "Magandang hapon.";
  return "Magandang gabi.";
}

function formatToday(date = new Date()) {
  try {
    return new Intl.DateTimeFormat("fil-PH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
  } catch (error) {
    return date.toDateString();
  }
}

function renderHeader() {
  document.querySelector("#greeting").textContent = greeting();
  document.querySelector("#today").textContent = formatToday();
  const waiting = state.orders.filter((order) => order.status === "pending").length;
  const low = state.products.filter((product) => Number(product.stock_quantity) <= lowStockLevel).length;
  const sales = state.orders
    .filter((order) => order.status === "picked_up")
    .reduce((sum, order) => sum + (Number(order.total_price) || 0), 0);
  document.querySelector("#stat-waiting").textContent = waiting;
  const lowStat = document.querySelector("#stat-low");
  lowStat.textContent = low;
  lowStat.classList.toggle("is-alert", low > 0);
  document.querySelector("#stat-sales").textContent = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(sales);
}

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "May nangyaring mali. Subukan ulit.");
  }
  return response.json();
}

function button(label, className, onClick) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  if (className) element.className = className;
  element.addEventListener("click", onClick);
  return element;
}

function stockText(product) {
  const quantity = Number(product.stock_quantity) || 0;
  const text = document.createElement("p");
  text.className = "product-stock";
  text.append(`${quantity} ang stock`);
  if (quantity === 0 || quantity <= lowStockLevel) {
    const flag = document.createElement("span");
    flag.className = quantity === 0 ? "stock-flag is-out" : "stock-flag";
    flag.textContent = quantity === 0 ? "Ubos na" : "Kaunti na lang";
    text.append(flag);
  }
  return text;
}

function renderProducts() {
  renderHeader();
  productsList.replaceChildren();
  productSelect.replaceChildren(new Option("Pumili ng produkto", ""));
  document.querySelector("#products-count").textContent = state.products.length ? `${state.products.length} item` : "";
  if (state.products.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Ala eh, wala pang produkto. Magdagdag ng una.";
    productsList.append(empty);
    return;
  }
  state.products.forEach((product) => {
    const item = document.createElement("article");
    item.className = "product";
    if (product.image_url) {
      const image = document.createElement("img");
      image.className = "product-image";
      image.src = product.image_url;
      image.alt = product.name;
      item.append(image);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "product-image-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.textContent = product.name.trim().charAt(0).toUpperCase();
      item.append(placeholder);
    }
    const body = document.createElement("div");
    const line = document.createElement("div");
    line.className = "product-line";
    const name = document.createElement("h3");
    name.textContent = product.name;
    const leader = document.createElement("span");
    leader.className = "leader";
    leader.setAttribute("aria-hidden", "true");
    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = formatPrice(product.price);
    line.append(name, leader, price);
    const actions = document.createElement("div");
    actions.className = "product-actions";
    actions.append(
      button("I-edit", "secondary-button", () => openProductDialog(product)),
      button("Dagdagan ang stock", "secondary-button", () => openStockDialog(product)),
      button("Burahin", "delete-button", () => deleteProduct(product)),
    );
    body.append(line, stockText(product), actions);
    item.append(body);
    productsList.append(item);
    productSelect.append(new Option(product.name, product.id));
  });
}

function filteredOrders() {
  const search = orderSearch.value.trim().toLowerCase();
  const status = orderStatusFilter.value;
  return state.orders.filter((order) => {
    const matchesSearch = !search || order.customer_name.toLowerCase().includes(search) || productName(order).toLowerCase().includes(search);
    return matchesSearch && (!status || order.status === status);
  });
}

function renderOrders() {
  ordersList.replaceChildren();
  renderHeader();
  document.querySelector("#orders-count").textContent = state.orders.length ? `${state.orders.length} lahat` : "";
  const orders = filteredOrders();
  if (orders.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = state.orders.length === 0 ? "Wala pang order." : "Walang order na tugma sa hinahanap mo.";
    row.append(cell);
    ordersList.append(row);
    return;
  }
  orders.forEach((order) => {
    const row = document.createElement("tr");
    [
      [order.customer_name, ""],
      [productName(order), ""],
      [order.quantity, "num"],
      [formatPrice(order.total_price), "num"],
    ].forEach(([value, className]) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (className) cell.className = className;
      row.append(cell);
    });
    const statusCell = document.createElement("td");
    const dot = document.createElement("span");
    dot.className = "status-dot";
    dot.dataset.status = order.status;
    const statusSelect = document.createElement("select");
    statusSelect.setAttribute("aria-label", `Status ng order ni ${order.customer_name}`);
    statuses.forEach((status) => statusSelect.append(new Option(statusLabel(status), status, false, status === order.status)));
    const inlineError = document.createElement("span");
    inlineError.className = "inline-error";
    const saveButton = button("I-save", "", () => updateOrderStatus(order.id, statusSelect.value, saveButton, inlineError));
    saveButton.disabled = true;
    statusSelect.addEventListener("change", () => {
      saveButton.disabled = statusSelect.value === order.status;
      inlineError.textContent = "";
    });
    const statusControls = document.createElement("div");
    statusControls.className = "status-controls";
    statusControls.append(dot, statusSelect, saveButton);
    statusCell.append(statusControls, inlineError);
    const actionsCell = document.createElement("td");
    actionsCell.append(button("Burahin", "delete-button", () => deleteOrder(order.id)));
    row.append(statusCell, actionsCell);
    ordersList.append(row);
  });
}

async function loadProducts() {
  state.products = await request("/api/products");
  renderProducts();
}
async function loadOrders() {
  state.orders = await request("/api/orders");
  renderOrders();
}
async function refreshProducts() {
  try { await loadProducts(); showMessage(); } catch (error) { showMessage(error.message); }
}
async function refreshOrders() {
  try { await loadOrders(); showMessage(); } catch (error) { showMessage(error.message); }
}

function openProductDialog(product) {
  productForm.reset();
  document.querySelector("#product-form-error").textContent = "";
  const editing = Boolean(product);
  document.querySelector("#product-dialog-title").textContent = editing ? "I-edit ang produkto" : "Bagong produkto";
  document.querySelector("#product-submit-button").textContent = editing ? "I-save ang produkto" : "Idagdag ang produkto";
  document.querySelector("#edit-product-id").value = product?.id || "";
  document.querySelector("#product-name").value = product?.name || "";
  document.querySelector("#product-price").value = product?.price ?? "";
  document.querySelector("#product-stock").value = product?.stock_quantity ?? 0;
  productDialog.showModal();
}
function openStockDialog(product) {
  stockForm.reset();
  document.querySelector("#replenish-quantity").value = 1;
  document.querySelector("#stock-product-id").value = product.id;
  document.querySelector("#stock-product-name").textContent = `Dagdag na stock para sa ${product.name}.`;
  document.querySelector("#stock-form-error").textContent = "";
  stockDialog.showModal();
}

async function updateOrderStatus(id, status, saveButton, inlineError) {
  saveButton.disabled = true;
  inlineError.textContent = "";
  try {
    await request(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    await refreshOrders();
  } catch (error) {
    saveButton.disabled = false;
    inlineError.textContent = error.message;
  }
}
async function deleteOrder(id) {
  try { await request(`/api/orders/${id}`, { method: "DELETE" }); await refreshOrders(); } catch (error) { showMessage(error.message); }
}
async function deleteProduct(product) {
  if (!window.confirm(`Burahin ang ${product.name}? Hindi na ito mababawi.`)) return;
  try { await request(`/api/products/${product.id}`, { method: "DELETE" }); await refreshProducts(); } catch (error) { showMessage(error.message); }
}

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(orderForm);
  try {
    await request("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_name: formData.get("customer_name"), product_id: formData.get("product_id"), quantity: Number(formData.get("quantity")) }) });
    orderForm.reset();
    document.querySelector("#quantity").value = 1;
    await refreshOrders();
  } catch (error) { showMessage(error.message); }
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = document.querySelector("#product-submit-button");
  const errorMessage = document.querySelector("#product-form-error");
  const id = document.querySelector("#edit-product-id").value;
  submit.disabled = true;
  errorMessage.textContent = "";
  try {
    await request(id ? `/api/products/${id}` : "/api/products", { method: id ? "PATCH" : "POST", body: new FormData(productForm) });
    productDialog.close();
    await refreshProducts();
  } catch (error) { errorMessage.textContent = error.message; } finally { submit.disabled = false; }
});

stockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = document.querySelector("#stock-submit-button");
  const errorMessage = document.querySelector("#stock-form-error");
  submit.disabled = true;
  errorMessage.textContent = "";
  try {
    const id = document.querySelector("#stock-product-id").value;
    const quantity = Number(new FormData(stockForm).get("quantity"));
    await request(`/api/products/${id}/stock`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity }) });
    stockDialog.close();
    await refreshProducts();
  } catch (error) { errorMessage.textContent = error.message; } finally { submit.disabled = false; }
});

document.querySelector("#add-product-button").addEventListener("click", () => openProductDialog());
document.querySelector("#close-product-dialog").addEventListener("click", () => productDialog.close());
document.querySelector("#close-stock-dialog").addEventListener("click", () => stockDialog.close());
orderSearch.addEventListener("input", renderOrders);
orderStatusFilter.addEventListener("change", renderOrders);
renderHeader();
Promise.all([loadProducts(), loadOrders()]).catch((error) => showMessage(error.message));
