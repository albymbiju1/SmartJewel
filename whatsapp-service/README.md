# WhatsApp Service - SmartJewel

Node.js microservice for WhatsApp automation using `whatsapp-web.js`.

## Quick Start

```bash
# Install dependencies
npm install

# Start service
npm start
```

## Features

- ✅ Maintain WhatsApp session using LocalAuth
- ✅ QR code display in terminal for first-time setup
- ✅ Automatic phone number formatting (10-digit → +91XXXXXXXXXX)
- ✅ REST API endpoints for sending messages
- ✅ Session persistence (no need to scan QR every time)

## Endpoints

### GET /health
Check if WhatsApp client is ready.

**Response:**
```json
{
  "success": true,
  "ready": true,
  "message": "WhatsApp service is ready"
}
```

### POST /send/register
Send registration confirmation message.

**Request:**
```json
{
  "name": "John Doe",
  "phone": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration message sent successfully",
  "data": {
    "name": "John Doe",
    "phone": "919876543210@c.us"
  }
}
```

### POST /send/order
Send order confirmation message.

**Request:**
```json
{
  "name": "Jane Smith",
  "phone": "9123456789",
  "orderId": "ORD123456",
  "items": [
    {
      "name": "Gold Necklace",
      "price": 45000,
      "quantity": 1
    }
  ],
  "total": 45000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order confirmation sent successfully",
  "data": {
    "name": "Jane Smith",
    "phone": "919123456789@c.us",
    "orderId": "ORD123456"
  }
}
```

## Phone Number Format

- Input: 10-digit Indian number (e.g., `9876543210`)
- Automatically converted to: `919876543210@c.us`
- Supports any country code if provided (e.g., `449876543210`)

## Tech Stack

- Node.js + Express
- whatsapp-web.js (WhatsApp Web automation)
- qrcode-terminal (QR code display)

## Notes

- First run: Scan QR code with WhatsApp
- Subsequent runs: Auto-login (session saved in `.wwebjs_auth`)
- Use normal WhatsApp account (not Business API)
- Runs on port 3300 by default
