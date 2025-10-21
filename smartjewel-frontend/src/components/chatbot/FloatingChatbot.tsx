import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, Transition, Variant } from 'framer-motion';
import { api } from '../../api';
import { useAuth } from '../../contexts/AuthContext';

type ChatRole = 'bot' | 'user' | 'system';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
}

type QuickAction = {
  label: string;
  prompt: string;
};

const LUX_GOLD = 'var(--brand-gold)';
const LUX_BURGUNDY = 'var(--brand-burgundy)';

const BOT_WELCOME = "Hi there ✨ I'm your Jewellery Expert Assistant. I can help you find the perfect jewelry, explain gold purity, recommend care tips, and assist with orders. What would you like to know about our jewelry collection?";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Custom hook for user-specific localStorage
function useUserLocalStorage<T>(key: string, initial: T, userId: string | null) {
  const userKey = userId ? `${key}_${userId}` : `${key}_guest`;
  
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(userKey);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(userKey, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [userKey, value]);

  return [value, setValue] as const;
}

const quickActions: QuickAction[] = [
  { label: 'Diamond Engagement Rings', prompt: 'Show me diamond engagement rings under ₹100000' },
  { label: 'Gold Rate Today', prompt: 'What is today\'s gold rate?' },
  { label: 'Ring Size Guide', prompt: 'How do I measure my ring size?' },
  { label: 'My Recent Orders', prompt: 'Show my recent orders' },
];

const bubbleVariants: { [key: string]: Variant } = {
  initial: { scale: 0.9, opacity: 0, y: 8 },
  animate: { scale: 1, opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 18 } },
  hover: { scale: 1.05, y: -2 },
};

const panelVariants: { [key: string]: Variant } = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: 'easeOut' as const } },
  exit: { opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.16, ease: 'easeIn' as const } },
};

const messageVariants: { [key: string]: Variant } = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
};

