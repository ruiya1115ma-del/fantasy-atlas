const token = process.env.CLOUDFLARE_API_TOKEN;
const acct = "bc48736d167f425e8eed813bfd9c8084";
const buildId = "67de877e-385d-47fd-9a9e-c53666b9ee14";
const r = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${acct}/builds/builds/${buildId}/logs`,
  { headers: { authorization: `Bearer ${token}` } },
);
const j = await r.json();
const lines = j.result.lines.map(([, text]) => text);
console.log(lines.slice(-60).join("\n"));
