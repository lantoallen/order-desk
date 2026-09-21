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
const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const state = { products: [], orders: [] };

function showMessage(text = "") { message.textContent = text; }
function formatPrice(value) { return currency.format(Number(value) || 0); }
function productName(order) { return order.products?.name || "Unknown product"; }

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Something went wrong. Please try again.");
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

function renderProducts() {
  productsList.replaceChildren();
  productSelect.replaceChildren(new Option("Select a product", ""));
  if (state.products.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No products are available yet.";
    productsList.append(empty);
    return;
  }
  state.products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";
    if (product.image_url) {
      const image = document.createElement("img");
      image.className = "product-image";
      image.src = product.image_url;
      image.alt = product.name;
      card.append(image);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "product-image-placeholder";
      placeholder.textContent = "No image";
      card.append(placeholder);
    }
    const name = document.createElement("h3");
    name.textContent = product.name;
    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = formatPrice(product.price);
    const stock = document.createElement("p");
    stock.className = "product-stock";
    stock.textContent = `${product.stock_quantity} in stock`;
    const actions = document.createElement("div");
    actions.className = "product-actions";
    actions.append(
      button("Edit", "secondary-button", () => openProductDialog(product)),
      button("Replenish", "secondary-button", () => openStockDialog(product)),
      button("Delete", "delete-button", () => deleteProduct(product)),
    );
    card.append(name, price, stock, actions);
    productsList.append(card);
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
  const orders = filteredOrders();
  if (orders.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No orders match your filters.";
    row.append(cell);
    ordersList.append(row);
    return;
  }
  orders.forEach((order) => {
    const row = document.createElement("tr");
    [order.customer_name, productName(order), order.quantity, formatPrice(order.total_price)].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    const statusCell = document.createElement("td");
    const statusSelect = document.createElement("select");
    statuses.forEach((status) => statusSelect.append(new Option(status, status, false, status === order.status)));
    const inlineError = document.createElement("span");
    inlineError.className = "inline-error";
    const saveButton = button("Save", "", () => updateOrderStatus(order.id, statusSelect.value, saveButton, inlineError));
    saveButton.disabled = true;
    statusSelect.addEventListener("change", () => {
      saveButton.disabled = statusSelect.value === order.status;
      inlineError.textContent = "";
    });
    const statusControls = document.createElement("div");
    statusControls.className = "status-controls";
    statusControls.append(statusSelect, saveButton);
    statusCell.append(statusControls, inlineError);
    const actionsCell = document.createElement("td");
    actionsCell.append(button("Delete", "delete-button", () => deleteOrder(order.id)));
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
  document.querySelector("#product-dialog-title").textContent = editing ? "Edit product" : "Add product";
  document.querySelector("#product-submit-button").textContent = editing ? "Save product" : "Add product";
  document.querySelector("#product-id").value = product?.id || "";
  document.querySelector("#product-name").value = product?.name || "";
  document.querySelector("#product-price").value = product?.price ?? "";
  document.querySelector("#product-stock").value = product?.stock_quantity ?? 0;
  productDialog.showModal();
}
function openStockDialog(product) {
  stockForm.reset();
  document.querySelector("#replenish-quantity").value = 1;
  document.querySelector("#stock-product-id").value = product.id;
  document.querySelector("#stock-product-name").textContent = `Add stock for ${product.name}.`;
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
  if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;
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
  const id = document.querySelector("#product-id").value;
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
Promise.all([loadProducts(), loadOrders()]).catch((error) => showMessage(error.message));
