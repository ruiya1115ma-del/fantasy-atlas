const token = process.env.CLOUDFLARE_API_TOKEN;
const acct = "bc48736d167f425e8eed813bfd9c8084";
const buildId = process.argv[2] || "3d3bbeaf-b8a7-4132-8c9b-9dd56b7f6673";

const r = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${acct}/builds/builds/${buildId}`,
  { headers: { authorization: `Bearer ${token}` } },
);
const j = await r.json();
const b = j.result;
console.log(b.status, b.build_outcome, "created", b.created_on, "stopped", b.stopped_on);

if (b.status === "stopped") {
  const lr = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${acct}/builds/builds/${buildId}/logs`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const lj = await lr.json();
  console.log(lj.result.lines.map(([, t]) => t).slice(-40).join("\n"));
}
