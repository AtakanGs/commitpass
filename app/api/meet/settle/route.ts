import {
  NextResponse,
} from "next/server";

import {
  settleGoogleMeetReservation,
} from "@/lib/server/googleMeetAdapter";

export const runtime =
  "nodejs";

export async function POST(
  request: Request,
) {
  try {
    const body =
      await request.json();

    const result =
      await settleGoogleMeetReservation({
        reservationId:
          String(
            body.reservationId ||
              "",
          ),
        title:
          String(
            body.title || "",
          ),
        salt:
          String(
            body.salt || "",
          ),
        policy: {
          duration:
            String(
              body.policy
                ?.duration || "",
            ),
          issue:
            String(
              body.policy
                ?.issue || "",
            ),
          threshold:
            String(
              body.policy
                ?.threshold || "",
            ),
        },
        meetingCode:
          String(
            body.meetingCode ||
              "",
          ),
        providerGoogleUser:
          String(
            body
              .providerGoogleUser ||
              "",
          ),
        customerGoogleUser:
          String(
            body
              .customerGoogleUser ||
              "",
          ),
      });

    return NextResponse.json(
      result,
    );
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : String(caught);

    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}
