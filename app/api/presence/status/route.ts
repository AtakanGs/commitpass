import {
  NextResponse,
} from "next/server";

import {
  statusForToken,
} from "@/lib/server/livePresenceStore";

export const runtime = "nodejs";

export async function POST(
  request: Request,
) {
  try {
    const body =
      await request.json();

    if (
      typeof body.token !==
      "string"
    ) {
      throw new Error(
        "Presence token is required.",
      );
    }

    return NextResponse.json(
      statusForToken(
        body.token,
      ),
    );
  } catch (caught) {
    return NextResponse.json(
      {
        error:
          caught instanceof Error
            ? caught.message
            : String(caught),
      },
      { status: 400 },
    );
  }
}
