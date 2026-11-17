"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Check, AlertCircle, X } from "lucide-react";

const GUEST_TOKEN_STORAGE_KEY = "aura_guest_token";

export function getStoredGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(GUEST_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveStoredGuestToken(token: string | null | undefined) {
  if (typeof window === "undefined" || !token) return;
  try {
    window.localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore storage quota errors
  }
}

export function getGuestTokenHeaders(
  extra?: Record<string, string>
): Record<string, string> {
  const token = getStoredGuestToken();
  return {
    ...(extra || {}),
    ...(token ? { "x-aura-guest-token": token } : {}),
  };
}

export interface CartItemClient {
  id: number;
  productId: number;
  slug: string;
  genderSlug: string;
  genderName?: string;
  name: string;
  sku: string;
  image: string;
  variantLabel: string;
  quantity: number;
  stockQuantity: number;
  originalPrice: number;
  unitPrice: number;
  lineTotal: number;
  hasDiscount: boolean;
  promotionName: string | null;
}

export interface CartState {
  guestToken?: string | null;
  items: CartItemClient[];
  itemCount: number;
  subtotalIqd: number;
  discountIqd: number;
  shippingIqd: number;
  totalIqd: number;
  freeShippingThresholdIqd: number;
  shippingFeeIqd: number;
  remainingForFreeShipping: number;
}

interface ToastMessage {
  id: number;
  text: string;
  type: "success" | "error";
}

interface StoreContextValue {
  genderSlug: string;
  cart: CartState;
  wishlistIds: number[];
  isCartOpen: boolean;
  isSearchOpen: boolean;
  setCartOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  refreshCart: () => Promise<void>;
  addToCart: (
    productId: number,
    quantity?: number,
    variantLabel?: string,
    openDrawer?: boolean
  ) => Promise<boolean>;
  updateCartQty: (itemId: number, quantity: number) => Promise<void>;
  removeCartItem: (itemId: number) => Promise<void>;
  toggleWishlist: (productId: number) => Promise<void>;
  isWishlisted: (productId: number) => boolean;
  showToast: (text: string, type?: "success" | "error") => void;
}

const emptyCart: CartState = {
  items: [],
  itemCount: 0,
  subtotalIqd: 0,
  discountIqd: 0,
  shippingIqd: 0,
  totalIqd: 0,
  freeShippingThresholdIqd: 25000,
  shippingFeeIqd: 3000,
  remainingForFreeShipping: 25000,
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({
  genderSlug,
  children,
}: {
  genderSlug: string;
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState<CartState>(emptyCart);
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [isCartOpen, setCartOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const cartRevision = useRef(0);
  const cartMutationQueue = useRef<Promise<void>>(Promise.resolve());

  const queueCartMutation = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    cartRevision.current += 1;
    const next = cartMutationQueue.current.then(async () => {
      try {
        return await operation();
      } finally {
        cartRevision.current += 1;
      }
    });
    cartMutationQueue.current = next.then(() => {}, () => {});
    return next;
  }, []);

  const showToast = useCallback(
    (text: string, type: "success" | "error" = "success") => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, text, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3400);
    },
    []
  );

  const refreshCart = useCallback(async () => {
    const revision = cartRevision.current;
    try {
      const res = await fetch("/api/store/cart", {
        cache: "no-store",
        headers: getGuestTokenHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (revision !== cartRevision.current) return;
        if (data.guestToken) saveStoredGuestToken(data.guestToken);
        setCart(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshWishlist = useCallback(async () => {
    try {
      const res = await fetch("/api/store/wishlist", {
        cache: "no-store",
        headers: getGuestTokenHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setWishlistIds(data.allIds || data.ids || []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Refresh shared cross-gender cart & wishlist on mount and whenever switching gender
  useEffect(() => {
    refreshCart();
    refreshWishlist();
    setSearchOpen(false);
  }, [genderSlug, refreshCart, refreshWishlist]);

  const addToCart = useCallback(
    async (
      productId: number,
      quantity = 1,
      variantLabel = "",
      openDrawer = true
    ) => queueCartMutation(async () => {
      const totalStart = performance.now();
      try {
        const postStart = performance.now();
        let res: Response;
        try {
          res = await fetch("/api/store/cart", {
            method: "POST",
            headers: getGuestTokenHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ productId, quantity, variantLabel }),
          });
        } finally {
          console.info("CART_CLIENT_POST_MS", Math.round(performance.now() - postStart));
        }
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || "تعذر إضافة المنتج إلى السلة.", "error");
          return false;
        }
        if (data.cart?.guestToken) saveStoredGuestToken(data.cart.guestToken);
        setCart(data.cart);
        showToast(data.message || "تمت الإضافة إلى السلة بنجاح.");
        if (openDrawer) setCartOpen(true);
        return true;
      } catch {
        showToast("حدث خطأ في الاتصال، يرجى المحاولة مجددًا.", "error");
        return false;
      } finally {
        console.info("CART_TOTAL_MS", Math.round(performance.now() - totalStart));
      }
    }),
    [queueCartMutation, showToast]
  );

  const updateCartQty = useCallback(
    (itemId: number, quantity: number) => queueCartMutation(async () => {
      try {
        const res = await fetch("/api/store/cart", {
          method: "PATCH",
          headers: getGuestTokenHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ itemId, quantity }),
        });
        const data = await res.json();
        if (res.ok && data.cart) {
          if (data.cart.guestToken) saveStoredGuestToken(data.cart.guestToken);
          setCart(data.cart);
        }
      } catch {
        showToast("تعذر تحديث الكمية.", "error");
      }
    }),
    [queueCartMutation, showToast]
  );

  const removeCartItem = useCallback(
    (itemId: number) => queueCartMutation(async () => {
      try {
        const res = await fetch(`/api/store/cart?itemId=${itemId}`, {
          method: "DELETE",
          headers: getGuestTokenHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.cart) {
          if (data.cart.guestToken) saveStoredGuestToken(data.cart.guestToken);
          setCart(data.cart);
          showToast("تمت إزالة المنتج من السلة.");
        } else {
          showToast(data.error || "تعذر إزالة المنتج.", "error");
        }
      } catch {
        showToast("تعذر إزالة المنتج.", "error");
      }
    }),
    [queueCartMutation, showToast]
  );

  const toggleWishlist = useCallback(
    async (productId: number) => {
      try {
        const res = await fetch("/api/store/wishlist", {
          method: "POST",
          headers: getGuestTokenHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ productId }),
        });
        const data = await res.json();
        if (res.ok) {
          if (data.guestToken) saveStoredGuestToken(data.guestToken);
          setWishlistIds(data.allIds || []);
          showToast(data.message);
        } else {
          showToast(data.error || "تعذر تحديث المفضلة.", "error");
        }
      } catch {
        showToast("حدث خطأ في الاتصال.", "error");
      }
    },
    [showToast]
  );

  const isWishlisted = useCallback(
    (productId: number) => wishlistIds.includes(productId),
    [wishlistIds]
  );

  return (
    <StoreContext.Provider
      value={{
        genderSlug,
        cart,
        wishlistIds,
        isCartOpen,
        isSearchOpen,
        setCartOpen,
        setSearchOpen,
        refreshCart,
        addToCart,
        updateCartQty,
        removeCartItem,
        toggleWishlist,
        isWishlisted,
        showToast,
      }}
    >
      {children}

      {/* Luxury Arabic Toasts */}
      <div
        aria-live="polite"
        className="fixed bottom-5 left-5 z-[100] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2.5rem)] pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-sm shadow-xl border backdrop-blur-md text-sm animate-aura-fade-up ${
              toast.type === "error"
                ? "bg-[#111111] text-[#F7F4EF] border-rose-500/40"
                : "bg-[#111111] text-[#F7F4EF] border-[#B79B6C]/40"
            }`}
          >
            {toast.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-[#B79B6C] shrink-0" />
            )}
            <span className="flex-1 leading-relaxed">{toast.text}</span>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((t) => t.id !== toast.id))
              }
              aria-label="إغلاق الإشعار"
              className="text-[#D8C8B5]/70 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useStore must be used inside StoreProvider");
  }
  return ctx;
}
