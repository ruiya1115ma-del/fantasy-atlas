const token = process.env.CLOUDFLARE_API_TOKEN;
const acct = "bc48736d167f425e8eed813bfd9c8084";
const tag = "8f8f1172830f431a8332eaa11ac64b4f";

const r = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${acct}/builds/workers/${tag}/builds`,
  {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ branch: "main" }),
  },
);
console.log("trigger build", r.status, (await r.text()).slice(0, 400));
