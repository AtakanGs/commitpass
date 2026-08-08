import {
  NextResponse,
} from "next/server";

import {
  authorizePresence,
} from "@/lib/server/livePresenceStore";

export const runtime = "nodejs";

export async function POST(
  request: Request,
) {
  try {
    const body =
      await request.json();

    const result =
      await authorizePresence(
        body,
      );

    return NextResponse.json(
      result,
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
