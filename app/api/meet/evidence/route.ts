import {
  NextResponse,
} from "next/server";

import {
  evaluateGoogleMeetReservation,
  getGoogleMeetEvidence,
} from "@/lib/server/googleMeetAdapter";

export const runtime =
  "nodejs";

export async function POST(
  request: Request,
) {
  try {
    const body =
      await request.json();

    const meetingCode =
      String(
        body.meetingCode || "",
      );

    if (
      body.reservationId &&
      body.providerGoogleUser &&
      body.customerGoogleUser
    ) {
      const result =
        await evaluateGoogleMeetReservation({
          reservationId:
            String(
              body.reservationId,
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
          meetingCode,
          providerGoogleUser:
            String(
              body
                .providerGoogleUser,
            ),
          customerGoogleUser:
            String(
              body
                .customerGoogleUser,
            ),
        });

      return NextResponse.json(
        result,
      );
    }

    return NextResponse.json(
      await getGoogleMeetEvidence(
        meetingCode,
      ),
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
