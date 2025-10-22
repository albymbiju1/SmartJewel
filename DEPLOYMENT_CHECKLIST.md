# SmartJewel Deployment Checklist

This checklist ensures your application is properly configured for production deployment.

---

## ✅ Backend Deployment (Vercel)

### 1. Environment Variables in Vercel Dashboard

Make sure ALL of these are set in Vercel → Settings → Environment Variables:

| Variable | Description | Example/Required |
|----------|-------------|------------------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/smartjewel` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-key-change-this` |
| `MISTRAL_API_KEY` | Mistral AI API key for chatbot | `your-mistral-api-key` |
| `APP_ENV` | Application environment | `production` |
| `SCHEDULER_ENABLED` | Background job scheduler | `false` (disable in serverless) |
| `CORS_ORIGINS` | Allowed frontend URLs | `https://smartjewel-frontend.onrender.com` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | **REQUIRED for image uploads** |
| `CLOUDINARY_API_KEY` | Cloudinary API key | **REQUIRED for image uploads** |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | **REQUIRED for image uploads** |
| `RAZORPAY_KEY_ID` | Razorpay payment key | (if using payments) |
| `RAZORPAY_KEY_SECRET` | Razorpay payment secret | (if using payments) |

### 2. Files to Check

- ✅ `requirements.txt` in **project root** (not in smartjewel-backend/)
- ✅ `vercel.json` configured correctly
- ✅ `api/index.py` entry point exists

### 3. After Adding Cloudinary Variables

1. Go to Vercel dashboard
2. Click **Redeploy** (Deployments → ⋯ → Redeploy)
3. Wait for deployment to complete
4. Check deployment logs for any errors

---

## ✅ Frontend Deployment (Render)

### 1. Environment Variables in Render Dashboard

Make sure these are set in Render → Environment:

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_API_BASE` | `https://smart-jewel.vercel.app` | ✅ Yes |
| `VITE_FIREBASE_API_KEY` | Your Firebase API key | ✅ Yes |
| `VITE_FIREBASE_AUTH_DOMAIN` | `smartjewel-7e125.firebaseapp.com` | ✅ Yes |
| `VITE_FIREBASE_PROJECT_ID` | `smartjewel-7e125` | ✅ Yes |
| `VITE_FIREBASE_STORAGE_BUCKET` | `smartjewel-7e125.appspot.com` | ✅ Yes |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your sender ID | ✅ Yes |
| `VITE_FIREBASE_APP_ID` | Your app ID | ✅ Yes |

### 2. Build Settings

- **Root Directory**: `smartjewel-frontend`
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`

### 3. After Deployment

1. Get your frontend URL (e.g., `https://smartjewel-frontend.onrender.com`)
2. Add it to backend's `CORS_ORIGINS` in Vercel
3. Redeploy backend

---

## ✅ Firebase Console Configuration

### 1. Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `smartjewel-7e125`
3. Go to **Authentication** → **Sign-in method**
4. Ensure **Google** is **Enabled**

### 2. Authorized Domains

1. In Authentication settings, go to **Authorized domains** tab
2. Add your production domain:
   - `smartjewel-frontend.onrender.com`
3. Click **Add domain**

---

## ✅ Cloudinary Setup

### 1. Create Account

1. Sign up at [cloudinary.com](https://cloudinary.com/users/register/free)
2. Verify email
3. Get your credentials from dashboard

### 2. Configure Backend

Add to Vercel environment variables:
```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 3. Test Upload

1. Go to admin inventory
2. Upload an image to a product
3. Check Cloudinary dashboard → Media Library
4. Image should appear there

---

## ✅ Testing Checklist

After deployment, test these features:

### Frontend
- [ ] Homepage loads correctly
- [ ] Products page displays (even if no images yet)
- [ ] Google Sign-In works
- [ ] Navigation works
- [ ] No console errors

### Backend
- [ ] API responds at `https://smart-jewel.vercel.app/`
- [ ] Authentication works
- [ ] Products endpoint returns data
- [ ] CORS allows frontend requests

### Image Upload
- [ ] Admin can upload images
- [ ] Images appear in Cloudinary dashboard
- [ ] Images display on product pages
- [ ] Image URLs are Cloudinary URLs (not localhost)

### Database
- [ ] MongoDB connection works
- [ ] Data persists correctly
- [ ] No connection errors in logs

---

## 🚨 Common Issues & Fixes

### "Failed to update item" when uploading images
- **Cause**: Cloudinary not configured
- **Fix**: Add CLOUDINARY_* variables to Vercel and redeploy

### Images not loading
- **Cause**: VITE_API_BASE not set correctly
- **Fix**: Check Render environment variables, ensure it points to `https://smart-jewel.vercel.app`

### CORS errors
- **Cause**: Frontend URL not in CORS_ORIGINS
- **Fix**: Add `https://smartjewel-frontend.onrender.com` to CORS_ORIGINS in Vercel, redeploy backend

### Google Sign-In fails
- **Cause**: Domain not authorized in Firebase
- **Fix**: Add production domain to Firebase Console → Authentication → Authorized domains

### Database connection fails
- **Cause**: MONGODB_URI not set or incorrect
- **Fix**: Ensure MONGODB_URI points to cloud MongoDB (not localhost)

---

## 📝 Deployment Commands

### Deploy Backend (Vercel)
```bash
git add .
git commit -m "Update backend"
git push
# Vercel auto-deploys from Git
```

### Deploy Frontend (Render)
```bash
git add .
git commit -m "Update frontend"
git push
# Render auto-deploys from Git
```

### Check Deployment Status
- **Vercel**: [https://vercel.com/dashboard](https://vercel.com/dashboard)
- **Render**: [https://dashboard.render.com/](https://dashboard.render.com/)

---

## ✅ Final Verification

Before going live, verify:

1. ✅ Backend responds at production URL
2. ✅ Frontend loads at production URL
3. ✅ Can sign in with Google
4. ✅ Products display correctly
5. ✅ Can upload images (admin only)
6. ✅ Images load on product pages
7. ✅ No console errors
8. ✅ Mobile responsive
9. ✅ All environment variables set
10. ✅ No hardcoded localhost URLs

---

**Your application is now production-ready!** 🎉
