# Cloudinary Setup Guide for SmartJewel

This guide will help you set up Cloudinary for production image storage.

## Why Cloudinary?

Vercel (serverless platform) **cannot** store uploaded files persistently. Cloudinary provides:
- ✅ **Permanent cloud storage** for images
- ✅ **Automatic image optimization** (WebP, quality, compression)
- ✅ **CDN delivery** worldwide
- ✅ **Free tier**: 25GB storage + 25GB bandwidth/month

---

## Step 1: Create Cloudinary Account

1. Go to [https://cloudinary.com/users/register/free](https://cloudinary.com/users/register/free)
2. Sign up for a **free account**
3. Verify your email

---

## Step 2: Get Your Credentials

1. After logging in, go to your **Dashboard**
2. You'll see your credentials under "Account Details":
   - **Cloud Name**: e.g., `dxxxxx1234`
   - **API Key**: e.g., `123456789012345`
   - **API Secret**: e.g., `AbCdEfGhIjKlMnOpQrStUv`

---

## Step 3: Add to Local Development (.env)

1. Open `smartjewel-backend/.env` (create if it doesn't exist)
2. Add your Cloudinary credentials:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name-here
CLOUDINARY_API_KEY=your-api-key-here
CLOUDINARY_API_SECRET=your-api-secret-here
```

---

## Step 4: Add to Vercel (Production)

1. Go to your Vercel dashboard
2. Select your **SmartJewel backend project**
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

| Name | Value | Environment |
|------|-------|-------------|
| `CLOUDINARY_CLOUD_NAME` | Your cloud name | Production |
| `CLOUDINARY_API_KEY` | Your API key | Production |
| `CLOUDINARY_API_SECRET` | Your API secret | Production |

5. Click **Save**
6. **Redeploy** your backend

---

## Step 5: Install Cloudinary Package

Run in your backend directory:

```bash
cd smartjewel-backend
pip install cloudinary
```

For production, the package is already added to `requirements.txt` and will be installed automatically during Vercel deployment.

---

## Step 6: Test Image Upload

### Local Development:
1. Start your backend: `python wsgi.py`
2. Go to admin inventory dashboard
3. Try uploading an image to a product
4. Check the Cloudinary dashboard → Media Library to see your uploaded image

### Production (Vercel):
1. Make sure you've added environment variables
2. Redeploy your backend
3. Try uploading an image through your production frontend
4. Image should appear in Cloudinary dashboard

---

## How It Works

### Image Upload Flow:

```
User uploads image
    ↓
Backend checks if Cloudinary is configured
    ↓
If YES (production): Upload to Cloudinary → Store Cloudinary URL in database
    ↓
If NO (local dev): Save to local /static/uploads/ folder
```

### Database Storage:

**With Cloudinary (Production):**
```json
{
  "image": "https://res.cloudinary.com/dxxxxx1234/image/upload/v1234567890/smartjewel/products/product_SKU123.jpg"
}
```

**Without Cloudinary (Local Dev):**
```json
{
  "image": "/static/uploads/abc123-def456.jpg"
}
```

---

## Folder Structure in Cloudinary

Images are organized as:
```
smartjewel/
  └── products/
      ├── product_SKU001.jpg
      ├── product_SKU002.jpg
      └── product_SKU003.jpg
```

---

## Troubleshooting

### ❌ "Image upload not supported in production"
- **Cause**: Cloudinary environment variables not set in Vercel
- **Fix**: Add CLOUDINARY_* variables to Vercel and redeploy

### ❌ "Failed to upload image to Cloudinary"
- **Cause**: Invalid credentials or network issue
- **Fix**: Double-check your credentials in Vercel dashboard

### ❌ Images not loading after upload
- **Cause**: Frontend might be caching old image URLs
- **Fix**: 
  1. Clear browser cache (Ctrl+Shift+Delete)
  2. Hard refresh (Ctrl+F5 or Cmd+Shift+R)

---

## Cloudinary Dashboard

Access your images anytime at:
**[https://cloudinary.com/console/media_library](https://cloudinary.com/console/media_library)**

From here you can:
- View all uploaded images
- Delete unused images
- See usage statistics
- Manage transformations

---

## Free Tier Limits

Cloudinary Free Plan includes:
- ✅ 25 GB storage
- ✅ 25 GB bandwidth/month
- ✅ 25k transformations/month
- ✅ Unlimited uploads

This should be **more than enough** for a jewelry store with hundreds of products.

---

## Questions?

If you encounter any issues:
1. Check Vercel deployment logs
2. Check Cloudinary dashboard for upload errors
3. Check browser console for frontend errors

---

**Setup complete!** Your images will now be stored permanently on Cloudinary instead of temporary local storage. 🎉
