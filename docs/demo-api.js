// Demo mode: answers the app's /api/* calls from sample data stored in the
// visitor's own browser, so the frontend works on GitHub Pages with no server.
(() => {
  const STORAGE_KEY = "order-desk-demo-v1";
  const STATUSES = ["pending", "preparing", "ready", "picked_up"];
  const realFetch = window.fetch.bind(window);

  const makeId = () =>
    window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2);

  function seed() {
    const products = [
      ["Ibaan Barako (250g)", 340, 38],
      ["Lipa Barako (250g)", 360, 45],
      ["Benguet Arabica (250g)", 420, 25],
      ["Taal Volcano Blend (250g)", 380, 60],
      ["Barako Drip Bags, Box of 10", 290, 80],
      ["Tablea Tsokolate (10 pcs)", 240, 35],
      ["Sagada Arabica (250g)", 480, 20],
      ["Barako Espresso Roast (250g)", 390, 30],
      ["Panutsa (Peanut Brittle) Pack", 120, 70],
      ["Kape at Panutsa Gift Box", 499, 6],
    ].map(([name, price, stock_quantity], i) => ({
      id: "p" + (i + 1), name, price, stock_quantity, image_url: null,
    }));
    const find = (name) => products.find((p) => p.name === name);
    const orders = [
      ["Aling Nena's Sari-Sari Store", "Lipa Barako (250g)", 10, "picked_up"],
      ["Tita Baby's Café", "Barako Espresso Roast (250g)", 6, "ready"],
      ["Kuya Ramon's Carinderia", "Barako Drip Bags, Box of 10", 12, "preparing"],
      ["Juan Dela Cruz", "Kape at Panutsa Gift Box", 2, "pending"],
      ["Maria Santos", "Tablea Tsokolate (10 pcs)", 3, "pending"],
      ["Ate Grace", "Panutsa (Peanut Brittle) Pack", 5, "picked_up"],
    ].map(([customer_name, productName, quantity, status], i) => {
      const product = find(productName);
      return {
        id: "o" + (i + 1), customer_name, product_id: product.id,
        product_name: product.name, quantity,
        total_price: quantity * product.price, status,
      };
    });
    return { products, orders };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable: use sample data */ }
    return seed();
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
  }
  let db = load();

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  const fail = (error, status = 400) => json({ error }, status);
  const viewOrder = (o) => ({ ...o, products: { name: o.product_name } });
  const num = (text) => (text === "" ? NaN : Number(text));
  const parseJson = (body) => { try { return JSON.parse(body || "{}"); } catch (e) { return {}; } };

  function readProductForm(body) {
    const form = body instanceof FormData ? body : new FormData();
    const pick = (...keys) => {
      for (const key of keys) {
        const value = form.get(key);
        if (value !== null && value !== "") return String(value);
      }
      return "";
    };
    return {
      name: pick("name", "product_name").trim().slice(0, 80),
      price: num(pick("price", "product_price")),
      stock_quantity: num(pick("stock_quantity", "stock", "product_stock")),
    };
  }

  function validateProduct(p) {
    if (!p.name) return "Product name is required.";
    if (!Number.isFinite(p.price) || p.price < 0) return "Enter a valid price.";
    if (!Number.isInteger(p.stock_quantity) || p.stock_quantity < 0) return "Stock must be 0 or more.";
    return "";
  }

  function handle(method, pathname, init) {
    const match = pathname.match(/^\/api\/(products|orders)(?:\/([^/]+))?(?:\/(stock))?\/?$/);
    if (!match) return fail("Not found.", 404);
    const [, resource, id, sub] = match;

    if (resource === "products") {
      if (!id && method === "GET") {
        return json([...db.products].sort((a, b) => a.name.localeCompare(b.name)));
      }
      if (!id && method === "POST") {
        const p = readProductForm(init.body);
        const problem = validateProduct(p);
        if (problem) return fail(problem);
        const product = { id: makeId(), ...p, price: Math.round(p.price * 100) / 100, image_url: null };
        db.products.push(product);
        save();
        return json(product, 201);
      }
      const product = db.products.find((x) => x.id === id);
      if (!product) return fail("Product not found.", 404);
      if (method === "PATCH" && sub === "stock") {
        const quantity = Number(parseJson(init.body).quantity);
        if (!Number.isInteger(quantity) || quantity < 1) return fail("Quantity must be at least 1.");
        product.stock_quantity += quantity;
        save();
        return json(product);
      }
      if (method === "PATCH") {
        const p = readProductForm(init.body);
        const problem = validateProduct(p);
        if (problem) return fail(problem);
        Object.assign(product, p, { price: Math.round(p.price * 100) / 100 });
        save();
        return json(product);
      }
      if (method === "DELETE") {
        db.products = db.products.filter((x) => x.id !== id);
        save();
        return json({ ok: true });
      }
    }

    if (resource === "orders") {
      if (!id && method === "GET") return json(db.orders.map(viewOrder));
      if (!id && method === "POST") {
        const body = parseJson(init.body);
        const name = String(body.customer_name || "").trim().slice(0, 80);
        const quantity = Number(body.quantity);
        const product = db.products.find((x) => x.id === body.product_id);
        if (!name) return fail("Customer name is required.");
        if (!product) return fail("Please select a product.");
        if (!Number.isInteger(quantity) || quantity < 1) return fail("Quantity must be at least 1.");
        if (quantity > product.stock_quantity) return fail("Only " + product.stock_quantity + " in stock.");
        product.stock_quantity -= quantity;
        const order = {
          id: makeId(), customer_name: name, product_id: product.id,
          product_name: product.name, quantity,
          total_price: Math.round(quantity * product.price * 100) / 100,
          status: "pending",
        };
        db.orders.unshift(order);
        save();
        return json(viewOrder(order), 201);
      }
      const order = db.orders.find((x) => x.id === id);
      if (!order) return fail("Order not found.", 404);
      if (method === "PATCH") {
        const status = parseJson(init.body).status;
        if (!STATUSES.includes(status)) return fail("Invalid status.");
        order.status = status;
        save();
        return json(viewOrder(order));
      }
      if (method === "DELETE") {
        db.orders = db.orders.filter((x) => x.id !== id);
        save();
        return json({ ok: true });
      }
    }
    return fail("Not found.", 404);
  }

  window.fetch = (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, window.location.href);
    if (!url.pathname.startsWith("/api/")) return realFetch(input, init);
    return Promise.resolve(handle((init.method || "GET").toUpperCase(), url.pathname, init));
  };

  document.addEventListener("DOMContentLoaded", () => {
    const banner = document.createElement("div");
    banner.className = "demo-banner";
    const text = document.createElement("span");
    text.textContent = "Demo mode: sample data is saved in your browser only. Image uploads are turned off.";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Reset demo";
    reset.addEventListener("click", () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
      location.reload();
    });
    banner.append(text, reset);
    document.body.prepend(banner);
  });
})();