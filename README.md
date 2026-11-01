# Spend Guardrails

Deterministic spend guardrails for AI agents. An LLM agent proposes a purchase, a
policy engine returns ALLOW, DENY or ESCALATE, and only approved purchases are paid
through the PayPal sandbox. Every decision is logged with the rule that produced it.

> The agent is probabilistic. The guardrail must not be.

No LLM sits in the approval path. The policy engine is plain code, so the same
proposal, history and policy always produce the same verdict.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com).

## How it works

1. **Propose.** The agent turns a goal into items from a fixed catalogue. Merchant,
   category and price come from the catalogue, never from the model's text.
2. **Decide.** The policy engine checks the proposal against the agent's rules and
   recent history.
3. **Act.**
   - ALLOW pays through PayPal.
   - DENY stops the purchase.
   - ESCALATE waits for a person. No answer within 24 hours denies it.
4. **Record.** Decisions go into an append-only SQLite log, enforced by database
   triggers. A trigger also refuses any payment without an ALLOW verdict or a human
   approval.

## Demo policy

| Rule | Limit | Outcome |
|---|---|---|
| Review cap | Over 100 USD per transaction | ESCALATE |
| Hard cap | Over 1000 USD per transaction | DENY |
| Rolling spend | Over 500 USD a day or 2000 USD a week | ESCALATE |
| Merchant denylist | Daily Grind | DENY |
| Velocity | More than 5 purchases an hour | DENY |

The full policy, including category rules, is in
[`lib/policy/demo.ts`](lib/policy/demo.ts).

## Setup

You need Node.js 20.9 or later and:

- a PayPal sandbox REST app on a **US** sandbox business account
- a [Groq](https://console.groq.com) API key
- an [AG Studio](https://www.ag-grid.com) licence key

```bash
npm install
cp env.example .env.local   # then fill in your keys
npm run seed                # load demo history
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `.env.local` is git-ignored.
`NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY` is sent to the browser. The database defaults to
`data/guardrails.db`; set `DATABASE_PATH` to change it.

## Try it

```bash
npm run agent -- "Buy printer paper for the office"
npm run approvals -- list
npm run approvals -- approve <id>
```

`npm run approvals` also accepts `reject <id>` and `retry <id>`.

## Pages

| Page | Shows |
|---|---|
| `/approvals` | Escalated purchases to approve or reject, and failed payments to retry |
| `/history` | The full audit log, with filters |
| `/spend` | Paid purchases by category, merchant, agent and day |
| `/transactions`, `/balances` | Live PayPal sandbox data |

`/transactions` and `/balances` need the app's **Transaction search** feature enabled.

## Failed payments

An approval is recorded before the payment is attempted. If PayPal fails, the
failure is logged and the purchase moves to **Payment failed** on `/approvals`.
Retries reuse the decision ID as PayPal's request ID, so a retry cannot charge twice.

## Limitations

- Sandbox only. Payments use PayPal's public test card and move no real money.
- There is no login. Anyone who can open a deployment can approve its purchases, so
  it should hold demo data only.

## Development

```bash
npm test
npm run lint
npm run build
```

## Credits

Scaffolded from [paypaldev/hackathon-paypal-ag-grid-boilerplate](https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate).

## License

MIT, see [LICENSE](LICENSE).
