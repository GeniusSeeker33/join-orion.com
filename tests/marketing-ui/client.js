const user = new URLSearchParams(window.location.search).get('user') || '1';
let session = user === 'signedout' ? null : { access_token: user, user: { id: '00000000-0000-4000-8000-'+user.padStart(12,'0') } };
const listeners = new Set();
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange(callback) { listeners.add(callback); return { data: { subscription: { unsubscribe() { listeners.delete(callback); } } } }; },
    signInWithOtp: async (request) => { window.__signInRequest = request; return { error: null }; },
    signOut: async () => { session = null; for (const callback of listeners) callback('SIGNED_OUT', null); return { error: null }; },
  },
  async rpc(name, args) {
    const response = await fetch('/__marketing_rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-User': new URLSearchParams(window.location.search).get('user') || '1' }, body: JSON.stringify({ name, args }) });
    return response.json();
  },
};
