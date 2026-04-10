import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClients, getPosts } from "@/lib/sheets";
import { resolveRole } from "@/lib/rbac";

function norm(v: string) {
  return String(v || "").trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  const result: any = { steps: [] };

  try {
    result.steps.push({ step: "1. Resolving Role" });
    const roleResult = await resolveRole();
    if (!roleResult) {
      result.steps.push({ status: "Failed", reason: "resolveRole returned null" });
      return NextResponse.json(result);
    }
    result.steps.push({ status: "Success", roleResult: { role: roleResult.role, email: roleResult.email } });

    result.steps.push({ step: "2. Fetching Session" });
    const session = await getServerSession(authOptions);
    result.steps.push({ status: "Success", sessionName: session?.user?.name, sessionEmail: session?.user?.email });

    result.steps.push({ step: "3. Calling getPosts with User Token" });
    let rows;
    try {
      rows = await getPosts(roleResult.token);
      result.steps.push({ status: "Success", totalPostsFoundInSheet: rows.length });
    } catch (err: any) {
      result.steps.push({ status: "Failed", reason: err.message, explanation: "If you see a 403 error, the client Google account lacks Viewer access to the Google Sheet." });
      return NextResponse.json(result);
    }

    if (roleResult.role === "va") {
      result.steps.push({ step: "4. Role is VA, returning everything." });
      result.data = rows;
      return NextResponse.json(result);
    }

    result.steps.push({ step: "4. Role is Client. Calling getClients" });
    let clients;
    try {
      clients = await getClients(roleResult.token);
      result.steps.push({ status: "Success", totalClientsFoundInSheet: clients.length });
    } catch (err: any) {
      result.steps.push({ status: "Failed", reason: err.message, explanation: "If you see a 403 error, the client Google account lacks Viewer access to the Google Sheet." });
      return NextResponse.json(result);
    }

    result.steps.push({ step: "5. Matching client profile" });
    let myClient = clients.find((c) => norm(c.email) === roleResult.email);
    let matchedBy = "Exact Email";

    if (!myClient) {
      result.steps.push({ log: `Failed to match exact email: ${roleResult.email}` });
      if (session?.user?.name) {
        const sessionName = norm(session.user.name);
        myClient = clients.find(c => norm(c.name) === sessionName);
        matchedBy = "Google Account Name";
      }
    }

    if (!myClient && clients.length === 1 && roleResult.email === norm(process.env.CLIENT_EMAIL || "")) {
      result.steps.push({ log: "Failed to match Name, deploying single-client fallback" });
      myClient = clients[0];
      matchedBy = "Single Client Sheet Fallback";
    }

    if (myClient) {
      result.steps.push({ status: "Matched!", matchedBy, clientDetails: myClient });
      const myIds = new Set([
        norm(myClient.id), 
        norm(myClient.name), 
        norm(myClient.email)
      ]);
      result.steps.push({ targetIdsToFilterFor: Array.from(myIds) });

      const scoped = rows.filter((p) => {
        const pNormId = norm(p.clientId);
        const matchesMine = myIds.has(pNormId);
        const isDefault = pNormId === "client" || pNormId === "default" || p.clientId === "";
        result.steps.push({ checkingPost: p.id, postClientId: p.clientId, pNormId, matchesMine, isDefault });
        return matchesMine || isDefault;
      });

      result.steps.push({ finalAllowedPosts: scoped.length });
      result.data = scoped;
    } else {
      result.steps.push({ status: "No Match", reason: "Could not link user to any row in Clients tab." });
      const scopedFallback = rows.filter((p) => 
        norm(p.clientId) === "client" ||
        norm(p.clientId) === "default" ||
        p.clientId === ""
      );
      result.steps.push({ finalAllowedPosts: scopedFallback.length, log: "Using extreme fallback (only pure default/empty clients)" });
      result.data = scopedFallback;
    }

    return NextResponse.json(result);

  } catch (err: any) {
    result.error = err.message;
    return NextResponse.json(result);
  }
}
