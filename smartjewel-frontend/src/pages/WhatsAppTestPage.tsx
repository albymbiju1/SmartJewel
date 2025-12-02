import React, { useState } from 'react';

const FLASK_API_URL = 'http://localhost:5000';

export default function WhatsAppTestPage() {
  const [registerForm, setRegisterForm] = useState({
    name: '',
    phone: '',
    email: ''
  });

  const [purchaseForm, setPurchaseForm] = useState({
    name: '',
    phone: '',
    items: [
      { name: 'Gold Necklace', price: 45000, quantity: 1 }
    ],
    total: 45000
  });

  const [registerResponse, setRegisterResponse] = useState(null);
  const [purchaseResponse, setPurchaseResponse] = useState(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);
    setRegisterResponse(null);

    try {
      const response = await fetch(`${FLASK_API_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerForm),
      });

      const data = await response.json();
      setRegisterResponse(data);
    } catch (error: any) {
      setRegisterResponse({
        success: false,
        error: error.message || 'Network error'
      });
    } finally {
      setRegisterLoading(false);
    }
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPurchaseLoading(true);
    setPurchaseResponse(null);

    try {
      const response = await fetch(`${FLASK_API_URL}/api/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(purchaseForm),
      });

      const data = await response.json();
      setPurchaseResponse(data);
    } catch (error: any) {
      setPurchaseResponse({
        success: false,
        error: error.message || 'Network error'
      });
    } finally {
      setPurchaseLoading(false);
    }
  };

  const addItem = () => {
    setPurchaseForm({
      ...purchaseForm,
      items: [
        ...purchaseForm.items,
        { name: '', price: 0, quantity: 1 }
      ]
    });
  };

  const removeItem = (index: number) => {
    const newItems = purchaseForm.items.filter((_, i) => i !== index);
    const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setPurchaseForm({
      ...purchaseForm,
      items: newItems,
      total: newTotal
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...purchaseForm.items];
    (newItems[index] as any)[field] = value;
    const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setPurchaseForm({
      ...purchaseForm,
      items: newItems,
      total: newTotal
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
        📱 WhatsApp Automation Test
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Register Form */}
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
          <h2>🎉 Register User</h2>
          <form onSubmit={handleRegisterSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Name *</label>
              <input
                type="text"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                placeholder="John Doe"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Phone * (10 digits)</label>
              <input
                type="tel"
                value={registerForm.phone}
                onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                required
                pattern="[0-9]{10}"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                placeholder="9876543210"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Email (optional)</label>
              <input
                type="email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                placeholder="john@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={registerLoading}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: registerLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px'
              }}
            >
              {registerLoading ? 'Registering...' : 'Register & Send WhatsApp'}
            </button>
          </form>

          {registerResponse && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              borderRadius: '4px',
              backgroundColor: registerResponse.success ? '#d4edda' : '#f8d7da',
              border: `1px solid ${registerResponse.success ? '#c3e6cb' : '#f5c6cb'}`
            }}>
              <h3>{registerResponse.success ? '✅ Success' : '❌ Error'}</h3>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(registerResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Purchase Form */}
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
          <h2>💎 Make Purchase</h2>
          <form onSubmit={handlePurchaseSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Name *</label>
              <input
                type="text"
                value={purchaseForm.name}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, name: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                placeholder="John Doe"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Phone * (10 digits)</label>
              <input
                type="tel"
                value={purchaseForm.phone}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, phone: e.target.value })}
                required
                pattern="[0-9]{10}"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                placeholder="9876543210"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Items</label>
              {purchaseForm.items.map((item, index) => (
                <div key={index} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '4px' }}>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                    placeholder="Item name"
                    required
                    style={{ width: '100%', padding: '6px', marginBottom: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value))}
                      placeholder="Price"
                      required
                      style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                      placeholder="Qty"
                      required
                      min="1"
                      style={{ width: '80px', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      style={{ padding: '6px 12px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addItem}
                style={{ padding: '8px 16px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                + Add Item
              </button>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Total: ₹{purchaseForm.total}</label>
            </div>

            <button
              type="submit"
              disabled={purchaseLoading}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#FF9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: purchaseLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px'
              }}
            >
              {purchaseLoading ? 'Processing...' : 'Purchase & Send WhatsApp'}
            </button>
          </form>

          {purchaseResponse && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              borderRadius: '4px',
              backgroundColor: purchaseResponse.success ? '#d4edda' : '#f8d7da',
              border: `1px solid ${purchaseResponse.success ? '#c3e6cb' : '#f5c6cb'}`
            }}>
              <h3>{purchaseResponse.success ? '✅ Success' : '❌ Error'}</h3>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(purchaseResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h3>📋 Instructions:</h3>
        <ol>
          <li>Start WhatsApp service: <code>cd whatsapp-service && npm start</code></li>
          <li>Scan QR code with WhatsApp</li>
          <li>Start Flask backend: <code>cd flask-backend && python app.py</code></li>
          <li>Test registration or purchase forms above</li>
          <li>Check your WhatsApp for messages!</li>
        </ol>
      </div>
    </div>
  );
}
