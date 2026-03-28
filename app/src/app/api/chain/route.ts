import { NextRequest, NextResponse } from "next/server";

import {
  getChainStatus,
  getComputeBalance,
  getEntitiesByOwner,
  getEntity,
  getIdentity,
} from "@/lib/chain-client";

/**
 * GET /api/chain
 *
 * Proxies read-only queries to the $HEART blockchain so the browser
 * never needs to talk directly to the chain (avoids CORS issues).
 *
 * Query parameters:
 *   method   – one of: status | identity | entity | entities | balance
 *   address  – owner address  (required for identity, entities)
 *   id       – entity id      (required for entity)
 *   entityId – entity id      (required for balance)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const method = searchParams.get("method");

  try {
    switch (method) {
      /* ---- chain status ---- */
      case "status": {
        const status = await getChainStatus();
        return NextResponse.json(status);
      }

      /* ---- identity module ---- */
      case "identity": {
        const address = searchParams.get("address");
        if (!address) {
          return NextResponse.json(
            { error: "Missing required parameter: address" },
            { status: 400 }
          );
        }
        const identity = await getIdentity(address);
        return NextResponse.json(identity);
      }

      /* ---- existence: single entity ---- */
      case "entity": {
        const id = searchParams.get("id");
        if (!id) {
          return NextResponse.json(
            { error: "Missing required parameter: id" },
            { status: 400 }
          );
        }
        const entity = await getEntity(id);
        if (!entity) {
          return NextResponse.json(
            { error: "Entity not found" },
            { status: 404 }
          );
        }
        return NextResponse.json(entity);
      }

      /* ---- existence: entities by owner ---- */
      case "entities": {
        const address = searchParams.get("address");
        if (!address) {
          return NextResponse.json(
            { error: "Missing required parameter: address" },
            { status: 400 }
          );
        }
        const entities = await getEntitiesByOwner(address);
        return NextResponse.json({ entities });
      }

      /* ---- compute balance ---- */
      case "balance": {
        const entityId = searchParams.get("entityId");
        if (!entityId) {
          return NextResponse.json(
            { error: "Missing required parameter: entityId" },
            { status: 400 }
          );
        }
        const balance = await getComputeBalance(entityId);
        return NextResponse.json({ balance });
      }

      /* ---- unknown method ---- */
      default:
        return NextResponse.json(
          {
            error: `Unknown method: ${method}. Use one of: status, identity, entity, entities, balance`,
          },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[api/chain] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
