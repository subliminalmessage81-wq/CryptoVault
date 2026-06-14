import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// GET  → returns saved wallet settings
// POST → upserts wallet settings (one record per user, keyed by created_by)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    if (req.method === "GET") {
      const records = await base44.asServiceRole.entities.WalletSettings.list();
      // Return the most recently updated record, or null
      const sorted = (records || []).sort(
        (a: any, b: any) => new Date(b.updated_date).getTime() - new Date(a.updated_date).getTime()
      );
      return Response.json({ settings: sorted[0] || null });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { btcAddress, ethAddress, dogeAddress, usdtAddress, label } = body;

      // Check for existing record to upsert
      const existing = await base44.asServiceRole.entities.WalletSettings.list();
      const record = (existing || [])[0];

      const data = {
        btcAddress:  btcAddress  ?? "",
        ethAddress:  ethAddress  ?? "",
        dogeAddress: dogeAddress ?? "",
        usdtAddress: usdtAddress ?? "",
        label:       label       ?? "My Wallet",
      };

      let result;
      if (record?.id) {
        result = await base44.asServiceRole.entities.WalletSettings.update(record.id, data);
      } else {
        result = await base44.asServiceRole.entities.WalletSettings.create(data);
      }

      return Response.json({ ok: true, settings: result });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
