// backfill.js — Sync existing Supabase clusters to Firebase (enriched format)
const { createClient } = require('@supabase/supabase-js');

// Replace with YOUR Supabase anon key (Project Settings → API)
const SUPABASE_URL = 'https://povyafhclolccsrkazyk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvdnlhZmhjbG9sY2NzcmthenlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNTE3MjUsImV4cCI6MjA3OTYyNzcyNX0.s8aMKjofQnS2J93n2uw7xc_l-LM3yzxU7y0pJOH3HOU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🔗 Your Edge Function URL (from Supabase → Functions)
const EDGE_FN_URL = 'https://povyafhclolccsrkazyk.supabase.co/functions/v1/sync-to-firebase';

async function backfill() {
    console.log('🔍 Fetching existing news from Supabase...');

    const { data, error } = await supabase
        .from('clusters')
        .select('id, set_name, cluster_summary, image_url, created_at, updated_at, slug')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('❌ Supabase fetch error:', error.message);
        process.exit(1);
    }

    if (data.length === 0) {
        console.log('ℹ️ No existing rows found.');
        return;
    }

    console.log(`✅ Found ${data.length} rows. Starting sync...`);

    let success = 0, failed = 0;

    for (let i = 0; i < data.length; i++) {
        const record = data[i];

        const payload = {
            type: 'INSERT',
            record
        };

        try {
            const res = await fetch(EDGE_FN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const status = res.ok ? '✅' : '❌';
            const text = await res.text();
            console.log(`${status} [${i + 1}/${data.length}] ${record.id}: ${text}`);

            if (res.ok) success++;
            else failed++;
        } catch (e) {
            console.error(`❌ [${i + 1}/${data.length}] ${record.id}: ${e.message}`);
            failed++;
        }

        // Avoid rate limits
        await new Promise(r => setTimeout(r, 150));
    }

    console.log(`\n📊 Sync complete: ${success} succeeded, ${failed} failed.`);
    if (failed > 0) console.warn('⚠️ Check Edge Function logs for errors.');
}

// Run
backfill().catch(console.error);