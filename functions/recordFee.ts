import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PLATFORM_FEE_RATE = 0.0008; // 0.08%

// POST body: { fromToken, toToken, inputAmount, provider, txReference? }
// GET: returns fee summary (total USDT collected, pending, withdrawn)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── GET: admin fee summary ──────────────────────────────────────────────
    if (req.method === "GET") {
      const fees = await base44.asServiceRole.entities.FeeCollection.list();
      const withdrawals = await base44.asServiceRole.entities.AdminWithdrawal.list();

      const totalCollectedUSDT = (fees || [])
        .filter((f: any) => f.status !== "withdrawn")
        .reduce((sum: number, f: any) => sum + (f.feeUSDT || 0), 0);

      const totalWithdrawnUSDT = (fees || [])
        .filter((f: any) => f.status === "withdrawn")
        .reduce((sum: number, f: any) => sum + (f.feeUSDT || 0), 0);

      const pendingCount = (fees || []).filter((f: any) => f.status === "pending").length;
      const collectedCount = (fees || []).filter((f: any) => f.status === "collected").length;

      // Group by token
      const byToken: Record<string, { count: number; feeUSDT: number }> = {};
      for (const f of (fees || [])) {
        if (!byToken[f.fromToken]) byToken[f.fromToken] = { count: 0, feeUSDT: 0 };
        byToken[f.fromToken].count++;
        byToken[f.fromToken].feeUSDT += f.feeUSDT || 0;
      }

      return Response.json({
        summary: {
          totalFeesUSDT: Number(totalCollectedUSDT.toFixed(6)),
          totalWithdrawnUSDT: Number(totalWithdrawnUSDT.toFixed(6)),
          availableUSDT: Number((totalCollectedUSDT).toFixed(6)),
          totalTransactions: (fees || []).length,
          pendingCount,
          collectedCount,
          byToken,
        },
        recentFees: (fees || [])
          .sort((a: any, b: any) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())
          .slice(0, 20),
        withdrawals: (withdrawals || [])
          .sort((a: any, b: any) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()),
      });
    }

    // ── POST /record: record a new platform fee ─────────────────────────────
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { fromToken, toToken, inputAmount, provider, txReference, action } = body;

      // Sub-action: admin withdraw
      if (action === "withdraw") {
        return handleWithdraw(body, base44);
      }

      // Sub-action: mark fees as collected
      if (action === "collect") {
        return handleCollect(base44);
      }

      // Normal: record fee
      if (!fromToken || !inputAmount) {
        return Response.json({ error: "fromToken and inputAmount are required" }, { status: 400 });
      }

      // Fetch live price for fromToken
      const cgId = tokenToCGId(fromToken);
      let tokenPriceUSD = 1; // USDT = 1
      if (cgId !== "tether") {
        try {
          const priceRes = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`
          );
          const priceData = await priceRes.json();
          tokenPriceUSD = priceData[cgId]?.usd || 1;
        } catch (_) {}
      }

      const feeAmount = inputAmount * PLATFORM_FEE_RATE;
      const feeUSD    = feeAmount * tokenPriceUSD;
      const feeUSDT   = feeUSD; // 1 USDT = 1 USD

      const fee = await base44.asServiceRole.entities.FeeCollection.create({
        fromToken:     fromToken.toUpperCase(),
        toToken:       toToken?.toUpperCase() || "",
        inputAmount:   Number(inputAmount),
        feeAmount:     Number(feeAmount.toFixed(10)),
        feeUSD:        Number(feeUSD.toFixed(6)),
        feeUSDT:       Number(feeUSDT.toFixed(6)),
        tokenPriceUSD: Number(tokenPriceUSD.toFixed(6)),
        status:        "collected",
        txReference:   txReference || "",
        provider:      provider || "unknown",
      });

      return Response.json({
        ok: true,
        fee: {
          feeAmount: feeAmount.toFixed(10),
          feeUSDT: feeUSDT.toFixed(6),
          feeRatePercent: "0.08%",
          tokenPriceUSD,
        },
        record: fee,
      });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ── helpers ─────────────────────────────────────────────────────────────────

function tokenToCGId(symbol: string): string {
  const map: Record<string, string> = {
    BTC: "bitcoin", ETH: "ethereum", DOGE: "dogecoin", USDT: "tether",
  };
  return map[symbol.toUpperCase()] || symbol.toLowerCase();
}

async function handleCollect(base44: any) {
  const fees = await base44.asServiceRole.entities.FeeCollection.list();
  const pending = (fees || []).filter((f: any) => f.status === "pending");
  for (const f of pending) {
    await base44.asServiceRole.entities.FeeCollection.update(f.id, { status: "collected" });
  }
  return Response.json({ ok: true, collected: pending.length });
}

async function handleWithdraw(body: any, base44: any) {
  const { destinationAddress, notes } = body;

  if (!destinationAddress || !/^0x[a-fA-F0-9]{40}$/.test(destinationAddress)) {
    return Response.json({ error: "Invalid USDT ERC-20 destination address" }, { status: 400 });
  }

  // Find all collected fees not yet withdrawn
  const fees = await base44.asServiceRole.entities.FeeCollection.list();
  const available = (fees || []).filter((f: any) => f.status === "collected");

  if (available.length === 0) {
    return Response.json({ error: "No collected fees available to withdraw" }, { status: 400 });
  }

  const totalUSDT = available.reduce((sum: number, f: any) => sum + (f.feeUSDT || 0), 0);

  // Create withdrawal record
  const withdrawal = await base44.asServiceRole.entities.AdminWithdrawal.create({
    destinationAddress,
    amountUSDT:    Number(totalUSDT.toFixed(6)),
    status:        "pending",
    notes:         notes || "",
    feesIncluded:  available.length,
  });

  // Mark all collected fees as withdrawn
  for (const f of available) {
    await base44.asServiceRole.entities.FeeCollection.update(f.id, { status: "withdrawn" });
  }

  // Build a Uniswap/Etherscan deep-link for the actual on-chain transfer
  const uniswapLink = `https://app.uniswap.org/#/send?outputCurrency=0xdAC17F958D2ee523a2206206994597C13D831ec7&recipient=${destinationAddress}&exactAmount=${totalUSDT.toFixed(2)}`;

  return Response.json({
    ok: true,
    withdrawal,
    totalUSDT: Number(totalUSDT.toFixed(6)),
    feesIncluded: available.length,
    broadcastLink: uniswapLink,
    message: `Withdrawal of ${totalUSDT.toFixed(4)} USDT initiated for ${available.length} fee records. Use the broadcastLink to send on-chain.`,
  });
}