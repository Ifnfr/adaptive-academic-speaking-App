import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in process.env");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

async function main() {
  console.log("Checking buckets...");
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("Error listing buckets:", listError);
    process.exit(1);
  }

  const existing = buckets.find((b) => b.name === "listening-audio");
  if (existing) {
    console.log(`Bucket "listening-audio" already exists. Public: ${existing.public}. File size limit: ${existing.file_size_limit}`);
  } else {
    console.log(`Bucket "listening-audio" does not exist. Creating...`);
    const { data, error } = await supabase.storage.createBucket("listening-audio", {
      public: false, // private - access via signed URLs only
      fileSizeLimit: 10485760, // 10MB limit per file
    });

    if (error) {
      console.error("Error creating bucket:", error);
      process.exit(1);
    }
    console.log("Bucket created successfully:", data);
  }
}

main().catch(console.error);
