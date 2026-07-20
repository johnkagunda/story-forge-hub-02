# Blog View Tracking Implementation

## ✅ Step 1: Database Migration
- Create `20260718000004_blog_views_unique_constraint.sql`:
  - Add `views INTEGER NOT NULL DEFAULT 0` column to `posts` table
  - Add `UNIQUE(post_id, session_id)` constraint to `post_views`
  - Create composite index `post_views_post_id_session_id_idx`
  - Create `increment_post_views()` SECURITY DEFINER function for atomic view tracking

## ✅ Step 2: Install FingerprintJS
- Ran `npm install @fingerprintjs/fingerprintjs`

## ✅ Step 3: TypeScript Types Update
- Updated `src/integrations/supabase/types.ts`:
  - Added `views` field to `posts` Row/Insert/Update
  - Added `post_views` table definition
  - Added `increment_post_views` RPC function type

## ✅ Step 4: API Route for View Tracking
- Created `src/routes/api.blogs.$slug.view.tsx`:
  - `POST /api/blogs/{slug}/view` endpoint
  - Validates visitorId, rejects empty/invalid
  - Uses `supabaseAdmin` (service role) + `increment_post_views` RPC
  - Returns `{ success: true }` always (no info leakage)
  - Silent error handling

## ✅ Step 5: Frontend View Tracking Hook
- Created `src/lib/useBlogViewTracker.ts`:
  - Uses `useEffect` to fire on mount
  - Dynamically imports FingerprintJS only on blog page
  - Generates visitorId and sends POST request
  - Fails silently

## ✅ Step 6: Blog Page Integration
- Updated `src/routes/posts.$slug.tsx`:
  - Imported `useBlogViewTracker`
  - Called `useBlogViewTracker(slug)` in `PostPage` component

## ✅ Step 7: Admin Dashboard
- Created `src/routes/_authenticated/admin.index.tsx`:
  - Lists all posts with title, date, published status, view count
  - Links to edit page for each post
  - "New Post" button
  - Admin-only access

## ✅ Step 8: Admin Edit Page View Count
- Updated `src/routes/_authenticated/admin.$id.edit.tsx`:
  - Shows view count below the heading (admin only page)

## ✅ Step 9: Header Admin Link
- Updated `src/components/Header.tsx`:
  - Added "Dashboard" menu item in admin dropdown
  - Added `LayoutDashboard` icon import

## ☐ Step 10: Verify Build
- Regenerate route tree
- Run TypeScript compilation check

