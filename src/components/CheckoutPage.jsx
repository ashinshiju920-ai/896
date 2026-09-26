import React, { useState, useEffect } from "react";
import { useShop } from "../context/ShopContext";

export default function CheckoutPage({ productsFromAdmin = [] }) {
  let contextBooks = [];
  try {
    const shop = useShop();
    if (shop && shop.books) contextBooks = shop.books;
  } catch {}

  const initialList = productsFromAdmin && productsFromAdmin.length > 0 ? productsFromAdmin : contextBooks;
  const [products, setProducts] = useState(initialList);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Customer Form State
  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: ""
  });

  // If products are passed via props or fetched dynamically
  useEffect(() => {
    const source = (productsFromAdmin && productsFromAdmin.length > 0) ? productsFromAdmin : contextBooks;
    if (source && source.length > 0) {
      const mapped = source.map((b) => ({
        id: b.id,
        title: b.title,
        price: b.prices?.digital?.price ?? b.price ?? 499,
        ...b,
      }));
      setProducts(mapped);
      setSelectedProduct((prev) => prev || mapped[0]);
    }
  }, [productsFromAdmin, contextBooks.length]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      setErrorMessage("Please select a product first.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      // 1. Create order on Cloudflare Pages function
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          productTitle: selectedProduct.title,
          price: selectedProduct.price, // Guaranteed exact price from checkout state
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone
        })
      });

      const data = await response.json();

      if (!response.ok || !data.paymentSessionId) {
        throw new Error(data.error || "Unable to initialize payment session.");
      }

      // 2. Initialize Cashfree SDK with server-matched mode
      const cashfreeMode = data.environment || (data.isProd ? "production" : "sandbox");
      const cashfree = window.Cashfree ? window.Cashfree({ mode: cashfreeMode }) : null;

      if (!cashfree) {
        throw new Error("Cashfree SDK failed to initialize. Please refresh the page.");
      }

      // 3. Launch Checkout Drop-in
      // Cashfree will redirect directly to https://portal.xylemlearning.online/
      cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_self"
      });

    } catch (err) {
      setErrorMessage(err.message || "Checkout failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="checkout-container max-w-xl mx-auto p-6 bg-white rounded-2xl border border-slate-200 shadow-sm my-8">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Select Your Item</h2>

      {/* Dynamic Product Grid / Selector */}
      <div className="product-selector space-y-2">
        {products.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedProduct(item)}
            className={`product-card p-3 cursor-pointer rounded-xl border transition-all ${
              selectedProduct?.id === item.id
                ? "border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500/20"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
            <p className="text-xs font-semibold text-emerald-700 mt-0.5">Price: ₹{item.price}</p>
          </div>
        ))}
      </div>

      {/* Checkout Form */}
      {selectedProduct && (
        <form onSubmit={handlePayment} style={{ marginTop: "24px" }} className="space-y-3">
          <div className="form-group">
            <label className="block text-xs font-bold text-slate-700 mb-1">Name</label>
            <input
              type="text"
              name="customerName"
              required
              value={formData.customerName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="form-group">
            <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              name="customerEmail"
              required
              value={formData.customerEmail}
              onChange={handleInputChange}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="form-group">
            <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
            <input
              type="tel"
              name="customerPhone"
              required
              pattern="[0-9]{10}"
              placeholder="10 digit phone number"
              value={formData.customerPhone}
              onChange={handleInputChange}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
            />
          </div>

          {errorMessage && <p style={{ color: "red" }} className="text-xs">{errorMessage}</p>}

          {/* Button dynamically displays and charges the exact amount */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "16px",
              width: "100%",
              padding: "12px",
              background: "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading
              ? "Connecting to Payment..."
              : `Pay ₹${selectedProduct.price} for ${selectedProduct.title}`}
          </button>
        </form>
      )}
    </div>
  );
}
