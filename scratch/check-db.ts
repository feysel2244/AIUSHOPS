import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ilqexfieqqktafjimvqo.supabase.co',
  'sb_publishable_OEKz1puusdoPzqIhs7Zxug_nt8uprcP'
);

async function check() {
  const { data: shops } = await supabase.from('shops').select('id, name, logo_url, banner_url, payment_qr_url');
  const shopsWithSupa = shops?.filter(s => 
    s.logo_url?.includes('supabase.co') || 
    s.banner_url?.includes('supabase.co') || 
    s.payment_qr_url?.includes('supabase.co')
  );
  
  if (shopsWithSupa?.length) {
    console.log(shopsWithSupa.map(s => s.name));
  }
}

check();
