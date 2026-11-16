const user = () => Number(sessionStorage.getItem('referral-test-user') || 0);
const session = () => user() ? { user: { id: String(user()) } } : null;
async function request(operation, name, args) {
  return (await fetch('/__referral_test', { method:'POST', headers: { 'Content-Type':'application/json' }, body:JSON.stringify({operation,name,args,user:user()}) })).json();
}
let authCallback;
export const supabase = {
  auth: {
    getSession: async () => ({data:{session:session()}}),
    onAuthStateChange: callback => { authCallback = callback; return {data:{subscription:{unsubscribe(){authCallback=null;}}}}; },
    signOut: async () => { sessionStorage.removeItem('referral-test-user'); authCallback?.('SIGNED_OUT',null); return {}; },
    signInWithOtp: async () => ({}), verifyOtp: async () => ({error:{message:'Synthetic test only'}}),
  },
  rpc: (name,args) => name === 'bump_visitor_count' ? Promise.resolve({data:1}) : request('rpc',name,args),
  from: table => {
    const chain = { select(){return chain;},eq(){return chain;},ilike(){return chain;},limit(){return chain;},order(){return chain;},then(resolve,reject){return request('jobs').then(resolve,reject);},insert(rows){if(table !== 'candidate_applications') throw new Error('Unexpected fixture table');return request('apply',null,rows[0]);} };
    return chain;
  },
  storage: { from: () => ({ upload: async () => ({error:null}) }) },
  functions: { invoke: async () => ({error:null}) },
};
