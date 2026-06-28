import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { getSupabaseAdmin } from '@/lib/supabase';

// ─── Bucket registry ──────────────────────────────────────────────────────────
// Each bucket has a fixed config: whether it's public and what MIME types it
// accepts. Add new buckets here as the app grows.

const BUCKETS = {
  'kyc-documents':      { public: false, accept: ['image/jpeg', 'image/png', 'application/pdf'] },
  'milestone-evidence': { public: true,  accept: ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'] },
  'chat-images':        { public: true,  accept: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] },
} as const;

type BucketName = keyof typeof BUCKETS;

// ─── POST /api/upload?bucket=<name> ──────────────────────────────────────────
// Accepts multipart/form-data with a single `file` field.
// Returns { success: true, url: string } on success.

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  const bucket = req.nextUrl.searchParams.get('bucket') as BucketName | null;

  if (!bucket || !(bucket in BUCKETS)) {
    return NextResponse.json(
      { success: false, error: `Invalid or missing bucket. Valid values: ${Object.keys(BUCKETS).join(', ')}` },
      { status: 400 },
    );
  }

  const config = BUCKETS[bucket];

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ success: false, error: 'No file provided.' }, { status: 400 });
    }

    // MIME type check
    if (!config.accept.includes(file.type as any)) {
      return NextResponse.json(
        { success: false, error: `File type "${file.type}" is not allowed for this bucket. Accepted: ${config.accept.join(', ')}` },
        { status: 415 },
      );
    }

    // Size limits per bucket
    const MAX_SIZES: Record<BucketName, number> = {
      'kyc-documents':      10 * 1024 * 1024, // 10 MB
      'milestone-evidence': 20 * 1024 * 1024, // 20 MB
      'chat-images':         2 * 1024 * 1024, //  2 MB
    };
    if (file.size > MAX_SIZES[bucket]) {
      const mb = (MAX_SIZES[bucket] / 1024 / 1024).toFixed(0);
      return NextResponse.json({ success: false, error: `File exceeds the ${mb} MB limit for this bucket.` }, { status: 413 });
    }

    const supabase = getSupabaseAdmin();
    const ext = file.name.split('.').pop() ?? 'bin';
    const storagePath = `${user!.id}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error(`[upload] Storage error (${bucket}):`, uploadError.message);
      return NextResponse.json(
        { success: false, error: `Storage error: ${uploadError.message}` },
        { status: 500 },
      );
    }

    // Public buckets: return a permanent public URL.
    // Private buckets: return a signed URL valid for 1 hour (for immediate display/confirmation).
    let url: string;
    if (config.public) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      url = data.publicUrl;
    } else {
      const { data, error: signError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 3600);
      if (signError || !data?.signedUrl) {
        return NextResponse.json({ success: false, error: 'Failed to generate signed URL.' }, { status: 500 });
      }
      url = data.signedUrl;
    }

    // For private buckets, also return the raw storage path so callers can
    // store it and generate fresh signed URLs later without re-uploading.
    return NextResponse.json({ success: true, url, storagePath: config.public ? undefined : storagePath });

  } catch (err: any) {
    console.error('[upload] Unexpected error:', err);
    return NextResponse.json({ success: false, error: err.message ?? 'Upload failed.' }, { status: 500 });
  }
}
