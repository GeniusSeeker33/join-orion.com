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

export const marketingDevClient = {
  ...supabase,
  auth: {
    getSession: async () => ({ data: { session: sessionStorage.getItem("synthetic-recruiter") ? {
      access_token: "synthetic-ats-token", user: { email: "desiree@orionwholesaleonline.com" }
    } : null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
  }
};
