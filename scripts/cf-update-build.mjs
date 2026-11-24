const token = process.env.CLOUDFLARE_API_TOKEN;
const acct = "bc48736d167f425e8eed813bfd9c8084";
const tag = "8f8f1172830f431a8332eaa11ac64b4f";
const trigger = "e5f58206-d4df-4b45-a699-2bfcbacf86b0";
const body = {
  build_command: "npx opennextjs-cloudflare build",
  deploy_command: "npx wrangler deploy",
};

const attempts = [
  ["PATCH", `/accounts/${acct}/builds/triggers/${trigger}`],
  ["PUT", `/accounts/${acct}/builds/triggers/${trigger}`],
  ["PATCH", `/accounts/${acct}/builds/workers/${tag}/triggers/${trigger}`],
  ["PUT", `/accounts/${acct}/builds/workers/${tag}/triggers/${trigger}`],
];

for (const [method, path] of attempts) {
  const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  console.log(method, path, r.status, text.slice(0, 200).replace(/\n/g, " "));
  if (r.ok) break;
}
