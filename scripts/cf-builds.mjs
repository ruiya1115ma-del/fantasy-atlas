const token = process.env.CLOUDFLARE_API_TOKEN;
const acct = "bc48736d167f425e8eed813bfd9c8084";
const tag = "8f8f1172830f431a8332eaa11ac64b4f";

const r = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${acct}/builds/workers/${tag}/builds`,
  { headers: { authorization: `Bearer ${token}` } },
);
const j = await r.json();
for (const b of j.result.slice(0, 3)) {
  console.log(
    b.build_uuid.slice(0, 8),
    b.status,
    b.build_outcome || "-",
    b.created_on,
    "commit",
    (b.build_trigger_metadata?.commit_hash || "").slice(0, 8),
  );
}
