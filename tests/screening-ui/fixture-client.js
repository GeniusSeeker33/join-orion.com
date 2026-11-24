async function request(kind, payload = {}) {
  const { data, error } = await (await fetch("/__screening_fixture", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, ...payload })
  })).json();
  return { data, error };
}

export const supabase = {
  rpc: (name, params) => name === "bump_visitor_count" ? Promise.resolve({ data: 1 }) : request("rpc", { name, params }),
  from: table => {
    const chain = {
      select: () => chain, eq: () => chain, order: () => chain,
      then: (resolve, reject) => request("table", { table }).then(resolve, reject),
      insert: rows => request("insert", { table, rows })
    };
    return chain;
  },
  storage: { from: () => ({ upload: (path, file) => request("upload", { path, filename: file.name }) }) },
  functions: { invoke: name => request("function", { name }) }
};

const authListeners = new Set();
const session = () => sessionStorage.getItem("synthetic-recruiter") ? {
  access_token: "synthetic-ats-token", user: { email: "desiree@orionwholesaleonline.com" }
} : null;

export const marketingDevClient = {
  ...supabase,
  auth: {
    getSession: async () => ({ data: { session: session() } }),
    onAuthStateChange: callback => {
      authListeners.add(callback);
      return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
    },
    signOut: async () => {
      sessionStorage.removeItem("synthetic-recruiter");
      for (const callback of authListeners) callback("SIGNED_OUT", null);
    },
    signInWithPassword: async () => {
      sessionStorage.setItem("synthetic-recruiter", "true");
      for (const callback of authListeners) callback("SIGNED_IN", session());
      return {};
    }
  }
};