export const FloatingChatbot: React.FC = () => {
  const { user } = useAuth();
  
  const [isOpen, setIsOpen] = useUserLocalStorage<boolean>('sj_chat_is_open', false, user?.id || null);
  const [messages, setMessages] = useUserLocalStorage<ChatMessage[]>('sj_chat_conversation', [
    { id: uid(), role: 'bot', text: BOT_WELCOME, createdAt: Date.now() },
  ], user?.id || null);
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Reset chat when user changes
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentUserId = user?.id || null;
    const prevUserId = prevUserIdRef.current;
    
    // If user changed, reset to welcome message
    if (prevUserId !== currentUserId) {
      setMessages([
        { id: uid(), role: 'bot', text: BOT_WELCOME, createdAt: Date.now() },
      ]);
    }
    
    prevUserIdRef.current = currentUserId;
  }, [user, setMessages]);

  const scrollToBottom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isOpen, scrollToBottom]);

  const handleToggle = () => setIsOpen(!isOpen);

  const pushUserMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: uid(), role: 'user', text, createdAt: Date.now() }]);
  };

  // Fetch latest cached gold rate from backend
  const getGoldRate = async () => {
    try {
      const { data } = await api.get('/market/gold-rate');
      const rates = data?.rates || {} as Record<string, number>;
      const upd = data?.updated_at as string | undefined;
      const fmt = (n?: number) => typeof n === 'number' ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/g` : 'N/A';
      const lines = [
        `24K: ${fmt(rates['24k'])}`,
        `22K: ${fmt(rates['22k'])}`,
        `18K: ${fmt(rates['18k'])}`,
        `14K: ${fmt(rates['14k'])}`,
      ].join('\n');
      const updated = upd ? `\nUpdated: ${new Date(upd).toLocaleString('en-IN')}` : '';
      return `Current gold rates (per gram)\n${lines}${updated}\n\nFor the most accurate pricing on jewellery, please visit our store or website as making charges may apply.`;
    } catch (e) {
      return null;
    }
  };

  const pushBotMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: uid(), role: 'bot', text, createdAt: Date.now() }]);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    // Only check if input is empty after trimming, but send the original input
    if (!input.trim()) return;
    const originalInput = input;
    setInput('');
    pushUserMessage(originalInput);
    await respond(originalInput);
  };

  // Test function to verify input handling
  const handleInputChange = (value: string) => {
    setInput(value);
  };

  const handleQuick = async (prompt: string) => {
    pushUserMessage(prompt);
    await respond(prompt);
  };

  const parseOrderId = (text: string): string | null => {
    // Accept patterns like SJ-12345 or bare numbers with length >= 5
    const sj = text.match(/\bSJ[-_ ]?(\w{4,})\b/i);
    if (sj) return `SJ-${sj[1].toUpperCase()}`;
    
    // First try to match MongoDB ObjectId pattern (24 hex characters)
    const objectId = text.match(/\b([0-9a-fA-F]{24})\b/);
    if (objectId) return objectId[1];
    
    // Then try alphanumeric sequences of 5 or more characters
    const alphanum = text.match(/\b([a-zA-Z0-9]{5,})\b/);
    if (alphanum) return alphanum[1];
    
    // Finally try numeric sequences of 5 or more digits
    const num = text.match(/\b(\d{5,})\b/);
    if (num) return num[1];
    
    return null;
  };

  const trackOrder = async (orderId: string) => {
    try {
      const { data } = await api.get(`/api/orders/track/${encodeURIComponent(orderId)}`);
      return data;
    } catch (err: unknown) {
      return { error: true };
    }
  };

  // New function to send messages to the GenAI chat endpoint
  const sendToAI = async (message: string) => {
    try {
      // Include more context about the user's browsing session
      const pageInfo = `User is currently on: ${window.location.pathname}`;
      
      // Include recent search history if available
      const recentSearches = messages.filter(m => m.role === 'user').slice(-3).map(m => m.text).join('; ');
      const searchContext = recentSearches ? `Recent user searches: ${recentSearches}` : '';
      
      // Enhanced message with context
      const enhancedMessage = `${message}\n\nContext: ${pageInfo}${searchContext ? `\n${searchContext}` : ''}`;
      
      const history = messages.slice(-6).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));
      const response = await api.post('/catalog/chat', { message: enhancedMessage, history });
      return response.data.reply;
    } catch (error) {
      console.error('AI chat error:', error);
      return "I'm sorry, I'm having trouble processing your request right now. Please try again later.";
    }
  };

  const recommendFromPrompt = (text: string) => {
    const wantsDiamond = /diamond/i.test(text);
    const wantsGold = /\b(18k|22k|24k|gold)\b/i.test(text);
    const wantsPlatinum = /platinum/i.test(text);
    const wantsSilver = /silver/i.test(text);
    const wantsNecklace = /necklace|necklaces|mala|haram|chain/i.test(text);
    const wantsRing = /ring|rings|band/i.test(text);
    const wantsBangle = /bangle|kada|bracelet/i.test(text);
    const wantsEarring = /earring|stud|jhumka/i.test(text);
    const wantsPendant = /pendant/i.test(text);
    const wantsMangalsutra = /mangalsutra/i.test(text);
    const wantsNosePin = /nose[-\s]pin/i.test(text);
    const budgetMatch = /(under|below|upto|up to)\s*₹?\s*([\d,]+)/i.exec(text) || /₹\s*([\d,]+)\s*budget/i.exec(text);
    const budget = budgetMatch ? parseInt(budgetMatch[2].replace(/,/g, '')) : undefined;

    const items: string[] = [];
    if (wantsDiamond && wantsRing) items.push('Solitaire Diamond Ring DR-201');
    if (wantsDiamond && wantsNecklace) items.push('Elegant Diamond Necklace DN-102');
    if (wantsGold && wantsRing) items.push('22K Gold Ring GR-221');
    if (wantsGold && wantsBangle) items.push('Traditional 22K Gold Bangle GB-145');
    if (wantsGold && wantsNecklace) items.push('Exquisite Gold Haram GH-305');
    if (wantsEarring) items.push('Minimal Gold Stud Earrings ER-118');
    if (wantsMangalsutra) items.push('Diamond Mangalsutra MM-402');
    if (wantsNosePin) items.push('Traditional Gold Nose Pin NP-501');
    if (wantsPlatinum && wantsRing) items.push('Platinum Wedding Band PB-601');
    if (wantsSilver && wantsEarring) items.push('Silver Jhumka Earrings SE-702');
    if (!items.length) items.push('Classic Gold Pendant PN-310', 'Everyday Gold Chain CH-032');

    const budgetLine = budget ? ` within your budget of ₹${budget.toLocaleString('en-IN')}` : '';
    const query = encodeURIComponent(text);
    const link = `${window.location.origin}/products?query=${query}`;
    return `Here are a few curated picks${budgetLine}:
• ${items.join('\n• ')}
Browse our full collection here → ${link}`;
  };

  const faqAnswer = (text: string): string | null => {
    // Always return null to disable FAQ-based responses
    return null;
  };

  const respond = useCallback(async (text: string) => {
    setIsTyping(true);

    const trimmed = text.trim();
    if (!trimmed) {
      setIsTyping(false);
      return;
    }

    const lower = trimmed.toLowerCase();

    // Order cancellation
    const cancelMatch = lower.match(/cancel.*(?:order|ord)\D*(\d{4,})/i) || 
                       lower.match(/cancel\D*(\d{4,})/i);
    if (cancelMatch) {
      const orderId = cancelMatch[1];
      pushBotMessage(`To cancel your order ${orderId}, please visit your Orders page and click the 'Cancel Order' button. If you need help with that, I can guide you through the process.`);
      setIsTyping(false);
      return;
    }

    // Order tracking
    const orderId = parseOrderId(trimmed);
    if ((/track|status|where.*order/.test(lower)) && orderId) {
      const data = await trackOrder(orderId);
      setIsTyping(false);
      if (data && !data.error) {
        const status = data.status || 'Processing';
        const eta = data.eta ? ` ETA: ${data.eta}` : '';
        pushBotMessage(`Order ${orderId}: ${status}.${eta}`);
      } else {
        pushBotMessage(`I couldn't find details for ${orderId}. Please check the ID and try again.`);
      }
      return;
    }

    // Show recent orders
    if (lower.includes('recent orders') || lower.includes('my orders') || lower.includes('order history')) {
      setIsTyping(true);
      const orders = await getRecentOrders();
      const response = formatOrderHistory(orders);
      setIsTyping(false);
      pushBotMessage(response);
      return;
    }

    const words = trimmed.split(/\s+/);
    const productIntent = /(product|item|sku|show|find|recommend|suggest|looking for|want)/.test(lower) || 
                         (/(ring|necklace|bangle|bracelet|chain|earring|pendant|stud|mangalsutra|nose pin|anklet|diamond|platinum|silver)/i.test(lower) && !/^gold\s*$/i.test(trimmed));
    if (productIntent) {
      try {
        // Extract key terms for better search
        const searchTerms = trimmed.replace(/(show|find|recommend|suggest|looking for|want|me)/gi, '').trim();
        
        const { data } = await api.get('/catalog/search', {
          params: {
            q: searchTerms,
            page: 1,
            per_page: 5,
          },
        });

        const results: Array<{ _id?: string; name?: string; sku?: string; price?: number; category?: string; metal?: string }> = data?.results || [];
        if (results.length) {
          const formatProductLine = (product: { _id?: string; name?: string; sku?: string; price?: number; category?: string; metal?: string }) => {
            const name = product.name || product.sku || 'Product';
            const sku = product.sku ? ` (SKU: ${product.sku})` : '';
            const category = product.category ? ` ${product.category}` : '';
            const metal = product.metal ? ` ${product.metal}` : '';
            const price = typeof product.price === 'number' ? ` - ₹${product.price.toLocaleString('en-IN')}` : '';
            const id = product._id || product.sku;
            const link = id ? `${window.location.origin}/products?highlight=${encodeURIComponent(id)}` : `${window.location.origin}/products`;
            return `${name}${category}${metal}${sku}${price} → ${link}`;
          };

          const message = `Here are the top ${results.length} matches I found:\n${results
            .slice(0, 5)
            .map((product, index) => `${index + 1}. ${formatProductLine(product)}`)
            .join('\n')}`;

          pushBotMessage(message);
          setIsTyping(false);
          return;
        }

        pushBotMessage("I couldn't find a matching product. Please try a different description or browse our full collection on our website.");
        setIsTyping(false);
        return;
      } catch (error) {
        console.error('Product search failed:', error);
        pushBotMessage("I'm sorry, I couldn't access the product catalog right now. Please try again shortly.");
        setIsTyping(false);
        return;
      }
    }

    // Gold rate live fetch - moved before FAQ to handle gold price queries properly
    if (/(gold\s*rate|gold\s*price|today'?s\s*gold|price.*gold.*1\s*gram|1\s*gram.*gold.*price|price.*1\s*gram.*gold|1\s*gram.*price.*gold|what.*price.*1\s*gram.*gold|what.*gold.*price|how\s*much.*1\s*gram.*gold|how\s*much.*gold.*1\s*gram)/i.test(lower)) {
      const info = await getGoldRate();
      if (info) {
        pushBotMessage(info);
      } else {
        // Fallback to AI if we can't fetch the rate
        const aiResponse = await sendToAI(trimmed);
        pushBotMessage(aiResponse || 'I could not fetch the live rate right now. Please try again shortly or check our gold rate page.');
      }
      setIsTyping(false);
      return;
    }

    // Product style/budget recommendations
    const wantsSuggest = /(suggest|recommend|ideas|options)/i.test(trimmed) || /(under|below|upto|up to)\s*₹?\s*[\d,]+/i.test(trimmed);
    if (wantsSuggest) {
      pushBotMessage(recommendFromPrompt(trimmed));
      setIsTyping(false);
      return;
    }

    // Use GenAI for all other queries with jewellery prompt
    const aiResponse = await sendToAI(trimmed);
    setIsTyping(false);
    
    // Check if the response is meaningful
    if (aiResponse && aiResponse.length > 10 && !aiResponse.toLowerCase().includes("i'm sorry") && !aiResponse.toLowerCase().includes("having trouble")) {
      pushBotMessage(aiResponse);
    } else {
      // Provide a more helpful fallback response
      pushBotMessage("I'd be happy to help you with jewelry questions! I can assist with product recommendations, gold rates, ring sizing, care tips, and order tracking. Could you please be more specific about what you're looking for?");
    }
  }, []);

  const Avatar: React.FC<{ role: ChatRole }> = ({ role }) => {
    const isBot = role !== 'user';
    return (
      <div className={`flex items-center justify-center w-8 h-8 rounded-full shadow`} style={{
        background: isBot ? `linear-gradient(135deg, ${LUX_GOLD}, #f59e0b)` : '#e5e7eb',
        color: isBot ? '#fff' : '#111827',
      }}>
        {isBot ? (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ) : '🧑'}
      </div>
    );
  };

  const Message: React.FC<{ m: ChatMessage }> = ({ m }) => {
    const isUser = m.role === 'user';
    return (
      <motion.div
        variants={messageVariants}
        initial="hidden"
        animate="visible"
        className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
      >
        {!isUser && <Avatar role={m.role} />}
        <div className={`${isUser ? 'bg-amber-50 text-gray-900' : 'bg-white text-gray-800'} max-w-[78%] px-3 py-2 rounded-2xl shadow-sm border ${isUser ? 'border-amber-200' : 'border-gray-100'}`}>
          <div className="whitespace-pre-wrap leading-relaxed text-[13px]">{m.text}</div>
        </div>
        {isUser && <Avatar role={m.role} />}
      </motion.div>
    );
  };

  // Function to fetch user's recent orders
  const getRecentOrders = async () => {
    try {
      const { data } = await api.get('/api/orders/my-orders');
      return data?.orders || [];
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      return [];
    }
  };

  // Function to format order history response
  const formatOrderHistory = (orders: any[]) => {
    if (!orders.length) {
      return "You don't have any orders yet. When you place an order, it will appear here.";
    }
    
    const recentOrders = orders.slice(0, 5); // Get last 5 orders
    const orderLines = recentOrders.map((order: any) => {
      const orderId = order.orderId?.substring(0, 8) + '...';
      const amount = typeof order.amount === 'number' ? `₹${order.amount.toLocaleString('en-IN')}` : 'N/A';
      const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : 'N/A';
      
      // Get latest status
      let status = 'Processing';
      if (order.statusHistory && order.statusHistory.length > 0) {
        status = order.statusHistory[order.statusHistory.length - 1].status || status;
      } else if (order.status) {
        status = order.status;
      }
      
      return `• Order #${orderId} (${date}) - ${amount} [${status}]`;
    });
    
    const ordersList = orderLines.join('\n');
    return `Here are your recent orders:\n${ordersList}\n\nTo track a specific order, please provide the full order ID.`;
  };

  return (
    <div className="fixed z-[60] bottom-5 right-5">
      {/* Floating Bubble */}
      <motion.button
        initial="initial"
        animate="animate"
        whileHover="hover"
        variants={bubbleVariants}
        onClick={handleToggle}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        className="relative w-14 h-14 rounded-full shadow-2xl text-white focus:outline-none focus:ring-2 focus:ring-amber-300"
        style={{ backgroundColor: LUX_GOLD }}
      >
        <span className="absolute -top-2 -right-2 px-2 py-0.5 text-[10px] rounded-full text-white shadow" style={{ backgroundColor: LUX_BURGUNDY }}>AI</span>
        {/* Chat bubble icon */}
        <svg viewBox="0 0 24 24" className="w-7 h-7 mx-auto" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chatpanel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute bottom-20 right-0 w-[360px] max-h-[70vh] bg-white border border-gray-200 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,.18)] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: LUX_GOLD }} />
                <div>
                  <div className="text-[13px] font-semibold text-gray-900">Jewellery Assistant</div>
                  <div className="text-[11px] text-gray-600">Online</div>
                </div>
              </div>
              <button className="text-gray-700 hover:text-gray-900" onClick={handleToggle} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
              </button>
            </div>

            {/* Messages */}
            <div ref={viewportRef} className="px-3 py-3 bg-white flex-grow overflow-y-auto" style={{ maxHeight: '45vh' }}>
              <div className="flex flex-col gap-3 pb-2">
                {messages.map((m) => (
                  <Message key={m.id} m={m} />
                ))}
                <AnimatePresence>
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="flex items-center gap-2"
                    >
                      <Avatar role="bot" />
                      <div className="px-3 py-2 rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse [animation-delay:120ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse [animation-delay:240ms]" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Quick actions */}
            <div className="px-3 pb-2 bg-white">
              <div className="flex flex-wrap gap-2">
                {quickActions.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => handleQuick(qa.prompt)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-amber-200 bg-white text-gray-700 hover:bg-amber-50 transition"
                  >{qa.label}</button>
                ))}
              </div>
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t border-amber-200 bg-white p-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder={input ? "" : "Ask about products, care, or track: SJ-12345"}
                  className="flex-1 text-[13px] px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
                  onKeyDown={(e) => {
                    // Handle Enter key for form submission
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                    // Ensure space and other keys work normally
                    // Do not preventDefault for other keys
                  }}
                />
                <button
                  type="submit"
                  className="px-3 h-9 rounded-xl text-white shadow"
                  style={{ backgroundColor: LUX_GOLD }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path></svg>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingChatbot;