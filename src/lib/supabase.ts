import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function createOfflineSupabase() {
  const result = { data: [], error: null, count: 0 };
  const singleResult = { data: null, error: null };

  function builder(): any {
    return {
      ...result,
      select: () => builder(),
      insert: () => builder(),
      update: () => builder(),
      upsert: () => builder(),
      delete: () => builder(),
      eq: () => builder(),
      neq: () => builder(),
      gt: () => builder(),
      gte: () => builder(),
      lt: () => builder(),
      lte: () => builder(),
      ilike: () => builder(),
      is: () => builder(),
      order: () => builder(),
      limit: () => builder(),
      single: async () => singleResult,
      maybeSingle: async () => singleResult,
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
    };
  }

  return {
    from: () => builder(),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ data: null, error: { message: "Supabase environment variables are missing." } }),
      signUp: async () => ({ data: null, error: { message: "Supabase environment variables are missing." } }),
      resetPasswordForEmail: async () => ({ data: null, error: { message: "Supabase environment variables are missing." } }),
      updateUser: async () => ({ data: null, error: { message: "Supabase environment variables are missing." } }),
      signOut: async () => ({ error: null }),
    },
    functions: {
      invoke: async () => ({ data: null, error: { message: "Supabase environment variables are missing." } }),
    },
  };
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : createOfflineSupabase() as unknown as ReturnType<typeof createClient>;
